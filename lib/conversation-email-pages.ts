/** Drain a selected-range query, including empty pages with a continuation. */
export async function loadConversationEmailPages<T>(
  loadPage: (cursor: string | null) => Promise<{ threads: T[]; nextCursor?: string | null }>,
  onPage: (threads: T[]) => void,
  cancelled: () => boolean,
) {
  const seen = new Set<string>()
  let cursor: string | null = null
  do {
    if (cancelled()) return
    const page = await loadPage(cursor)
    if (cancelled()) return
    onPage(page.threads)
    cursor = page.nextCursor || null
    if (cursor && seen.has(cursor)) throw new Error('Email pagination did not advance. Please retry.')
    if (cursor) seen.add(cursor)
  } while (cursor)
}