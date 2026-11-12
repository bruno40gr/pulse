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
  const mediaMatches = useMediaQuery(`(max-width: ${breakpointPx}px)`)
  const [viewportMatches, setViewportMatches] = useState(false)

  useEffect(() => {
    const sync = () => {
      const widths = [
        window.innerWidth,
        window.outerWidth,
        document.documentElement.clientWidth,
        window.visualViewport?.width,
        window.screen?.width,
        window.screen?.availWidth,
      ].filter((width): width is number => typeof width === 'number' && width > 0)

      setViewportMatches(widths.length > 0 && Math.min(...widths) <= breakpointPx)
    }

    sync()
    window.addEventListener('resize', sync)
    window.addEventListener('orientationchange', sync)
    window.visualViewport?.addEventListener('resize', sync)
    window.screen?.orientation?.addEventListener('change', sync)

    return () => {
      window.removeEventListener('resize', sync)
      window.removeEventListener('orientationchange', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      window.screen?.orientation?.removeEventListener('change', sync)
    }
  }, [breakpointPx])

  return mediaMatches || viewportMatches
}
