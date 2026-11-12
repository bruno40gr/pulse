'use client'

import { useContext, useEffect, useId, useRef, type ReactNode } from 'react'
import { ProfileIdentity } from '@/beta-source/components/ui/ProfileIdentity'
import { useIsMobile } from '@/beta-source/lib/useMediaQuery'
import { BackControl } from '@/beta-source/components/ui/BackControl'
import { colors, typography } from '@/beta-source/lib/tokens'
import styles from './AccountWorkspace.module.css'
import { SectionHeader } from './SectionHeader'
import { InlineWorkspaceContext } from './InlineWorkspaceContext'
export { InlineWorkspaceContext } from './InlineWorkspaceContext'


/** Shared full-view task shell. Callers own return context, drafts and mutations. */
export function AccountWorkspace({ title, accountName, onBack, children, profileSubtitle = 'Student profile', subtitle, actions, backLabel, showBackLabel = false }: { title: string; accountName: string; profileSubtitle?: string; subtitle?: string; onBack: () => void; children: ReactNode; actions?: ReactNode; backLabel?: string; showBackLabel?: boolean }) {
  const inline = useContext(InlineWorkspaceContext)
  const titleId = useId()
  const isMobile = useIsMobile()
  const names = accountName.trim().split(/\s+/)
  const firstName = names[0] || ''
  const lastName = names.slice(1).join(' ')
  const heading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    heading.current?.focus({ preventScroll: true })
  }, [title, accountName, inline])
  if (inline) return <section aria-labelledby={titleId} className={styles.inlineWorkspace}>
    <SectionHeader onBack={onBack} backLabel={backLabel || accountName} showBackLabel={showBackLabel} titleId={titleId} headingRef={heading} subtitle={subtitle} actions={actions}>{title}</SectionHeader>
    <div className={styles.content}>{children}</div>
  </section>
  return <section aria-labelledby={titleId} className={styles.workspace}>
    <header className={styles.header}>
      <div className={styles.identityRow}>
        <BackControl label={accountName} onClick={onBack} />
        <ProfileIdentity title={accountName} subtitle={profileSubtitle} avatar={{ firstName, lastName, size: isMobile ? 36 : 48 }} titleSize={isMobile ? typography.sizeLg : typography.size2xl} animate />
      </div>
    </header>
    <div className={styles.body}>
      <SectionHeader actions={actions}><h1 ref={heading} id={titleId} tabIndex={-1} className={styles.title} style={{ color: colors.text }}>{title}</h1></SectionHeader>
    <div className={styles.content}>{children}</div>
    </div>
  </section>
}