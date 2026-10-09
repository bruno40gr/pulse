'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell } from 'lucide-react'
import { getActiveTenantId } from '@/lib/tenant'
import SignedInUser from '@/components/layout/SignedInUser'
import { Modal, ModalHeader } from '@/components/ui/Modal'
import { notificationSummary } from '@/lib/notification-summary'
import { Button } from '@/components/ui/Button'
import { colors, radius, spacing, typography } from '@/lib/tokens'

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
  const rootRef = useRef<HTMLDivElement>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    const tenantId = getActiveTenantId()
    try {
      const response = await fetch(`/api/notifications?tenant=${tenantId}&limit=30`)
      if (!response.ok) return
      const data = await response.json()
      setNotifications(Array.isArray(data.notifications) ? data.notifications : [])
      setUnreadCount(typeof data.unread_count === 'number' ? data.unread_count : 0)
    } catch {}
  }, [])

  useEffect(() => {
    void load()
    const interval = window.setInterval(() => void load(), 60_000)
    return () => window.clearInterval(interval)
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
      setNotifications(current => id ? current.filter(item => item.id !== id) : [])
      await load()
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
      await load()
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
        onClick={() => { setOpen(current => !current); void load() }}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        style={{ position: 'relative' }}
      >
        {variant === 'user' ? <SignedInUser compact /> : <Bell size={19} />}
        {variant === 'nav' && <span>Notifications</span>}
        {unreadCount > 0 && (
          variant === 'user'
            ? <span aria-label={`${unreadCount} unread notifications`} style={{ marginLeft: 'auto', width: 8, height: 8, flexShrink: 0, borderRadius: '50%', background: colors.crimson }} />
            : <span style={{ marginLeft: 'auto', borderRadius: radius.full, background: colors.crimson, color: '#fff', padding: '2px 6px', fontSize: 10 }}>{unreadCount}</span>
        )}
      </ControlButton>
      <Modal isOpen={open} onClose={close} size="notifications" ariaLabel="Notifications">
        <ModalHeader title="Notifications" onClose={close} />
        <div style={{ overflowY: 'auto', padding: spacing.lg }}>
          {error && <p role="alert" style={{ color: colors.crimson }}>{error}</p>}
          {notifications.length > 0 && <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void dismissNotification()} style={{ marginBottom: spacing.md }}>Dismiss all</Button>}
          {notifications.length === 0 ? <p style={{ color: colors.textMuted }}>No notifications yet.</p> : notifications.map(item => (
            <div key={item.id} style={{ padding: spacing.md, marginBottom: spacing.sm, border: `1px solid ${colors.border}`, borderRadius: radius.lg, background: item.read_at ? colors.surface : '#F0F9FB' }}>
              <p style={{ margin: 0, color: colors.text, fontSize: typography.sizeBase, lineHeight: 1.5, overflowWrap: 'anywhere' }}>{notificationSummary(item)}</p>
               <div style={{ marginTop: spacing.sm, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm }}>
                 <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void openNotification(item)}>Open</Button>
                 <Button type="button" size="sm" variant="secondary" disabled={saving} onClick={() => void dismissNotification(item.id)}>Dismiss</Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  )
}
