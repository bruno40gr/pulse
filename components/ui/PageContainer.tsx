'use client'

import { createContext, useContext } from 'react'
import { spacing } from '@/lib/tokens'

const PageLayoutContext = createContext(false)

interface PageContainerProps {
  children: React.ReactNode
  maxWidth?: string | number
  style?: React.CSSProperties
}

/**
 * Standard dashboard page shell — 28px (spacing['3xl']) padding, left-aligned,
 * full-width by default. Use with `PageHeader` so every page title sits on the
 * same axis. Nested containers inherit the existing inset instead of adding another.
 * Pass `maxWidth` to constrain wide content (e.g. '900px').
 */
export function PageContainer({ children, maxWidth = '100%', style }: PageContainerProps) {
  const nested = useContext(PageLayoutContext)
  return (
    <div data-page-container={nested ? 'nested' : 'root'} style={{ padding: nested ? 0 : spacing['3xl'], width: '100%', maxWidth, minWidth: 0, boxSizing: 'border-box', ...style }}>
      <PageLayoutContext.Provider value={true}>{children}</PageLayoutContext.Provider>
    </div>
  )
}
