'use client'

import { useEffect, useState } from 'react'
import { Notice } from './Notice'

/** Show only after a save result, never on a selection or a locally dirty form. */
export function SaveStatusNotice({ status, automatic = false, onDismiss }: {
  status: 'saving' | 'saved' | 'error'; automatic?: boolean; onDismiss?: () => void;
}) {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    setVisible(true)
    if (status !== 'saved' || !automatic) return
    const timer = setTimeout(() => { setVisible(false) }, 5000)
    return () => clearTimeout(timer)
  }, [status, automatic])
  if (!visible) return null
  return <Notice variant={status === 'error' ? 'error' : status === 'saved' ? 'success' : 'info'} onDismiss={onDismiss}>
    {status === 'saving' ? 'Saving…' : status === 'error' ? 'Changes could not be saved. Try again.' : automatic ? 'Changes saved automatically.' : 'Changes saved.'}
  </Notice>
}