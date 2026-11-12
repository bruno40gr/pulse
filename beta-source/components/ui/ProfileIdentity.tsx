'use client'

import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Avatar } from './Avatar'
import { colors, typography } from '@/beta-source/lib/tokens'

type Position = { x: number; y: number; width: number; height: number; time: number }
const positions = new Map<string, Position>()

/** Shared profile identity, including a position-preserving transition across task shells. */
export function ProfileIdentity({ title, subtitle, avatar, titleSize, titleId, headingLevel: Heading = 'h2', children, badge, animate = false }: {
  title: string; subtitle?: string; avatar?: { firstName: string; lastName: string; size?: number; src?: string }
  titleSize?: string; titleId?: string; headingLevel?: 'h1' | 'h2'; children?: ReactNode; badge?: ReactNode; animate?: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const element = ref.current
    if (!element || !animate) return
    const key = `${title}:${subtitle}`
    const previous = positions.get(key)
    const bounds = element.getBoundingClientRect()
    let animation: Animation | undefined
    if (previous && performance.now() - previous.time < 1500 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animation = element.animate([
        { transform: `translate(${previous.x - bounds.x}px, ${previous.y - bounds.y}px)` },
        { transform: 'translate(0, 0)' },
      ], { duration: 260, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' })
    }
    return () => {
      const rect = element.getBoundingClientRect()
      positions.set(key, { x: rect.x, y: rect.y, width: rect.width, height: rect.height, time: performance.now() })
      if (positions.size > 20) positions.delete(positions.keys().next().value!)
      animation?.cancel()
    }
  }, [title, subtitle, animate])
  return <div ref={ref} data-profile-identity="" style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flex: 1 }}>
    {avatar && <div data-profile-avatar=""><Avatar {...avatar} /></div>}
    <div style={{ minWidth: 0, flex: 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', minWidth: 0 }}>
        <Heading data-profile-name="" id={titleId} style={{ fontSize: titleSize || typography.h2.fontSize, fontWeight: typography.weightSemibold, margin: 0, color: colors.text, fontFamily: typography.fontSans, lineHeight: 1.2, overflowWrap: 'anywhere', wordBreak: 'break-word' }}>{title}</Heading>
        {children}
      </div>
      {subtitle && <div data-profile-subtitle="" style={{ fontSize: typography.sizeSm, color: colors.textSecondary, marginTop: '2px', fontFamily: typography.fontSans, overflowWrap: 'anywhere' }}>{subtitle}</div>}
      {badge && <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>{badge}</div>}
    </div>
  </div>
}