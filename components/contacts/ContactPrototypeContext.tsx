'use client'

import { createContext } from 'react'

/** Only the isolated fictional review shell opts into simulated interactions. */
export const ContactPrototypeContext = createContext(false)

/** Optional preview navigation; absent in authenticated Contacts. */
export const ContactNameOpenContext = createContext<((id: string) => boolean) | undefined>(undefined)
/** Fictional rows only; suppress operational reads and writes in the sandbox. */
export const ContactSampleContext = createContext<{
  contacts?: import('@/app/dashboard/contacts/page').Contact[];
  onOpen?: (id: string) => boolean;
  onEnroll?: (ids: string[]) => void;
  onCreateOpportunity?: (ids: string[]) => void;
  onCreateBand?: (ids: string[]) => void;
}>({})

/** Explicit fictional band-membership content; absent in operational Contacts. */
export const ContactBandEnrollmentContext = createContext<((id: string) => import('react').ReactNode) | undefined>(undefined)
