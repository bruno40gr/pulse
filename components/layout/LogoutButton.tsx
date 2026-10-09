'use client'


import { ControlButton } from '@/components/ui/ControlButton'
import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useIdentity } from './IdentityProvider'

export default function LogoutButton({ onLogout }: { onLogout?: () => void }) {
  const router = useRouter()
  const { clearIdentity } = useIdentity()
  const [loading, setLoading] = useState(false)

  const handleLogout = async () => {
    if (loading) return
    setLoading(true)
    clearIdentity()
    try {
      await fetch('/api/access/logout', { method: 'POST' })
    } finally {
      window.localStorage.removeItem('pulse_active_tenant')
      onLogout?.()
      router.replace('/login')
      router.refresh()
    }
  }

  return (
    <ControlButton kind="navigation" inverse
      type="button"
      onClick={handleLogout}
      disabled={loading}
      style={{ width: '100%' }}
    >
      <LogOut size={16} />
      {loading ? 'Logging out…' : 'Log out'}
    </ControlButton>
  )
}