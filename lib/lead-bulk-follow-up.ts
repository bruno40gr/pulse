export type FollowUpPatch = { follow_up_at?: string | null; follow_up_note?: string | null }
export type FollowUpDraft = { date: string; reminder: string; dateChanged: boolean; reminderChanged: boolean }

export function followUpPatch(draft: FollowUpDraft): FollowUpPatch {
  const patch: FollowUpPatch = {}
  if (draft.dateChanged) {
    const date = draft.date ? new Date(`${draft.date}T12:00:00`) : null
    if (date && (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date) || !Number.isFinite(date.getTime()) || date.getFullYear() !== Number(draft.date.slice(0, 4)) || date.getMonth() + 1 !== Number(draft.date.slice(5, 7)) || date.getDate() !== Number(draft.date.slice(8, 10)))) throw new Error('Choose a valid follow-up date.')
    patch.follow_up_at = date ? date.toISOString() : null
  }
  if (draft.reminderChanged) patch.follow_up_note = draft.reminder.trim() || null
  return patch
}

/** Sequential writes avoid flooding the existing permission-checked detail endpoint. */
export async function updateLeadFollowUps(ids: string[], patch: FollowUpPatch, save: (id: string, patch: FollowUpPatch) => Promise<void>) {
  const failed: { id: string; error: string }[] = []
  const succeeded: string[] = []
  for (const id of ids) {
    try { await save(id, patch); succeeded.push(id) }
    catch (error) { failed.push({ id, error: error instanceof Error ? error.message : 'Could not update follow-up.' }) }
  }
  return { succeeded, failed }
}