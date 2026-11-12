/** Drain a selected-range query, including empty pages with a continuation. */
export async function loadConversationEmailPages<T>(
  loadPage: (cursor: string | null) => Promise<{ threads: T[]; nextCursor?: string | null }>,
  onPage: (threads: T[]) => void,
  cancelled: () => boolean,
  wait: (milliseconds: number) => Promise<void> = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)),
) {
  const seen = new Set<string>()
  let cursor: string | null = null
  do {
    if (cancelled()) return
    let page: { threads: T[]; nextCursor?: string | null }
    for (let attempt = 0; ; attempt++) {
      try { page = await loadPage(cursor); break }
      catch (error) {
        if (cancelled()) return
        if (!error || typeof error !== 'object' || !('retryable' in error) || error.retryable !== true || attempt >= 5) throw error
        await wait(2000 * 2 ** attempt)
        if (cancelled()) return
      }
    }
    if (cancelled()) return
    onPage(page.threads)
    cursor = page.nextCursor || null
    if (cursor && seen.has(cursor)) throw new Error('Email pagination did not advance. Please retry.')
    if (cursor) seen.add(cursor)
    // Pace selected-range scans rather than bursting through provider quotas.
    if (cursor) await wait(500)
  } while (cursor)
}