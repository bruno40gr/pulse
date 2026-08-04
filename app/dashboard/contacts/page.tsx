'use client'
import { useState, useEffect, useRef } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { SlidersHorizontal, X, Send } from 'lucide-react'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import CSVImporter from '@/components/contacts/CSVImporter'
import ComposePanel from '@/components/campaigns/ComposePanel'

interface Contact {
  id: string
  first_name: string
  last_name: string
  phone: string | null
  email: string | null
  client_status: string
  opted_out: boolean
  last_attended: string | null
  notes: string | null
  family_name: string | null
  account_holder_name: string | null
  account_holder_phone: string | null
  account_holder_email: string | null
  custom_fields: Record<string, any>
}

interface TenantField {
  field_key: string
  field_label: string
  field_type: string
  field_options: string[] | null
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tenantFields, setTenantFields] = useState<TenantField[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [filterExplanation, setFilterExplanation] = useState('')
  const [displayIds, setDisplayIds] = useState<string[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({})
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [isImporterOpen, setIsImporterOpen] = useState(false)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1)
  const tenantId = getActiveTenantId()

  useEffect(() => {
    Promise.all([
      fetch(`/api/contacts?tenant=${tenantId}`).then(r => r.json()),
      fetch(`/api/tenant-fields?tenant=${tenantId}`).then(r => r.json()),
    ]).then(([contactData, fieldData]) => {
      setContacts(Array.isArray(contactData) ? contactData : [])
      setTenantFields(Array.isArray(fieldData) ? fieldData : [])
      setLoading(false)
    })
  }, [])

  const handleSearch = async () => {
    if (!query.trim()) {
      setDisplayIds(null)
      setFilterExplanation('')
      return
    }
    setAiLoading(true)
    try {
      const res = await fetch('/api/ai-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, tenant: tenantId }),
      })
      const data = await res.json()
      if (data.contact_ids) {
        setDisplayIds(data.contact_ids)
        setFilterExplanation(data.explanation || '')
        setSelectedIds(new Set(data.contact_ids))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setAiLoading(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setDisplayIds(null)
    setFilterExplanation('')
    setSelectedIds(new Set())
    setAppliedFilters({})
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleRowClick = (contact: Contact, index: number, e: React.MouseEvent) => {
    if (e.shiftKey && lastSelectedIndex >= 0) {
      const start = Math.min(lastSelectedIndex, index)
      const end = Math.max(lastSelectedIndex, index)
      const rangeIds = displayed.slice(start, end + 1).map(c => c.id)
      setSelectedIds(prev => {
        const next = new Set(prev)
        rangeIds.forEach(id => next.add(id))
        return next
      })
    } else {
      toggleSelect(contact.id)
      setLastSelectedIndex(index)
    }
  }

  const handleNameClick = (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation()
    setSelectedContact(contact)
  }

  const toggleSelectAll = () => {
    if (selectedIds.size === displayed.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(displayed.map(c => c.id)))
  }

  // Apply standard filters
  const standardFiltered = contacts.filter(c => {
    for (const [key, val] of Object.entries(appliedFilters)) {
      if (!val) continue
      if (key === 'client_status' && c.client_status !== val) return false
      if (c.custom_fields?.[key] !== val) return false
    }
    return true
  })

  // Live text search (name, phone, email)
  const textFiltered = (displayIds !== null ? contacts.filter(c => displayIds.includes(c.id)) : standardFiltered)
    .filter(c => {
      if (!query.trim() || aiLoading || displayIds !== null) return true
      const q = query.toLowerCase()
      return (
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        c.phone?.includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    })

  const displayed = textFiltered

  // Unique filter options from contacts
  const filterOptions: Record<string, string[]> = {}
  tenantFields.forEach(f => {
    if (f.field_options?.length) {
      filterOptions[f.field_key] = f.field_options
    } else {
      const vals = [...new Set(contacts.map(c => c.custom_fields?.[f.field_key]).filter(Boolean))]
      if (vals.length) filterOptions[f.field_key] = vals
    }
  })
  filterOptions['client_status'] = ['active', 'inactive', 'member']

  const sel = { border: '1px solid #E8E8E4', borderRadius: '8px', padding: '7px 10px', fontSize: '13px', background: 'white', outline: 'none', fontFamily: 'sans-serif', cursor: 'pointer' }

  return (
    <div style={{ padding: '32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 600, color: '#1A1A1A', margin: 0 }}>Contacts</h1>
          <p style={{ color: '#6B6B6B', fontSize: '14px', marginTop: '4px' }}>
            {loading ? 'Loading...' : `${contacts.length} contacts`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            onClick={() => setIsImporterOpen(true)}
            style={{ background: 'transparent', border: '1px solid #E8E8E4', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', color: '#6B6B6B', cursor: 'pointer', fontFamily: 'sans-serif' }}
          >
            Import Contacts
          </button>
          <button
            onClick={() => selectedIds.size > 0 && setIsComposeOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              background: selectedIds.size > 0 ? '#C8392B' : '#F0F0EC',
              color: selectedIds.size > 0 ? 'white' : '#A0A0A0',
              border: 'none', borderRadius: '10px', padding: '10px 20px',
              fontSize: '14px', fontWeight: 500,
              cursor: selectedIds.size > 0 ? 'pointer' : 'default',
              fontFamily: 'sans-serif', transition: 'all 0.15s',
            }}
          >
            <Send size={14} />
            {selectedIds.size > 0 ? `Compose (${selectedIds.size})` : 'Compose'}
          </button>
        </div>
      </div>

      {/* Search bar + Filters row */}
      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'white', border: '1px solid #E8E8E4', borderRadius: '10px', padding: '10px 14px', gap: '10px' }}>
          <span style={{ fontSize: '16px' }}>✦</span>
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              if (displayIds !== null && e.target.value === '') clearSearch()
            }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Search or ask Odeon anything..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', fontFamily: 'sans-serif', background: 'transparent' }}
          />
          {query && (
            <button onClick={clearSearch} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#A0A0A0', display: 'flex' }}>
              <X size={15} />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={aiLoading || !query.trim()}
            style={{ background: aiLoading || !query.trim() ? '#E8E8E4' : '#C8392B', color: aiLoading || !query.trim() ? '#A0A0A0' : 'white', border: 'none', borderRadius: '7px', padding: '6px 14px', fontSize: '13px', cursor: aiLoading || !query.trim() ? 'not-allowed' : 'pointer', fontFamily: 'sans-serif', whiteSpace: 'nowrap' }}
          >
            {aiLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', background: showFilters ? '#1A1A1A' : 'white', color: showFilters ? 'white' : '#6B6B6B', border: '1px solid #E8E8E4', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'sans-serif' }}
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
      </div>

      {/* Filter dropdowns — collapsible */}
      {showFilters && (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', padding: '14px 16px', background: 'white', border: '1px solid #E8E8E4', borderRadius: '10px' }}>
          {tenantFields.map(f => (
            filterOptions[f.field_key]?.length ? (
              <select key={f.field_key} value={filters[f.field_key] || ''} onChange={e => setFilters(prev => ({ ...prev, [f.field_key]: e.target.value }))} style={sel}>
                <option value="">{f.field_label}</option>
                {filterOptions[f.field_key].map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            ) : null
          ))}
          <select value={filters['client_status'] || ''} onChange={e => setFilters(prev => ({ ...prev, client_status: e.target.value }))} style={sel}>
            <option value="">Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="member">Member</option>
          </select>
          <button onClick={() => { setAppliedFilters(filters); setDisplayIds(null); setFilterExplanation('') }} style={{ background: '#C8392B', color: 'white', border: 'none', borderRadius: '8px', padding: '7px 16px', fontSize: '13px', cursor: 'pointer', fontFamily: 'sans-serif' }}>Apply</button>
          <button onClick={() => { setFilters({}); setAppliedFilters({}); setDisplayIds(null) }} style={{ background: 'transparent', border: '1px solid #E8E8E4', borderRadius: '8px', padding: '7px 12px', fontSize: '13px', cursor: 'pointer', color: '#6B6B6B', fontFamily: 'sans-serif' }}>Clear</button>
        </div>
      )}

      {/* AI explanation banner */}
      {filterExplanation && (
        <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '8px', padding: '10px 16px', marginBottom: '12px', fontSize: '13px', color: '#991B1B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✦ {filterExplanation}</span>
          <button onClick={clearSearch} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#991B1B' }}><X size={13} /></button>
        </div>
      )}


      {/* Contact table */}
      <div style={{ background: 'white', border: '1px solid #E8E8E4', borderRadius: '12px', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#A0A0A0', fontSize: '14px' }}>Loading contacts...</div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: '#A0A0A0', fontSize: '14px' }}>No contacts found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: '#FAFAF9', color: '#6B6B6B' }}>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>
                  <input type="checkbox" checked={selectedIds.size === displayed.length && displayed.length > 0} onChange={toggleSelectAll} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                </th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Name</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Phone</th>
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Email</th>
                {tenantFields.slice(0, 3).map(f => (
                  <th key={f.field_key} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>{f.field_label}</th>
                ))}
                <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 500 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {displayed.map((contact, index) => (
                <tr
                  key={contact.id}
                  onClick={(e) => handleRowClick(contact, index, e)}
                  style={{ borderBottom: '1px solid #F0F0EC', background: selectedIds.has(contact.id) ? '#FFF5F5' : 'white', cursor: 'pointer', transition: 'background 0.1s' }}
                >
                  <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => toggleSelect(contact.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                  </td>
                  <td style={{ padding: '10px 16px', fontWeight: 500 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: ['#C8392B', '#2563EB', '#16A34A', '#D97706', '#7C3AED', '#0891B2'][(contact.first_name.charCodeAt(0) + contact.last_name.charCodeAt(0)) % 6],
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', fontWeight: 600, color: 'white', flexShrink: 0,
                      }}>
                        {contact.first_name[0]}{contact.last_name[0]}
                      </span>
                      <span
                        onClick={(e) => handleNameClick(contact, e)}
                        style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#E8E8E4' }}
                      >
                        {contact.first_name} {contact.last_name}
                      </span>
                    </span>
                  </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '12px', color: '#6B6B6B' }}>{contact.phone || '—'}</td>
                  <td style={{ padding: '10px 16px', color: '#6B6B6B' }}>{contact.email || '—'}</td>
                  {tenantFields.slice(0, 3).map(f => (
                    <td key={f.field_key} style={{ padding: '10px 16px', color: '#6B6B6B' }}>{contact.custom_fields?.[f.field_key] || '—'}</td>
                  ))}
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
                      background: contact.client_status === 'active' ? '#F0FDF4' : '#F8F8F7',
                      color: contact.client_status === 'active' ? '#16A34A' : '#6B6B6B',
                    }}>{contact.client_status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Contact slide panel */}
      {selectedContact && (
        <ContactSlidePanel
          contact={selectedContact}
          tenantFields={tenantFields}
          onClose={() => setSelectedContact(null)}
          onUpdated={(updated) => {
            setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelectedContact(updated)
          }}
        />
      )}

      {/* Compose slide panel */}
      {isComposeOpen && (
        <>
          <div onClick={() => setIsComposeOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 40 }} />
          <div style={{ position: 'fixed', top: 0, right: 0, height: '100vh', width: 'min(75vw, 900px)', background: 'white', zIndex: 50, boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E8E8E4', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 600, margin: 0 }}>New Message</h2>
              <button onClick={() => setIsComposeOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#6B6B6B' }}>×</button>
            </div>
            <div style={{ flex: 1, overflow: 'auto' }}>
              <ComposePanel
                recipientCount={selectedIds.size}
                filterExplanation={filterExplanation}
                recipientIds={[...selectedIds]}
                channel="sms"
                onClose={() => setIsComposeOpen(false)}
                onSent={() => {
                  setTimeout(() => setIsComposeOpen(false), 3000)
                }}
              />
            </div>
          </div>
        </>
      )}

      <CSVImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImportComplete={() => {
          setIsImporterOpen(false)
          fetch(`/api/contacts?tenant=${tenantId}`).then(r => r.json()).then(data => setContacts(data))
        }}
      />
    </div>
  )
}