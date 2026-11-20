'use client'

import { MultiSelect } from '@/components/ui/MultiSelect'

/** Student fields store multi-values as a comma-separated string. */
export function StudentMultiSelect(props: {
  label: string
  ariaLabel: string
  value: string
  options: { value: string; label: string; disabled?: boolean }[]
  onChange: (value: string) => void
  selectionSummary?: string
  minSelected?: number
  menuMinWidth?: number
  appearance?: 'field' | 'subtle'
  summaryLabels?: string[]
}) {
  return <MultiSelect {...props} value={props.value.split(',').map(item => item.trim()).filter(Boolean)} onChange={next => props.onChange(next.join(', '))} />
}
