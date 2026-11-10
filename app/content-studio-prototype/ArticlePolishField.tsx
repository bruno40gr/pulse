'use client'

import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import styles from './studio.module.css'

export default function ArticlePolishField({ tenant, field, label, value, rows, hint, onChange }: {
  tenant: string
  field: 'summary' | 'body'
  label: string
  value: string
  rows: number
  hint?: string
  onChange: (value: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [original, setOriginal] = useState<string | null>(null)
  const controller = useRef<AbortController | null>(null)
  const latest = useRef(value)
  useEffect(() => { latest.current = value }, [value])
  useEffect(() => () => controller.current?.abort(), [])

  const polish = async () => {
    if (busy || !value.trim()) return
    const source = value
    setBusy(true)
    setError('')
    controller.current = new AbortController()
    try {
      const response = await fetch(`/api/website-content/generate?tenant=${encodeURIComponent(tenant)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ field, text: source }), signal: controller.current.signal,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'AI Polish couldn’t finish. Please try again.')
      if (typeof result.text !== 'string' || !result.text.trim()) throw new Error('AI Polish couldn’t finish. Your writing hasn’t changed.')
      if (latest.current !== source) throw new Error('You edited this text while AI Polish was working. Your changes have been kept. Try again to polish the latest version.')
      setOriginal(source)
      onChange(result.text)
    } catch (issue) {
      if (!controller.current?.signal.aborted) setError(issue instanceof Error ? issue.message : 'AI Polish couldn’t finish. Your writing hasn’t changed.')
    } finally { setBusy(false) }
  }

  return <div>
    <div className={styles.fieldHeader}>
      <label htmlFor={`studio-${field}`}>{label}</label>
      <div className={styles.fieldActions}>
        {original !== null && <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => { onChange(original); setOriginal(null) }}>Undo polish</Button>}
        <Button type="button" variant="secondary" size="sm" aria-label={`AI Polish ${label.toLowerCase()}`} disabled={busy || !value.trim()} onClick={() => void polish()}>{busy ? 'Polishing…' : 'AI Polish'}</Button>
      </div>
    </div>
    <Textarea id={`studio-${field}`} rows={rows} value={value} onChange={event => { setOriginal(null); onChange(event.target.value) }} hint={hint} aria-busy={busy} />
    {busy && <p role="status">Polishing your {label.toLowerCase()}…</p>}
    {error && <p role="alert">{error}</p>}
  </div>
}