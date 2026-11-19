import type { ReactNode } from 'react'
import { SlidePanelActionBar } from '@/beta-source/components/ui/SlidePanelActionBar'
import { spacing } from '@/beta-source/lib/tokens'
import styles from './StudentWorkspace.module.css'

export function AccountProfileToolbar({ mobile, communication, actions }: { mobile: boolean; communication: ReactNode; actions?: ReactNode }) {
  return <SlidePanelActionBar isMobile={mobile}>
    <div className={styles.toolbar} style={{ gap: spacing.sm, minWidth: 0 }}>{communication}</div>
    {actions && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginLeft: mobile ? 0 : 'auto' }}>{actions}</div>}
  </SlidePanelActionBar>
}