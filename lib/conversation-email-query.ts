/** Keep provider searches small and lead-scoped instead of scanning the mailbox. */
export function conversationEmailQuery(emails: string[], cursor: string | null) {
  const addresses = [...new Set(emails.map(email => email.trim().toLowerCase()))].sort()
  const groups = Array.from({ length: Math.ceil(addresses.length / 25) }, (_, index) => addresses.slice(index * 25, index * 25 + 25))
  let group = 0, page: string | null = cursor
  if (cursor?.startsWith('lead-range:')) {
    const decoded = JSON.parse(decodeURIComponent(cursor.slice(11)))
    if (!Number.isInteger(decoded.group) || decoded.group < 0 || decoded.group >= groups.length || (decoded.page !== null && typeof decoded.page !== 'string')) throw new Error('Invalid email cursor.')
    group = decoded.group; page = decoded.page
  }
  const audience = groups[group] || []
  return {
    audience: audience.length ? `{${audience.flatMap(email => [`from:${JSON.stringify(email)}`, `to:${JSON.stringify(email)}`, `cc:${JSON.stringify(email)}`]).join(' ')}}` : '',
    empty: !audience.length,
    page,
    nextCursor(nextPage: string | null) {
      if (!nextPage && group + 1 >= groups.length) return null
      // Preserve the provider cursor for a single group, including existing links.
      if (groups.length === 1) return nextPage
      return `lead-range:${encodeURIComponent(JSON.stringify({ group: nextPage ? group : group + 1, page: nextPage }))}`
    },
  }
}