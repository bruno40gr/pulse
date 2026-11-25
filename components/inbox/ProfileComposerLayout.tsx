'use client'

import { useContext, useEffect, type ReactNode } from 'react'
import { SlidePanelWidthContext } from '@/components/ui/SlidePanel'
import { useIsMobile } from '@/lib/useMediaQuery'
import { colors } from '@/lib/tokens'
import { DialogTitleContext } from '@/lib/useDialogLayer'

/** Two independently scrolling panes in one dialog. Hidden panes stay mounted. */
export function ProfileComposerLayout({ open, profile, composer }: {
  open: boolean; profile: ReactNode; composer: ReactNode
}) {
  const mobile = useIsMobile()
  const setWidth = useContext(SlidePanelWidthContext)
  useEffect(() => {
    setWidth?.(mobile || open ? '100dvw' : '50dvw')
    return () => setWidth?.(undefined)
  }, [mobile, open, setWidth])
  const pane = { flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }
  return <div data-profile-composer-workspace style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
    <section aria-label="Profile" hidden={mobile && open} style={{ ...pane, containerType: 'inline-size', display: mobile && open ? 'none' : 'flex' }}>{profile}</section>
    <section aria-label="Message composer" hidden={!open} style={{ ...pane, display: open ? 'flex' : 'none', borderLeft: !mobile && open ? `1px solid ${colors.border}` : undefined }}><DialogTitleContext.Provider value={undefined}>{composer}</DialogTitleContext.Provider></section>
  </div>
}