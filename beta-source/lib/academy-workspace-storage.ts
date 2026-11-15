import type { SetupRecord } from '../app/content-studio-prototype/school-setup/setup-content'
import type { FamilyPreviewData } from './academy-family-preview'
import type { MakeupPreviewState } from './academy-makeup-preview'

export const academyWorkspaceKey = 'odeon:app-sample:v2'
/** Missing preview routes and sign-in redirects return HTML, not API JSON. */
export async function readAcademyWorkspaceResponse(response: Response): Promise<{ state?: AcademyWorkspaceState; revision: number; error?: string }> {
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(response.status === 404
      ? 'Shared school storage is not available on this preview. Open the sample calendar to use your saved browser workspace.'
      : 'School storage returned a page instead of data. You may need to sign in again or use the sample calendar.')
  }
  let result
  try { result = await response.json() } catch { throw new Error('School storage returned invalid data. Your saved browser workspace has not been cleared.') }
  if (!response.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'School storage is unavailable. Your changes have not been saved to the school account.')
  if (!result || !Number.isSafeInteger(result.revision) || result.revision < 0) throw new Error('School storage returned an invalid revision. No changes have been written.')
  return result
}
export type AcademyWorkspaceState = { snapshot: { data: FamilyPreviewData; makeups: MakeupPreviewState }; setup: Record<string, SetupRecord[]> }
export function validAcademyWorkspace(value: unknown): value is AcademyWorkspaceState {
  if (!value || typeof value !== 'object') return false
  const state = value as AcademyWorkspaceState
  return Boolean(state.snapshot?.data && Array.isArray(state.snapshot.data.students) && Array.isArray(state.snapshot.data.accounts) && Array.isArray(state.snapshot.data.lessons) && state.snapshot.makeups && state.setup && ['teachers', 'locations', 'services', 'policies'].every(key => Array.isArray(state.setup[key])))
}

/** Migrate the old tab-scoped sandbox without silently overwriting a durable copy. */
export function loadLocalAcademyWorkspace(local: Storage, session: Storage): AcademyWorkspaceState | null {
  const durable = local.getItem(academyWorkspaceKey)
  const saved = durable || session.getItem(academyWorkspaceKey)
  if (!saved) return null
  const parsed: unknown = JSON.parse(saved)
  if (!validAcademyWorkspace(parsed)) throw new Error('The saved school workspace is invalid. It has not been overwritten.')
  if (!durable) {
    local.setItem(academyWorkspaceKey, saved)
    session.removeItem(academyWorkspaceKey)
  }
  return parsed
}

export function saveLocalAcademyWorkspace(local: Storage, state: AcademyWorkspaceState) {
  if (!validAcademyWorkspace(state)) throw new Error('The school workspace cannot be saved.')
  local.setItem(academyWorkspaceKey, JSON.stringify(state))
}