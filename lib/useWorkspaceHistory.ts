'use client'

import { useEffect, useRef } from 'react'

/** Opt-in, same-URL navigation. Does not alter existing mobile panel history. */
export function useWorkspaceHistory<T>(initial: T, restore: (state: T) => void, enabled = true) {
  const restoreRef = useRef(restore)
  const initialRef = useRef(initial)
  const session = useRef('')
  const depth = useRef(0)
  useEffect(() => { restoreRef.current = restore }, [restore])
  useEffect(() => {
    if (!enabled) return
    const key = 'odeonWorkspace'
    session.current = `${Date.now()}-${Math.random()}`
    const previous = window.history.state
    window.history.replaceState({ ...previous, [key]: { session: session.current, depth: 0, value: initialRef.current } }, '')
    const pop = (event: PopStateEvent) => {
      const entry = event.state?.[key]
      if (entry?.session !== session.current) return
      depth.current = entry.depth
      restoreRef.current(entry.value)
    }
    window.addEventListener('popstate', pop)
    return () => {
      window.removeEventListener('popstate', pop)
      // Do not leave stale workspace metadata in the current router entry.
      if (window.history.state?.[key]?.session === session.current) {
        const next = { ...window.history.state }
        delete next[key]
        window.history.replaceState(next, '')
      }
    }
  }, [enabled])
  return {
    navigate(value: T) {
      if (!enabled) { restoreRef.current(value); return }
      depth.current += 1
      window.history.pushState({ ...window.history.state, odeonWorkspace: { session: session.current, depth: depth.current, value } }, '')
      restoreRef.current(value)
    },
    close() {
      if (depth.current > 0) window.history.go(-depth.current)
      else restoreRef.current(initialRef.current)
    },
  }
}