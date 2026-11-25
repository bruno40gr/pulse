/** Explicit account membership only. Accounts remain distinct billing/routing identities. */
export type FamilyAccountLink = { family_account_id: string; member_account_id: string }
/** Read-only connected components of saved relationships, never payer or recipient changes. */
export function displayFamilyAccountLinks(explicit: FamilyAccountLink[], students: { id: string; account_id: string | null }[], memberships: { student_id: string; account_id: string }[]): FamilyAccountLink[] {
  const parents = new Map<string, string>()
  const root = (id: string): string => {
    const parent = parents.get(id)
    if (!parent || parent === id) return id
    const resolved = root(parent)
    parents.set(id, resolved)
    return resolved
  }
  const connect = (a: string, b: string) => {
    const left = root(a), right = root(b)
    parents.set(a, left); parents.set(b, right)
    if (left !== right) parents.set(right, left)
  }
  for (const link of explicit) connect(link.family_account_id, link.member_account_id)
  const primary = new Map(students.map(student => [student.id, student.account_id]))
  for (const membership of memberships) {
    const account = primary.get(membership.student_id)
    if (account) connect(account, membership.account_id)
  }
  const groups = new Map<string, string[]>()
  for (const id of parents.keys()) {
    const key = root(id), ids = groups.get(key) || []
    ids.push(id); groups.set(key, ids)
  }
  return [...groups.values()].flatMap(ids => {
    // Preserve explicit display anchors; otherwise prefer a student's saved primary account.
    const anchor = explicit.find(link => ids.includes(link.family_account_id))?.family_account_id
      || students.find(student => student.account_id && ids.includes(student.account_id)
        && memberships.some(member => member.student_id === student.id && member.account_id !== student.account_id))?.account_id
      || [...ids].sort()[0]
    return ids.filter(id => id !== anchor).map(id => ({ family_account_id: anchor, member_account_id: id }))
  })
}
export function familyAccountId(accountId: string, links: FamilyAccountLink[]) {
  return links.find(link => link.member_account_id === accountId)?.family_account_id || accountId
}

type Holder = { person_id?: string; account_id?: string; name: string | null }
export type DisplayAccountHolder = Holder & { phone?: string | null; email?: string | null; is_primary?: boolean }
/** Saved account summaries are visible even without a corresponding person row.
 * Display only: never feed these summaries into recipient selection. */
export function displayAccountHolders(members: { account_id?: string | null; account_holder_name?: string | null; account_holder_phone?: string | null; account_holder_email?: string | null; account_holders?: DisplayAccountHolder[] }[]) {
  const holders = new Map<string, DisplayAccountHolder>()
  for (const member of members) {
    const summaries = member.account_holders || []
    if (member.account_id && member.account_holder_name && !summaries.some(holder => holder.is_primary || holder.account_id === member.account_id)) {
      const key = `account:${member.account_id}`
      if (!holders.has(key)) holders.set(key, { account_id: member.account_id, name: member.account_holder_name,
        phone: member.account_holder_phone, email: member.account_holder_email, is_primary: true })
    }
    for (const holder of summaries) {
      const accountId = holder.account_id || (holder.is_primary ? member.account_id : null)
      const key = holder.person_id ? `person:${holder.person_id}` : accountId ? `account:${accountId}` : null
      if (key && holder.name && !holders.has(key)) holders.set(key, { ...holder, account_id: accountId || undefined })
    }
  }
  return [...holders.entries()].map(([id, holder]) => ({ ...holder, id }))
}
type Member = { id: string; is_student?: boolean; student_id?: string | null; account_holder_person_id?: string | null; account_holders?: Holder[] }
/** A holder's own student role is not a dependent. Do not infer identity from names. */
export function familyDependents<T extends Member>(members: T[]) {
  const holders = new Set(members.flatMap(member => [member.account_holder_person_id,
    ...(member.account_holders || []).map(holder => holder.person_id)].filter(Boolean)))
  return [...new Map(members.filter(member => !holders.has(member.id) && (member.is_student === true || (member.is_student !== false && Boolean(member.student_id))))
    .map(member => [member.id, member])).values()]
}