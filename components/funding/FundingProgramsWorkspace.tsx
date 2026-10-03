'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button, Notice, PageHeader } from '@/components/ui'
import { getActiveTenantId } from '@/lib/tenant'
import { spacing } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { FundingProgramsHub } from './FundingProgramsHub'
import type { FundingCase, FundingProgram } from './types'

export default function FundingProgramsWorkspace() {
  const isMobile = useIsMobile()
  const [programs, setPrograms] = useState<FundingProgram[]>([])
  const [cases, setCases] = useState<FundingCase[]>([])
  const [error, setError] = useState('')
  const [showAddProgram, setShowAddProgram] = useState(false)

  const loadPrograms = useCallback(async () => {
    const tenantId = getActiveTenantId()
    const response = await fetch(`/api/funding/organizations?tenant=${encodeURIComponent(tenantId)}`)
    const body = await response.json()
    if (!response.ok) throw new Error(body?.error || 'Could not load funding programs.')
    setPrograms(Array.isArray(body) ? body : [])
  }, [])

  useEffect(() => {
    const tenantId = getActiveTenantId()
    Promise.all([
      loadPrograms(),
      fetch(`/api/funding/cases?tenant=${encodeURIComponent(tenantId)}`).then(async response => {
        const body = await response.json()
        if (!response.ok) throw new Error(body?.error || 'Could not load funded students.')
        setCases(Array.isArray(body) ? body : [])
      }),
    ]).catch(caught => setError(caught instanceof Error ? caught.message : 'Could not load funding programs.'))
  }, [loadPrograms])

  const programsWithTotals = useMemo(() => programs.map(program => {
    const matchingCases = cases.filter(item => item.profileVersionId
      ? item.profileVersionId === program.profileVersionId
      : item.fundingOrganizationId === program.organizationId)
    return { ...program, activeCases: matchingCases.length, outstanding: matchingCases.reduce((sum, item) => sum + item.outstanding, 0) }
  }), [cases, programs])

  return (
    <div style={{ padding: isMobile ? spacing.lg : spacing['3xl'], width: '100%', maxWidth: '100%', boxSizing: 'border-box' }}>
      <PageHeader
        title="Funding Programs"
        subtitle="Manage program setup, funded students, and outstanding payments."
        right={<Button onClick={() => setShowAddProgram(true)} disabled={Boolean(error)}><Plus size={16} /> Add funding program</Button>}
      />
      {error && <Notice variant="warning" title="Funding programs unavailable" style={{ marginBottom: spacing.lg }}>{error}</Notice>}
      <FundingProgramsHub
        programs={programsWithTotals}
        cases={cases}
        persisted={!error}
        catalogOpen={showAddProgram}
        onCatalogOpenChange={setShowAddProgram}
        onRefresh={loadPrograms}
        onCaseUpdated={fundingCase => setCases(current => current.map(item => item.id === fundingCase.id ? fundingCase : item))}
      />
    </div>
  )
}