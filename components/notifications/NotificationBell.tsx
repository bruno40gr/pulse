'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { getActiveTenantId } from '@/lib/tenant'
import { colors, radius, shadows, spacing, typography } from '@/lib/tokens'

type NotificationItem = {
  id: string
  title: string
  body: string | null
  link: string
  read_at: string | null
  created_at: string
  actor_name: string
}

export default function NotificationBell({ inverse = false, variant = 'icon', onNavigate }: { inverse?: boolean; variant?: 'icon' | 'nav'; onNavigate?: () => void }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

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

  const markRead = async (id?: string) => {
    const tenantId = getActiveTenantId()
    await fetch(`/api/notifications?tenant=${tenantId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id } : { all: true }),
    }).catch(() => {})
    setNotifications((current) => current.map((item) => !id || item.id === id ? { ...item, read_at: item.read_at || new Date().toISOString() } : item))
    setUnreadCount((current) => id ? Math.max(0, current - (notifications.find((item) => item.id === id && !item.read_at) ? 1 : 0)) : 0)
  }

  const openNotification = async (item: NotificationItem) => {
    if (!item.read_at) await markRead(item.id)
    setOpen(false)
    onNavigate?.()
    router.push(item.link)
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        style={variant === 'nav'
          ? { position: 'relative', display: 'flex', alignItems: 'center', gap: spacing.sm, width: '100%', padding: '9px 12px', marginBottom: 2, border: 'none', borderRadius: radius.lg, background: open ? 'rgba(255,255,255,0.08)' : 'transparent', color: inverse ? colors.textMuted : colors.text, cursor: 'pointer', fontFamily: typography.fontSans, fontSize: typography.sizeMd, textAlign: 'left' }
          : { position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, border: 'none', borderRadius: radius.full, background: inverse ? 'rgba(255,255,255,0.08)' : colors.surface, color: inverse ? colors.surface : colors.text, cursor: 'pointer' }}
      >
        <Bell size={19} />
        {variant === 'nav' && <span>Notifications</span>}
        {unreadCount > 0 && (
          <span style={variant === 'nav'
            ? { marginLeft: 'auto', minWidth: 19, height: 19, padding: '0 5px', borderRadius: radius.full, background: colors.crimson, color: '#fff', fontSize: 10, fontWeight: typography.weightBold, lineHeight: '19px', textAlign: 'center' }
            : { position: 'absolute', top: -3, right: -3, minWidth: 17, height: 17, padding: '0 4px', borderRadius: radius.full, background: colors.crimson, color: '#fff', fontSize: 10, fontWeight: typography.weightBold, lineHeight: '17px', textAlign: 'center' }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: 'fixed', top: variant === 'nav' ? 76 : 12, left: variant === 'nav' ? 'min(220px, max(12px, calc(100vw - 372px)))' : 12, zIndex: 100, width: 'min(360px, calc(100vw - 24px))', maxHeight: 'min(480px, calc(100vh - 24px))', overflowY: 'auto', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, boxShadow: shadows.xl, color: colors.text }}>
          <div style={{ position: 'sticky', top: 0, zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, padding: spacing.lg, borderBottom: `1px solid ${colors.borderLight}`, background: colors.surface }}>
            <strong style={{ fontSize: typography.sizeMd }}>Notifications</strong>
            {unreadCount > 0 && <button type="button" onClick={() => void markRead()} style={{ border: 'none', background: 'transparent', color: colors.tealDark, cursor: 'pointer', fontSize: typography.sizeSm, fontWeight: typography.weightSemibold }}>Mark all read</button>}
          </div>
          {notifications.length === 0 ? (
            <div style={{ padding: spacing['2xl'], color: colors.textMuted, fontSize: typography.sizeSm }}>No notifications yet.</div>
          ) : notifications.map((item) => (
            <button key={item.id} type="button" onClick={() => void openNotification(item)} style={{ display: 'block', width: '100%', padding: spacing.lg, border: 'none', borderBottom: `1px solid ${colors.borderLight}`, background: item.read_at ? colors.surface : '#F0F9FB', color: colors.text, cursor: 'pointer', textAlign: 'left', fontFamily: typography.fontSans }}>
              <div style={{ fontSize: typography.sizeBase, fontWeight: item.read_at ? typography.weightMedium : typography.weightSemibold }}>{item.title}</div>
              <div style={{ marginTop: 3, color: colors.textSecondary, fontSize: typography.sizeSm, lineHeight: 1.4 }}>{item.actor_name}{item.body ? ` · ${item.body.replace(/\u00A0/g, ' ').slice(0, 120)}` : ''}</div>
              <div style={{ marginTop: 5, color: colors.textMuted, fontSize: typography.sizeXs }}>{new Date(item.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}