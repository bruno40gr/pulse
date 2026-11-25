import type { WorkflowDraft } from '@/beta-source/lib/academy-workflow-drafts'

export type BandCreationDraft = Extract<WorkflowDraft, { kind: 'group' }>
export const UUID_PATTERN = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i

/** Accept only the existing music-band workflow, never a sample workspace. */
export function validBandCreationDraft(value: unknown): value is BandCreationDraft {
  if (!value || typeof value !== 'object') return false
  const draft = value as BandCreationDraft
  const data = draft.data
  return draft.kind === 'group' && draft.institution === 'music' && UUID_PATTERN.test(draft.id)
    && Number.isInteger(draft.step) && draft.step >= 0 && draft.step <= 1
    && Array.isArray(draft.reviewedSteps) && draft.reviewedSteps.length <= 2
    && new Set(draft.reviewedSteps).size === draft.reviewedSteps.length && draft.reviewedSteps.every(step => step === 0 || step === 1)
    && !!data && data.id === draft.id && data.formation === true
    && typeof data.name === 'string' && data.name.length <= 200
    && typeof data.description === 'string' && data.description.length <= 10000
    && typeof data.leader === 'string' && (!data.leader || UUID_PATTERN.test(data.leader))
    && Array.isArray(data.memberIds) && data.memberIds.length <= 500
    && data.memberIds.every(id => typeof id === 'string' && UUID_PATTERN.test(id))
    && new Set(data.memberIds).size === data.memberIds.length
    && typeof data.typeId === 'string' && data.typeId === 'group-type-0'
}