'use client'

import { createContext, useEffect, useId, useRef, useState } from 'react'
import { isTopDialog, registerDialog } from '@/lib/dialog-stack'

export const DialogTitleContext = createContext<string | undefined>(undefined)

export function useDialogLayer(isOpen: boolean, onClose?: () => void, closeOnEscape = true) {
  const [mounted, setMounted] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const callbacks = useRef({ onClose, closeOnEscape })
  useEffect(() => { callbacks.current = { onClose, closeOnEscape } }, [onClose, closeOnEscape])
  useEffect(() => setMounted(true), [])
  useEffect(() => {
    if (!isOpen || !mounted || !rootRef.current || !dialogRef.current) return
    const dialog = dialogRef.current
    if (!dialog.hasAttribute('aria-label') && !document.getElementById(titleId)) {
      dialog.removeAttribute('aria-labelledby')
      dialog.setAttribute('aria-label', 'Details')
    }
    return registerDialog({ root: rootRef.current, dialog, dismiss: () => callbacks.current.onClose?.(), canEscape: () => callbacks.current.closeOnEscape && !!callbacks.current.onClose })
  }, [isOpen, mounted, titleId])
  return { mounted, rootRef, dialogRef, titleId, isTop: () => isTopDialog(rootRef.current) }
}