'use client'

import { InlineWorkspaceContext } from './AccountWorkspace'
import StudentWorkspaceV2 from './StudentWorkspaceV2'
import type { ComponentProps } from 'react'

/** Opt-in wider drawer; shares preview state and mutations with V2. */
export default function StudentWorkspaceV3(props: ComponentProps<typeof StudentWorkspaceV2> = {}) {
  return <InlineWorkspaceContext.Provider value={true}><StudentWorkspaceV2 {...props} inlineTasks /></InlineWorkspaceContext.Provider>
}
