import { Badge } from '@/components/ui/Badge'
import { contactRelationshipBadges } from '@/lib/contact-relationship'

export function ContactRelationshipBadges({ contact, size = 'sm' }: { contact: Parameters<typeof contactRelationshipBadges>[0]; size?: 'sm' | 'md' }) {
  return <>{contactRelationshipBadges(contact).map(label => <Badge key={label} size={size} variant={label === 'Disenrolled' ? 'inactive' : 'info'}>{label}</Badge>)}</>
}