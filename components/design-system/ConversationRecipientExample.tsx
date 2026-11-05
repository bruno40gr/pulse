'use client'

import { useState } from 'react'
import { Button } from '@/components/ui'
import PrototypeNewMessage from '@/components/inbox/PrototypeNewMessage'
import { spacing } from '@/lib/tokens'

const people = ['Emma', 'Alex', 'Casey'].map((name, index) => ({ id: `sample-student-${index}`,
  name: 'Morgan Example', phone: '+12025550102', email: 'morgan@example.invalid', student: `${name} Example`,
}))

/** Same production picker, fictional identities, no send handler or API writes. */
export default function ConversationRecipientExample() {
  const [open, setOpen] = useState(false)
  const [selection, setSelection] = useState('')
  return <section style={{ marginTop: spacing.xl }} aria-label="Messaging recipient example">
    <h2>Family and student text recipients</h2>
    <Button onClick={() => setOpen(true)}>Review text recipient picker</Button>
    {selection && <p role="status">To: {selection} · Preview only; no message sent.</p>}
    <PrototypeNewMessage key={String(open)} initialChannel="sms" open={open} onClose={() => setOpen(false)} people={people}
      onEmail={() => setOpen(false)} onSms={() => { setSelection('Morgan Example'); setOpen(false) }} />
  </section>
}