'use client'
import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { setActiveTenantId, getActiveTenantId } from '@/lib/tenant'

interface Tenant {
  id: string
  name: string
  is_demo: boolean
}

export default function TenantSwitcher({ hideOnDashboard = false }: { hideOnDashboard?: boolean }) {
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [active, setActive] = useState<string>('')
  const pathname = usePathname()

  useEffect(() => {
    setActive(getActiveTenantId())
    fetch('/api/tenant')
      .then(r => r.json())
      .then(data => setTenants(data))
  }, [])

  const handleChange = (id: string) => {
    setActiveTenantId(id)
    setActive(id)
    window.location.reload()
  }

  if (pathname.startsWith('/demo')) return null

  if (hideOnDashboard && (pathname.startsWith('/dashboard') || pathname.startsWith('/leads'))) return null

  if (!tenants.length) return null

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid #2A2A2A' }}>
      <div style={{ fontSize: '11px', color: '#6B6B6B', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Select Demo Account</div>
      <select
        value={active}
        onChange={e => handleChange(e.target.value)}
        style={{
          width: '100%',
          background: '#2A2A2A',
          color: 'white',
          border: '1px solid #3A3A3A',
          borderRadius: '6px',
          padding: '6px 8px',
          fontSize: '13px',
          cursor: 'pointer',
          fontFamily: 'sans-serif',
          outline: 'none',
        }}
      >
        {tenants.map(t => (
          <option key={t.id} value={t.id}>{t.name}</option>
        ))}
      </select>
    </div>
  )
}