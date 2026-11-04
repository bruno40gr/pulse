export type NoteTask = {
  description: string
  ownerId: string
  dueDate: string
  personId: string | null
}

export type TaskPerson = { id: string; name: string; kind: 'lead' | 'contact' }
export type TaskOwner = { id: string; name: string }

export function localNoteDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function noteDateOffset(days: number, today = new Date()): string {
  const date = new Date(today)
  date.setDate(date.getDate() + days)
  return localNoteDate(date)
}

export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T12:00:00Z`)
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function parseNoteTask(value: unknown): NoteTask {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Task details are required.')
  const task = value as Record<string, unknown>
  if (typeof task.description !== 'string' || !task.description.trim() || task.description.length > 20000) throw new Error('A task description of up to 20,000 characters is required.')
  if (typeof task.ownerId !== 'string' || !/^[0-9a-f-]{36}$/i.test(task.ownerId)) throw new Error('Select a staff owner.')
  if (!isCalendarDate(task.dueDate)) throw new Error('Select a valid due date.')
  if (task.personId !== null && (typeof task.personId !== 'string' || !/^(contact|lead):[0-9a-f-]{36}$/i.test(task.personId))) throw new Error('Select a related contact or lead, or clear the field.')
  return { description: task.description.trim(), ownerId: task.ownerId, dueDate: task.dueDate, personId: task.personId }
}

/** Match complete directory names, never a bare @, unknown token, or an email. */
export function mentionedTaskOwners(body: string, owners: TaskOwner[]): TaskOwner[] {
  const text = body.replace(/\u00a0/g, ' ').toLowerCase()
  return owners.map(owner => {
    const token = `@${owner.name.toLowerCase()}`
    let index = text.indexOf(token)
    while (index >= 0) {
      const before = text[index - 1]
      const after = text[index + token.length]
      if ((!before || !/[\p{L}\p{N}_@]/u.test(before)) && (!after || !/[\p{L}\p{N}_.@-]/u.test(after))) return { owner, index }
      index = text.indexOf(token, index + 1)
    }
    return null
  }).filter((match): match is { owner: TaskOwner; index: number } => !!match).sort((a, b) => a.index - b.index).map(match => match.owner)
}