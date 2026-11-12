'use client'

import { useEffect, useId, useRef, useState, type ComponentProps } from 'react'
import { LoadingButton } from '@/beta-source/components/ui'

/** A deliberate 1.5-second hold confirms; early release never performs the mutation. */
export function ConfirmActionButton({ onClick, loadingLabel = 'Saving changes', disabled, children, style, ...props }: Omit<ComponentProps<typeof LoadingButton>, 'onClick' | 'loading' | 'holdProgress'> & { onClick: () => void | Promise<void> }) {
  const description = useId()
  const active = useRef(false)
  const pending = useRef(false)
  const frame = useRef(0)
  const [progress, setProgress] = useState<number | undefined>()
  const [loading, setLoading] = useState(false)
  function cancel() {
    active.current = false
    cancelAnimationFrame(frame.current)
    setProgress(undefined)
  }
  useEffect(() => {
    const stop = () => { active.current = false; cancelAnimationFrame(frame.current); setProgress(undefined) }
    window.addEventListener('blur', stop)
    document.addEventListener('visibilitychange', stop)
    return () => { active.current = false; cancelAnimationFrame(frame.current); window.removeEventListener('blur', stop); document.removeEventListener('visibilitychange', stop) }
  }, [])
  useEffect(() => { if (disabled) { active.current = false; cancelAnimationFrame(frame.current); setProgress(undefined) } }, [disabled])
  function start() {
    if (disabled || active.current || pending.current) return
    active.current = true
    const started = performance.now()
    setProgress(0)
    const tick = async (now: number) => {
      if (!active.current) return
      const next = Math.min(100, (now - started) / 15)
      setProgress(next)
      if (next < 100) { frame.current = requestAnimationFrame(tick); return }
      active.current = false
      pending.current = true
      setProgress(undefined)
      setLoading(true)
      try { await onClick() } finally { pending.current = false; setLoading(false) }
    }
    frame.current = requestAnimationFrame(tick)
  }
  return <>
    <LoadingButton {...props} type="button" data-hold-confirm="" disabled={disabled} loading={loading} loadingLabel={loadingLabel} holdProgress={progress} aria-describedby={description} style={{ ...style, touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
      onClick={event => event.preventDefault()}
      onContextMenu={event => event.preventDefault()}
      onPointerDown={event => { if (!event.isPrimary || event.button !== 0) return; event.preventDefault(); event.currentTarget.focus(); event.currentTarget.setPointerCapture(event.pointerId); start() }}
      onPointerUp={cancel} onPointerCancel={cancel} onLostPointerCapture={cancel}
      onPointerMove={event => { const r = event.currentTarget.getBoundingClientRect(); if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) cancel() }}
      onBlur={cancel}
      onKeyDown={event => { if (event.key === 'Escape') { cancel(); return }; if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (!event.repeat) start() } }}
      onKeyUp={event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); cancel() } }}
    >{children}</LoadingButton>
    <span id={description} style={{ position: 'absolute', width: 1, height: 1, padding: 0, overflow: 'hidden', clipPath: 'inset(50%)', whiteSpace: 'nowrap' }}>Press and hold for 1.5 seconds to confirm. Release early to cancel. Keyboard: hold Space or Enter.</span>
  </>
}