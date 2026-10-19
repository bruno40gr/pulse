'use client'

import PrototypeEmailTemplates from '@/components/inbox/PrototypeEmailTemplates'
import type { MockRecipient, MockTemplate } from '@/lib/prototype-messaging'
import type { PrototypeChannel } from '@/lib/conversations-prototype'

export type TemplateProps = {
  channel: PrototypeChannel; templates: MockTemplate[]; onCreate: (template: MockTemplate) => void
  onApply: (template: MockTemplate, action: 'insert' | 'replace') => void
  triggerLabel?: string; compact?: boolean; initialOpen?: boolean; onDismiss?: () => void; previousEmails?: number
  currentBody: string; currentSubject?: string; person?: Pick<MockRecipient, 'name' | 'student'>
}


export default function PrototypeTemplates(props: TemplateProps) {
  return <PrototypeEmailTemplates key={props.person?.name || 'multiple'} {...props} />
}
