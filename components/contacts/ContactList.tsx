'use client'
import { useEffect, useState } from 'react'
import { House } from 'lucide-react'
import { Badge } from '@/components/ui'
import { colors, typography } from '@/lib/tokens'
import CSVImporter from './CSVImporter'
import { getActiveTenantId } from '@/lib/tenant'

interface ContactListProps {
  selectedContactIds: string[]
  onContactsLoaded: (contacts: any[]) => void
}

export default function ContactList({ selectedContactIds, onContactsLoaded }: ContactListProps) {
  const [contacts, setContacts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [isImporterOpen, setIsImporterOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function loadContacts() {
      setLoading(true)
      try {
        const response = await fetch(`/api/contacts?tenant=${getActiveTenantId()}`)
        const data = await response.json()
        if (!cancelled) {
          setContacts(data)
          onContactsLoaded(data)
        }
      } catch (error) {
        console.error('Failed to load contacts:', error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    loadContacts()
    return () => {
      cancelled = true
    }
  }, [onContactsLoaded])

  const handleImportComplete = async () => {
    try {
      const response = await fetch(`/api/contacts?tenant=${getActiveTenantId()}`)
      const data = await response.json()
      setContacts(data)
      onContactsLoaded(data)
    } catch (error) {
      console.error('Failed to refresh contacts:', error)
    }
  }

  if (loading) {
    return (
      <div style={{ background: 'white', border: '1px solid #E8E8E4', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #E8E8E4' }}>
          <div style={{ height: '28px', width: '120px', background: '#F1F1EF', borderRadius: '6px' }} />
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: 'flex', gap: '16px', padding: '14px 24px', borderBottom: i < 4 ? '1px solid #F5F5F4' : 'none' }}>
            <div style={{ width: '18px', height: '18px', background: '#F1F1EF', borderRadius: '4px', flexShrink: 0 }} />
            <div style={{ flex: 1, height: '14px', background: '#F1F1EF', borderRadius: '4px' }} />
            <div style={{ flex: 1.2, height: '14px', background: '#F1F1EF', borderRadius: '4px' }} />
            <div style={{ flex: 1.5, height: '14px', background: '#F1F1EF', borderRadius: '4px' }} />
            <div style={{ flex: 1, height: '14px', background: '#F1F1EF', borderRadius: '4px' }} />
          </div>
        ))}
      </div>
    )
  }

  if (contacts.length === 0) {
    return (
      <div style={{ background: 'white', border: '1px solid #E8E8E4', borderRadius: '12px', padding: '64px 24px', textAlign: 'center' }}>
        <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#1A1A1A', margin: '0 0 8px', fontFamily: 'sans-serif' }}>No contacts yet</h3>
        <p style={{ color: '#6B6B6B', fontSize: '14px', margin: '0 0 24px', fontFamily: 'sans-serif' }}>Import your contacts to get started</p>
        <button
          onClick={() => setIsImporterOpen(true)}
          style={{
            padding: '10px 20px',
            background: '#C8392B',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'sans-serif',
          }}
        >
          Import CSV
        </button>
        <CSVImporter isOpen={isImporterOpen} onClose={() => setIsImporterOpen(false)} onImportComplete={handleImportComplete} />
      </div>
    )
  }

  return (
    <div style={{ background: 'white', border: '1px solid #E8E8E4', borderRadius: '12px', overflow: 'hidden' }}>
      {/* Table header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid #E8E8E4' }}>
        <span style={{ fontSize: '13px', color: '#6B6B6B', fontFamily: 'sans-serif' }}>{contacts.length} contacts</span>
        <button
          onClick={() => setIsImporterOpen(true)}
          style={{
            padding: '8px 16px',
            background: '#C8392B',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'sans-serif',
          }}
        >
          Import CSV
        </button>
      </div>

      {/* Table */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#6B6B6B', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            <th style={{ padding: '10px 24px', borderBottom: '1px solid #E8E8E4', fontWeight: 600, width: '32px' }}>
              <input type="checkbox" checked={false} onChange={() => {}} />
            </th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Name</th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Instrument</th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Phone</th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Email</th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Service</th>
            <th style={{ padding: '10px 12px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Instructor</th>
            <th style={{ padding: '10px 24px', borderBottom: '1px solid #E8E8E4', fontWeight: 600 }}>Status</th>
          </tr>
        </thead>
        <tbody>
          {contacts.map((contact) => {
            const isSelected = selectedContactIds.includes(contact.id)
            const instrument = contact.custom_fields?.instrument
            const serviceType = contact.custom_fields?.service_type
            const instructor = contact.custom_fields?.instructor
            return (
              <tr
                key={contact.id}
                style={{
                  background: isSelected ? '#FFF5F5' : 'white',
                  borderBottom: '1px solid #F5F5F4',
                  color: '#1A1A1A',
                }}
              >
                <td style={{ padding: '12px 24px' }}>
                  <input type="checkbox" checked={isSelected} readOnly />
                </td>
                <td style={{ padding: '12px', fontWeight: 500 }}>
                  {contact.first_name} {contact.last_name}
                </td>
                <td style={{ padding: '12px', color: '#6B6B6B' }}>{instrument || '—'}</td>
                <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#6B6B6B' }}>
                  {(() => {
                    const phone = contact.phone || contact.account_holder_phone
                    const showIcon = contact.is_minor || contact.message_routing === 'account_holder'
                    if (!phone) return <span style={{ color: '#A0A0A0' }}>—</span>
                    return (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span>{phone}</span>
                        {showIcon && <House size={12} color="#A0A0A0" strokeWidth={1.5} />}
                      </span>
                    )
                  })()}
                </td>
                <td style={{ padding: '12px', color: '#6B6B6B' }}>{contact.email || '—'}</td>
                <td style={{ padding: '12px', color: '#6B6B6B' }}>{serviceType || '—'}</td>
                <td style={{ padding: '12px', color: '#6B6B6B' }}>{instructor || '—'}</td>
                <td style={{ padding: '12px 24px' }}>
                  <Badge variant={
                    contact.opted_out ? 'error' :
                    contact.client_status === 'active' ? 'success' :
                    contact.client_status === 'pending' ? 'warning' :
                    contact.client_status === 'inactive' ? 'neutral' :
                    contact.client_status === 'lead' ? 'info' :
                    'neutral'
                  }>
                    {contact.client_status || '—'}
                  </Badge>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <CSVImporter isOpen={isImporterOpen} onClose={() => setIsImporterOpen(false)} onImportComplete={handleImportComplete} />
    </div>
  )
}