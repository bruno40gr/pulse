'use client'

import { useContext, type ReactNode, type Ref } from 'react'
import { BackControl, SectionTitle } from '@/components/ui'
import { InlineWorkspaceContext } from './InlineWorkspaceContext'
import styles from './SectionHeader.module.css'

/** Titles share the content edge; navigation never reserves an empty column. */
export function SectionHeader({ children, actions, navigation, onBack, backLabel = 'Back', showBackLabel = false, titleId, headingRef, compactActions = false, subtitle }: { children: ReactNode; actions?: ReactNode; navigation?: ReactNode; onBack?: () => void; backLabel?: string; showBackLabel?: boolean; titleId?: string; headingRef?: Ref<HTMLHeadingElement>; compactActions?: boolean; subtitle?: string }) {
  const inline = useContext(InlineWorkspaceContext)
  const back = onBack ? <BackControl label={backLabel} showLabel={showBackLabel} onClick={onBack} /> : navigation
  return <header className={`${styles.header} ${inline ? styles.aligned : ''} ${compactActions ? styles.compactActions : ''}`} data-section-header="">
    {back && <div className={styles.navigation}>{back}</div>}
    <div className={`${styles.title} ${subtitle ? styles.withSubtitle : ''}`} data-section-title="">{titleId ? <h2 ref={headingRef} id={titleId} tabIndex={-1} className={styles.heading}>{children}</h2> : children}{subtitle && <p className={styles.subtitle} data-task-subtitle="">{subtitle}</p>}</div>
    {actions && <div className={styles.actions}>{actions}</div>}
  </header>
}

export function SectionHeading({ children }: { children: ReactNode }) {
  return <SectionTitle as="h2" variant="card">{children}</SectionTitle>
}