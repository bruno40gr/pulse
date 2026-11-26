import type { ReactNode } from 'react'
import { SlidePanelActionBar } from '@/components/ui/SlidePanelActionBar'
import { spacing } from '@/beta-source/lib/tokens'
import styles from './StudentWorkspace.module.css'

export function AccountProfileToolbar({ mobile, communication, actions, singleRow = false }: { mobile: boolean; communication: ReactNode; actions?: ReactNode; singleRow?: boolean }) {
  return <SlidePanelActionBar isMobile={mobile} wrap={!singleRow || mobile}>
    <div className={styles.toolbar} style={{ gap: spacing.sm, minWidth: 0, ...(singleRow ? { flex: '1 1 0', flexWrap: 'nowrap' } : {}) }}>{communication}</div>
    {actions && <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginLeft: mobile ? 0 : 'auto', flexShrink: 0 }}>{actions}</div>}
  </SlidePanelActionBar>
}