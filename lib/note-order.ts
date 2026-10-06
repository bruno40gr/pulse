export function sortNotes<T extends { id: string; pinned: boolean; created_at: string }>(notes: T[]): T[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      || a.id.localeCompare(b.id)
  })
}