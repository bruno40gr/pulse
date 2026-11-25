/** Explicit account membership only. Accounts remain distinct billing/routing identities. */
export type FamilyAccountLink = { family_account_id: string; member_account_id: string }
export function familyAccountId(accountId: string, links: FamilyAccountLink[]) {
  return links.find(link => link.member_account_id === accountId)?.family_account_id || accountId
}

type Holder = { person_id?: string; account_id?: string; name: string | null }
type Member = { id: string; is_student?: boolean; student_id?: string | null; account_holder_person_id?: string | null; account_holders?: Holder[] }
/** A holder's own student role is not a dependent. Do not infer identity from names. */
export function familyDependents<T extends Member>(members: T[]) {
  const holders = new Set(members.flatMap(member => [member.account_holder_person_id,
    ...(member.account_holders || []).map(holder => holder.person_id)].filter(Boolean)))
  return [...new Map(members.filter(member => !holders.has(member.id) && (member.is_student === true || (member.is_student !== false && Boolean(member.student_id))))
    .map(member => [member.id, member])).values()]
}