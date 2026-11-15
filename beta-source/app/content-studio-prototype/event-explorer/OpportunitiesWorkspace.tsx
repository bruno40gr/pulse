'use client'

import LeadsView from '@/components/leads/LeadsView'
import { ContactPrototypeContext } from '@/components/contacts/ContactPrototypeContext'
import type { LeadWorkspaceAdapter } from '@/components/leads/LeadWorkspaceContext'

export default function OpportunitiesWorkspace({ adapter, matching = false }: { adapter: LeadWorkspaceAdapter; matching?: boolean }) {
  return <ContactPrototypeContext.Provider value><LeadsView adapter={adapter} matching={matching} /></ContactPrototypeContext.Provider>
}
