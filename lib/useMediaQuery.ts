'use client'

import { useEffect, useState } from 'react'

/**
 * SSR-safe media query hook. Returns `false` on the first (server) render to
 * avoid hydration mismatches, then syncs to the real value after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)

    const sync = (value: boolean) => setMatches(value)
    sync(mediaQuery.matches)

    const handleChange = (event: MediaQueryListEvent) => sync(event.matches)
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange)
      return () => mediaQuery.removeEventListener('change', handleChange)
    }

    // Safari < 14 fallback
    mediaQuery.addListener(handleChange)
    return () => mediaQuery.removeListener(handleChange)
  }, [query])

  return matches
}

export function useIsMobile(breakpointPx = 960): boolean {
  return useMediaQuery(`(max-width: ${breakpointPx}px)`)
}
