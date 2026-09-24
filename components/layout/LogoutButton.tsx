'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LogoutButton({ onLogout }: { onLogout?: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)
    try {
      await fetch('/api/access/logout', { method: 'POST' })
    } finally {
      window.localStorage.removeItem('pulse_active_tenant')
      onLogout?.()
      router.replace('/demo')
      router.refresh()
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', border: 'none', borderRadius: 8, background: 'transparent', color: '#B8B8B8', cursor: loading ? 'not-allowed' : 'pointer', fontSize: 14, textAlign: 'left', opacity: loading ? 0.6 : 1 }}
    >
      <LogOut size={16} />
      {loading ? 'Logging out…' : 'Log out'}
    </button>
  )
}