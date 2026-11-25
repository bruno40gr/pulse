'use client'

import { createContext, useContext, useEffect, type ReactNode } from 'react'
import { SlidePanelWidthContext } from '@/components/ui/SlidePanel'
import { useIsMobile } from '@/lib/useMediaQuery'
import { colors } from '@/lib/tokens'
import { DialogTitleContext } from '@/lib/useDialogLayer'
import { ProfileComposerCancelContext } from './ProfileComposerToolbar'

const ProfileComposingContext = createContext(false)

/** Hide redundant entry actions without unmounting the profile or its tabs. */
export function ProfileEntryActions({ children }: { children: ReactNode }) {
  const composing = useContext(ProfileComposingContext)
  return composing ? null : <>{children}</>
}

/** Two independently scrolling panes in one dialog. Hidden panes stay mounted. */
export function ProfileComposerLayout({ open, header, profile, composer, onCancel }: {
  open: boolean; header: ReactNode; profile: ReactNode; composer: ReactNode; onCancel: () => void
}) {
  const mobile = useIsMobile()
  const setWidth = useContext(SlidePanelWidthContext)
  useEffect(() => {
    setWidth?.(mobile || open ? '100dvw' : '50dvw')
    return () => setWidth?.(undefined)
  }, [mobile, open, setWidth])
  const pane = { flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' as const, overflow: 'hidden' }
  return <ProfileComposingContext.Provider value={open}>
    {header}
    <div data-profile-composer-workspace style={{ display: 'flex', flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden' }}>
    <section aria-label="Profile" hidden={mobile && open} style={{ ...pane, containerType: 'inline-size', display: mobile && open ? 'none' : 'flex' }}>{profile}</section>
    <section aria-label="Message composer" hidden={!open} style={{ ...pane, display: open ? 'flex' : 'none', borderLeft: !mobile && open ? `1px solid ${colors.border}` : undefined }}><DialogTitleContext.Provider value={undefined}><ProfileComposerCancelContext.Provider value={onCancel}>{composer}</ProfileComposerCancelContext.Provider></DialogTitleContext.Provider></section>
  </div>
  </ProfileComposingContext.Provider>
}