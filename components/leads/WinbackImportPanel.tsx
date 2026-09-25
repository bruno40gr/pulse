'use client'

import { useRef, useState } from 'react'
import Papa from 'papaparse'
import { Button, SlidePanelHeader } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type SourceRow = {
  'Student Name'?: string
  'Lesson Type'?: string
  'Disenrollment Date'?: string
  'Disenrollment Month'?: string
  'Marked by Cohen'?: string
  'Account Holder 1 Name'?: string
  'Email 1'?: string
  'Phone 1'?: string
  'Account Holder 2 Name'?: string
  'Email 2'?: string
  'Phone 2'?: string
  'CRM Client ID'?: string
  Notes?: string
}

interface WinbackImportPanelProps {
  onClose: () => void
  onImported: () => Promise<void>
}

export default function WinbackImportPanel({ onClose, onImported }: WinbackImportPanelProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<SourceRow[]>([])
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<{ created: number; skipped: number; excluded: number; updated?: number; notesCleared?: number; unmatched?: number } | null>(null)

  const chooseFile = () => inputRef.current?.click()

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError('')
    setResult(null)
    const text = await file.text()
    const parsed = Papa.parse<SourceRow>(text, { header: true, skipEmptyLines: true })
    const validRows = parsed.data.filter((row) => row['Student Name']?.trim())
    if (parsed.errors.length > 0 || validRows.length === 0) {
      setRows([])
      setError('We could not read a usable student list from this CSV.')
      return
    }
    setRows(validRows)
    setFileName(file.name)
  }

  const importRows = async () => {
    if (!rows.length) return
    setImporting(true)
    setError('')
    try {
      const response = await fetch('/api/leads/winback-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Could not import the Win-back list.')
      setResult(data)
      await onImported()
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : 'Could not import the Win-back list.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <>
      <SlidePanelHeader title="Import Win-back students" subtitle="Former students are created as Lost — Disenrolled." onClose={onClose} />
      <div style={{ padding: spacing['2xl'], display: 'flex', flexDirection: 'column', gap: spacing.lg, overflowY: 'auto' }}>
        <div style={{ padding: spacing.lg, border: `1px solid ${colors.border}`, borderRadius: radius.lg, background: colors.surfaceMuted, fontSize: typography.sizeSm, lineHeight: 1.5, color: colors.textSecondary }}>
          This importer reads student and disenrollment fields. When the CSV also includes contact columns such as <strong>Email 1</strong> and <strong>Phone 1</strong>, it updates the existing Win-back contacts with the corrected names and outreach details, and clears imported name-uncertainty notes for matched students. Group entries are excluded.
        </div>

        <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => void handleFile(event.target.files?.[0])} style={{ display: 'none' }} />
        <Button type="button" variant="secondary" onClick={chooseFile}>Choose CSV</Button>

        {fileName && (
          <div style={{ border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: spacing.md, fontSize: typography.sizeSm, color: colors.text }}>
            <strong>{fileName}</strong><br />
            {rows.length} source {rows.length === 1 ? 'row' : 'rows'} ready to review and import.
          </div>
        )}

        {result && (
          <div style={{ border: `1px solid ${colors.success}`, borderRadius: radius.md, padding: spacing.md, background: colors.surfaceMuted, fontSize: typography.sizeSm, color: colors.success }}>
            {result.updated ? `Updated ${result.updated} existing student contacts${result.notesCleared ? ` and cleared ${result.notesCleared} name-uncertainty notes` : ''}. ` : ''}
            {result.created ? `Imported ${result.created} students. ` : ''}
            {result.skipped ? `Skipped ${result.skipped} existing records. ` : ''}
            {result.unmatched ? `${result.unmatched} rows were not changed because they could not be matched safely. ` : ''}
            Excluded {result.excluded} non-student/group rows.
          </div>
        )}
        {error && <div style={{ color: colors.error, fontSize: typography.sizeSm }}>{error}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm, marginTop: 'auto' }}>
          <Button type="button" variant="secondary" onClick={onClose} disabled={importing}>Close</Button>
          <Button type="button" onClick={() => void importRows()} disabled={!rows.length || importing}>
            {importing ? 'Importing…' : `Import ${rows.length || ''} students`}
          </Button>
        </div>
      </div>
    </>
  )
}