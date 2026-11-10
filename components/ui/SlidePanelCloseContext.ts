'use client'

import { createContext } from 'react'

/** Defers owner unmount until the drawer's exit animation completes. */
export const SlidePanelCloseContext = createContext<(() => void) | undefined>(undefined)