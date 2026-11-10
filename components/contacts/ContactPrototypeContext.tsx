'use client'

import { createContext } from 'react'

/** Only the isolated fictional review shell opts into simulated interactions. */
export const ContactPrototypeContext = createContext(false)

/** Optional preview navigation; absent in authenticated Contacts. */
export const ContactNameOpenContext = createContext<((id: string) => boolean) | undefined>(undefined)