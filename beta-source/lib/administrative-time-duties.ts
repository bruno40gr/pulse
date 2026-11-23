import type { SetupRecord } from '../app/content-studio-prototype/school-setup/setup-content'

export const administrativeTimeDescription = 'Configure duties for teachers and staff to carry out when they’re not teaching. These duties will be available in the calendar when you schedule administrative time.'

/** Removal archives saved duties; their IDs and historical booking labels survive. */
export function saveAdministrativeDuties(previous: SetupRecord[], draft: SetupRecord[]): SetupRecord[] {
  if (draft.some(item => !item.id || !item.values.name?.trim()) || new Set(draft.map(item => item.id)).size !== draft.length) throw new Error('Enter a name for each duty, or remove the empty row.')
  const names = draft.map(item => item.values.name.trim().toLocaleLowerCase())
  if (new Set(names).size !== names.length) throw new Error('Give each duty a different name.')
  const active = draft.map(item => ({ ...item, values: { ...item.values, name: item.values.name.trim(), enabled: 'Yes' } }))
  const removed = previous.filter(item => !draft.some(row => row.id === item.id)).map(item => ({ ...item, values: { ...item.values, enabled: 'No' } }))
  return [...active, ...removed]
}