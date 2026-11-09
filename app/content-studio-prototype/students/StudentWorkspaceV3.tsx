'use client'

import { InlineWorkspaceContext } from './AccountWorkspace'
import StudentWorkspaceV2 from './StudentWorkspaceV2'

/** Opt-in wider drawer; shares preview state and mutations with V2. */
export default function StudentWorkspaceV3() {
  return <InlineWorkspaceContext.Provider value={true}><StudentWorkspaceV2 inlineTasks /></InlineWorkspaceContext.Provider>
}
