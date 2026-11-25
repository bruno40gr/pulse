export type RelationshipBadge = 'Enrolled' | 'Disenrolled' | 'À la carte' | 'Service client'

type RelationshipContact = {
  relationship_badges?: RelationshipBadge[]
  is_student?: boolean
  student_id?: string | null
  client_status?: string | null
  status_class?: 'active' | 'inactive' | 'unknown'
  custom_fields?: Record<string, unknown> | null
}

/** Presentation of recorded classifications only; never infer clients from trial activity. */
export function contactRelationshipBadges(contact: RelationshipContact): RelationshipBadge[] {
  if (contact.relationship_badges) return contact.relationship_badges
  const badges: RelationshipBadge[] = []
  const kind = contact.custom_fields?.contact_kind
  const status = (contact.client_status || '').trim().toLowerCase()
  const isStudent = contact.is_student === true || (contact.is_student !== false && Boolean(contact.student_id))
  if (isStudent) {
    if (['à la carte', 'a la carte', 'a_la_carte'].includes(status)) badges.push('À la carte')
    else if (contact.status_class === 'active' || (!contact.status_class && ['active', 'member', 'enrolled'].includes(status))) badges.push('Enrolled')
    else if (contact.status_class === 'inactive' || (!contact.status_class && ['inactive', 'cancelled', 'dropped', 'disenrolled'].includes(status))) badges.push('Disenrolled')
  }
  if (kind === 'booking') badges.push('Service client')
  return badges
}

/** A returning student is enrolled, not simultaneously disenrolled. */
export function mergeRelationshipBadges(groups: RelationshipBadge[][]): RelationshipBadge[] {
  const badges = new Set(groups.flat())
  if (badges.has('Enrolled')) {
    badges.delete('Disenrolled')
    badges.delete('À la carte')
  } else if (badges.has('À la carte')) badges.delete('Disenrolled')
  return [...badges]
}