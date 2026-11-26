'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { getActiveTenantId } from '@/lib/tenant'
import SignedInUser from '@/components/layout/SignedInUser'
import { Modal, ModalHeader } from '@/components/ui/Modal'
import { notificationSummary } from '@/lib/notification-summary'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton'
import { colors, radius, spacing, typography } from '@/lib/tokens'
import { startVisiblePolling } from '@/lib/visible-polling'

type NotificationItem = {
  id: string
  title: string
  body: string | null
  link: string
  read_at: string | null
  dismissed_at: string | null
  created_at: string
  actor_name: string
}

export default function NotificationBell({ inverse = false, variant = 'icon', onNavigate }: { inverse?: boolean; variant?: 'icon' | 'nav' | 'user'; onNavigate?: () => void }) {
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [mentionsOnly, setMentionsOnly] = useState(false)
  const [history, setHistory] = useState(false)
  const [offset, setOffset] = useState(0)
  const [hasMore, setHasMore] = useState(false)
  const [ready, setReady] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pollerRef = useRef<ReturnType<typeof startVisiblePolling> | null>(null)

  const load = useCallback(async (signal: AbortSignal) => {
    const tenantId = getActiveTenantId()
    try {
      const response = await fetch(`/api/notifications?tenant=${encodeURIComponent(tenantId)}&limit=30&offset=${offset}&mentions=${mentionsOnly}&history=${history}`, { signal, cache: 'no-store' })
      if (!response.ok) throw new Error('Could not load notifications. Please retry.')
      const data = await response.json()
      if (signal.aborted || tenantId !== getActiveTenantId()) return
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setUnreadCount(typeof data.unread_count === 'number' ? data.unread_count : 0)
      setHasMore(data.has_more === true)
      setReady(true)
      setError(null)
    } catch {
      if (!signal.aborted) { setError('Could not load notifications. Please retry.'); setReady(true) }
    }
  }, [offset, mentionsOnly, history])

  useEffect(() => {
    const poller = startVisiblePolling(load)
    pollerRef.current = poller
    return () => { poller.stop(); pollerRef.current = null }
  }, [load])

  const close = useCallback(() => setOpen(false), [])

  const dismissNotification = async (id?: string) => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/notifications?tenant=${encodeURIComponent(getActiveTenantId())}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(id ? { id, action: 'dismiss' } : { all: true, action: 'dismiss' }),
      })
      if (!response.ok) throw new Error('Unable to dismiss notification. Please retry.')
      setNotifications(current => history ? current.map(item => !id || item.id === id ? { ...item, dismissed_at: new Date().toISOString() } : item) : id ? current.filter(item => item.id !== id) : [])
      pollerRef.current?.refresh()
    } catch {
      setError('Unable to dismiss notification. Please retry.')
    } finally {
      setSaving(false)
    }
  }

  const openNotification = async (item: NotificationItem) => {
    if (saving) return
    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/notifications?tenant=${encodeURIComponent(getActiveTenantId())}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: item.id, action: 'seen' }),
      })
      if (!response.ok) throw new Error('Unable to mark notification seen.')
      setNotifications(current => current.map(value => value.id === item.id ? { ...value, read_at: value.read_at || new Date().toISOString() } : value))
      pollerRef.current?.refresh()
    } catch {
      setError('Unable to mark notification seen. Please retry.')
      return
    } finally {
      setSaving(false)
    }
    setOpen(false)
    onNavigate?.()
    // A document navigation also reopens an already-mounted destination,
    // including repeated opens of the same notification.
    window.location.assign(item.link)
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <ControlButton kind={variant === 'icon' ? 'icon' : 'navigation'} selected={open} inverse={inverse}
        type="button"
        onClick={() => { setOpen(current => !current); pollerRef.current?.refresh() }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        style={{ position: 'relative' }}
      >
        {variant === 'user' ? <SignedInUser compact /> : <Bell size={19} />}
        {variant === 'nav' && <span>Notifications</span>}
        {unreadCount > 0 && (
          <span aria-label={`${unreadCount} unread notifications`} style={{ marginLeft: 'auto', minWidth: 26, height: 26, padding: '0 6px', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderRadius: radius.full, background: colors.crimson, color: '#fff', fontSize: typography.sizeSm, fontWeight: typography.weightBold, fontVariantNumeric: 'tabular-nums' }}>{unreadCount}</span>
        )}
      </ControlButton>
      <Modal isOpen={open} onClose={close} size="notifications" ariaLabel="Notifications">
        <ModalHeader title="Notifications" onClose={close} />
        <div style={{ overflowY: 'auto', padding: spacing.lg }}>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md }}>
            <Select label="Notifications" value={mentionsOnly ? 'mentions' : 'all'} disabled={saving} onChange={event => { setReady(false); setError(null); setNotifications([]); setOffset(0); setMentionsOnly(event.target.value === 'mentions') }}>
              <option value="all">All notifications</option><option value="mentions">My mentions</option>
            </Select>
            <Select label="View" value={history ? 'history' : 'inbox'} disabled={saving} onChange={event => { setReady(false); setError(null); setNotifications([]); setOffset(0); setHistory(event.target.value === 'history') }}>
              <option value="inbox">Inbox</option><option value="history">History (including dismissed)</option>
            </Select>
          </div>
          {error && <p role="alert" style={{ color: colors.crimson }}>{error} <Button variant="secondary" size="sm" onClick={() => pollerRef.current?.refresh()}>Retry</Button></p>}
          {ready && !history && !mentionsOnly && notifications.length > 0 && <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void dismissNotification()} style={{ marginBottom: spacing.md }}>Dismiss all notifications</Button>}
          {!ready ? <LoadingSkeleton label="Loading notifications" /> : notifications.length === 0 ? !error && <p style={{ color: colors.textMuted }}>No {mentionsOnly ? 'mentions' : 'notifications'} in this view.</p> : notifications.map(item => (
            <div key={item.id} style={{ padding: spacing.md, marginBottom: spacing.sm, border: `1px solid ${colors.border}`, borderRadius: radius.lg, background: item.read_at ? colors.surface : '#F0F9FB' }}>
              <p style={{ margin: 0, color: colors.text, fontSize: typography.sizeBase, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{notificationSummary(item)}</p>
              <p style={{ color: colors.textMuted, fontSize: typography.sizeSm }}><time dateTime={item.created_at}>{new Date(item.created_at).toLocaleString()}</time> · {item.read_at ? 'Read' : 'Unread'}{item.dismissed_at ? ' · Dismissed' : ''}</p>
               <div style={{ marginTop: spacing.sm, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm }}>
                 <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void openNotification(item)}>Open</Button>
                  {!item.dismissed_at && <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void dismissNotification(item.id)}>Dismiss</Button>}
              </div>
            </div>
          ))}
          {ready && <div style={{ display: 'flex', justifyContent: 'space-between', gap: spacing.sm }}>
            <Button variant="secondary" size="sm" disabled={saving || offset === 0} onClick={() => { setReady(false); setNotifications([]); setOffset(current => Math.max(0, current - 30)) }}>Newer</Button>
            <Button variant="secondary" size="sm" disabled={saving || !hasMore} onClick={() => { setReady(false); setNotifications([]); setOffset(current => current + 30) }}>Older</Button>
          </div>}
        </div>
      </Modal>
    </div>
  )
}
