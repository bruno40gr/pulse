'use client'

import type { ComponentPropsWithoutRef, ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'
import styles from './Disclosure.module.css'
import { spacing } from '@/lib/tokens'

/** Shared, keyboard-accessible disclosure for thread history and collapsible sections. */
export function Disclosure({ summary, children, className, ...props }: Omit<ComponentPropsWithoutRef<'details'>, 'children'> & { summary: ReactNode; children: ReactNode }) {
  return <details {...props} className={[styles.disclosure, className].filter(Boolean).join(' ')}>
    <summary className={styles.summary} style={{ gap: spacing.sm }}><ChevronRight size={16} className={styles.chevron} aria-hidden="true" /><span className={styles.label}>{summary}</span></summary>
    {children}
  </details>
}