'use client'

import { useState, type ReactNode } from 'react'
import { Button, Modal, ModalBody, ModalHeader, SectionTitle } from '@/components/ui'
import { Disclosure } from '@/components/ui/Disclosure'
import { colors, spacing } from '@/lib/tokens'

/** Keep the anchored activity summary bounded; full history has its own accessible dialog. */
export function LeadActivitySection({ entries }: { entries: ReactNode[] }) {
  const [allOpen, setAllOpen] = useState(false)
  return <>
    <Disclosure summary={<SectionTitle style={{ marginBottom: 0 }}>Activity</SectionTitle>} style={{ flexShrink: 0, padding: spacing.lg, background: colors.surfaceMuted }}>
      <div style={{ display: 'grid', gap: spacing.sm, marginTop: spacing.sm }}>
        {entries.length ? entries.slice(0, 2) : 'No system activity yet.'}
        {entries.length > 2 && <Button size="sm" variant="secondary" onClick={() => setAllOpen(true)}>View all activity</Button>}
      </div>
    </Disclosure>
    <Modal isOpen={allOpen} onClose={() => setAllOpen(false)} size="lg" ariaLabel="All lead activity">
      <ModalHeader title="Activity" onClose={() => setAllOpen(false)} />
      <ModalBody><div style={{ display: 'grid', gap: spacing.md }}>{entries}</div></ModalBody>
    </Modal>
  </>
}