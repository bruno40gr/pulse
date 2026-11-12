import { FieldLabel } from './FieldLabel'
import { FieldValue } from './FieldValue'

interface DetailFieldProps {
  label: string
  value?: string | null
  children?: React.ReactNode
  style?: React.CSSProperties
}

export function DetailField({ label, value, children, style }: DetailFieldProps) {
  return (
    <div style={style}>
      <FieldLabel>{label}</FieldLabel>
      {children || <FieldValue>{value || '\u2014'}</FieldValue>}
    </div>
  )
}