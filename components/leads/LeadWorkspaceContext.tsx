'use client'

import { createContext, useContext } from 'react'

/** Explicit transport boundary. An absent adapter retains operational behavior. */
export type LeadWorkspaceAdapter = {
  request: (input: string, init?: RequestInit) => Promise<Response>
  isOwner: boolean
  matching?: { bands: { id: string; name: string }[] }
  onCreationClosed?: () => void
  onSendEnrollment?: (inquiryId: string) => void
  onBandEnrollment?: (studentId: string, bandId: string) => void
  creation?: {
    key: string
    fullName: string
    email: string
    phone: string
    students: import('@/lib/lead-students').LeadStudent[]
  }
}

export const LeadWorkspaceContext = createContext<LeadWorkspaceAdapter | undefined>(undefined)

export function useLeadWorkspaceRequest() {
  return useContext(LeadWorkspaceContext)?.request ?? fetch
}