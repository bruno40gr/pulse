'use client'

import { useCallback, useEffect, useRef } from 'react'

interface MobilePanelHistoryOptions {
  isOpen: boolean
  isMobile: boolean
  historyKey: string
  onClose: () => void
}

export function useMobilePanelHistory({ isOpen, isMobile, historyKey, onClose }: MobilePanelHistoryOptions) {
  const historyEntryActiveRef = useRef(false)
  const isOpenRef = useRef(isOpen)
  const onCloseRef = useRef(onClose)
  const pendingDismissActionRef = useRef<(() => void) | null>(null)

  isOpenRef.current = isOpen
  onCloseRef.current = onClose

  useEffect(() => {
    if (!isMobile || !isOpen || historyEntryActiveRef.current) return

    window.history.pushState(
      { ...window.history.state, [historyKey]: true },
      '',
      window.location.href,
    )
    historyEntryActiveRef.current = true
  }, [historyKey, isMobile, isOpen])

  useEffect(() => {
    if (!isMobile) {
      historyEntryActiveRef.current = false
      return
    }

    const handlePopState = (event: PopStateEvent) => {
      const historyEntryActive = Boolean(event.state?.[historyKey])
      historyEntryActiveRef.current = historyEntryActive
      if (!historyEntryActive && isOpenRef.current) {
        onCloseRef.current()
        const pendingAction = pendingDismissActionRef.current
        pendingDismissActionRef.current = null
        pendingAction?.()
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [historyKey, isMobile])

  const closePanel = useCallback(() => {
    if (isMobile && historyEntryActiveRef.current) {
      window.history.back()
      return
    }
    onCloseRef.current()
  }, [isMobile])

  const dismissPanel = useCallback((afterDismiss?: () => void) => {
    if (isMobile && historyEntryActiveRef.current) {
      pendingDismissActionRef.current = afterDismiss || null
      window.history.back()
      return
    }
    onCloseRef.current()
    afterDismiss?.()
  }, [isMobile])

  return { closePanel, dismissPanel }
}