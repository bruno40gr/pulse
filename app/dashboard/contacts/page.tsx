'use client'
import { useState, useEffect, useRef, memo } from 'react'
import { getActiveTenantId, shouldUseDiceBear, getDiceBearUrl } from '@/lib/tenant'
import { SlidersHorizontal, X, Send } from 'lucide-react'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import CSVImporter from '@/components/contacts/CSVImporter'
import ComposePanel from '@/components/campaigns/ComposePanel'
import { Button, Badge, Avatar, SlidePanel } from '@/components/ui'
import { colors, typography, radius, spacing } from '@/lib/tokens'

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
  const [singleComposeContact, setSingleComposeContact] = useState<any>(null)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1)
  const [lastSync, setLastSync] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  const tenantId = getActiveTenantId()

  useEffect(() => {
    const stored = localStorage.getItem(`pulse_last_sync_${tenantId}`)
    if (stored) setLastSync(stored)
  }, [tenantId])

  const handleSync = async () => {
    const syncMethod = localStorage.getItem(`pulse_sync_method_${tenantId}`)
    if (syncMethod === 'csv') {
      setIsImporterOpen(true)
      return
    }
    setSyncing(true)
    try {
      const res = await fetch(`/api/contacts?tenant=${tenantId}`)
      const data = await res.json()
      setContacts(Array.isArray(data) ? data : [])
      const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      localStorage.setItem(`pulse_last_sync_${tenantId}`, now)
      setLastSync(now)
    } catch (e) {
      console.error(e)
    } finally {
      setSyncing(false)
    }
  }

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

  const sel = { border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.sm}`, fontSize: typography.sizeBase, background: colors.surface, outline: 'none', fontFamily: typography.fontSans, cursor: 'pointer' }

  return (
    <div style={{ padding: spacing['3xl'] }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: spacing.xl }}>
        <div>
          <h1 style={{ fontSize: typography.size2xl, fontWeight: typography.weightSemibold, color: colors.text, margin: 0 }}>Contacts</h1>
          <p style={{ color: colors.textSecondary, fontSize: typography.sizeMd, marginTop: spacing.xs }}>
            {loading ? 'Loading...' : `${contacts.length} students`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
          <Button variant="secondary" onClick={() => setIsImporterOpen(true)}>Import Contacts</Button>
          {!loading && (
            <button
              onClick={handleSync}
              disabled={syncing}
              style={{
                background: 'transparent', border: 'none', padding: 0,
                color: colors.textSecondary, cursor: syncing ? 'default' : 'pointer',
                fontSize: typography.sizeSm, fontFamily: typography.fontSans,
                textDecoration: 'underline', textUnderlineOffset: '2px',
                opacity: syncing ? 0.5 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {syncing ? 'Syncing...' : lastSync ? `Last synced ${lastSync}` : 'Sync now'}
            </button>
          )}
          <Button variant="secondary" onClick={() => {}}>+ Add contact</Button>
          <button
            onClick={() => {
              if (selectedIds.size === 1) {
                const contact = contacts.find(c => c.id === [...selectedIds][0])
                setSingleComposeContact(contact || null)
              } else {
                setSingleComposeContact(null)
              }
              setIsComposeOpen(true)
            }}
            disabled={selectedIds.size === 0}
            style={{
              display: 'flex', alignItems: 'center', gap: spacing.sm,
              background: selectedIds.size > 0 ? colors.crimson : colors.borderLight,
              color: selectedIds.size > 0 ? 'white' : colors.textMuted,
              border: 'none', borderRadius: radius.lg, padding: `${spacing.sm} ${spacing.xl}`,
              fontSize: typography.sizeMd, fontWeight: typography.weightMedium,
              cursor: selectedIds.size > 0 ? 'pointer' : 'default',
              fontFamily: typography.fontSans, transition: 'all 0.15s',
            }}
          >
            <Send size={14} />
            {selectedIds.size > 0 ? `Compose (${selectedIds.size})` : 'Compose'}
          </button>
        </div>
      </div>

      {/* Search bar + Filters row */}
      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md }}>
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`, gap: spacing.sm }}>
          <span style={{ fontSize: typography.sizeLg }}>✦</span>
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              if (displayIds !== null && e.target.value === '') clearSearch()
            }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Find students who haven't attended in 3 weeks..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: typography.sizeMd, fontFamily: typography.fontSans, background: 'transparent' }}
          />
          {query && (
            <button onClick={clearSearch} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, display: 'flex' }}>
              <X size={15} />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={aiLoading || !query.trim()}
            style={{ background: aiLoading || !query.trim() ? colors.borderLight : colors.crimson, color: aiLoading || !query.trim() ? colors.textMuted : 'white', border: 'none', borderRadius: radius.sm, padding: `${spacing.xs} ${spacing.md}`, fontSize: typography.sizeBase, cursor: aiLoading || !query.trim() ? 'not-allowed' : 'pointer', fontFamily: typography.fontSans, whiteSpace: 'nowrap' }}
          >
            {aiLoading ? 'Searching...' : 'Search'}
          </button>
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, background: showFilters ? colors.espresso : colors.surface, color: showFilters ? 'white' : colors.textSecondary, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`, fontSize: typography.sizeBase, cursor: 'pointer', fontFamily: typography.fontSans }}
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
      </div>

      {/* Filter dropdowns — collapsible */}
      {showFilters && (
        <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.md, padding: `${spacing.sm} ${spacing.md}`, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md }}>
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
          <Button variant="primary" size="sm" onClick={() => { setAppliedFilters(filters); setDisplayIds(null); setFilterExplanation('') }}>Apply</Button>
          <Button variant="secondary" size="sm" onClick={() => { setFilters({}); setAppliedFilters({}); setDisplayIds(null) }}>Clear</Button>
        </div>
      )}

      {/* AI explanation banner */}
      {filterExplanation && (
        <div style={{ background: colors.errorLight, border: `1px solid ${colors.errorBorder}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.lg}`, marginBottom: spacing.md, fontSize: typography.sizeBase, color: '#991B1B', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>✦ {filterExplanation}</span>
          <button onClick={clearSearch} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#991B1B' }}><X size={13} /></button>
        </div>
      )}


      {/* Contact table */}
      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, overflow: 'hidden' }}>
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
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  index={index}
                  isSelected={selectedIds.has(contact.id)}
                  tenantFields={tenantFields}
                  tenantId={tenantId}
                  onRowClick={handleRowClick}
                  onNameClick={handleNameClick}
                  onToggleSelect={toggleSelect}
                />
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
          onCompose={(ids) => {
            if (ids.length === 1) {
              const contact = contacts.find(c => c.id === ids[0])
              setSingleComposeContact(contact || null)
              setSelectedContact(null)
              setIsComposeOpen(true)
            } else {
              setSelectedIds(new Set(ids))
              setSelectedContact(null)
              setIsComposeOpen(true)
            }
          }}
        />
      )}

      {/* Compose slide panel */}
      <SlidePanel isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)}>
        <div style={{ padding: `${spacing.xl} ${spacing['2xl']}`, borderBottom: `1px solid ${colors.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2 style={{ fontSize: typography.sizeLg, fontWeight: typography.weightSemibold, margin: 0 }}>
            {singleComposeContact
              ? `Message to ${singleComposeContact.first_name}`
              : 'New Message'}
          </h2>
          <button onClick={() => setIsComposeOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: colors.textSecondary }}>×</button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <ComposePanel
            recipientCount={singleComposeContact ? 1 : selectedIds.size}
            filterExplanation={filterExplanation}
            recipientIds={singleComposeContact ? [singleComposeContact.id] : [...selectedIds]}
            channel="sms"
            mode={singleComposeContact ? 'single' : 'bulk'}
            contactContext={singleComposeContact}
            onClose={() => {
              setIsComposeOpen(false)
              setSingleComposeContact(null)
            }}
            onSent={() => {
              setTimeout(() => {
                setIsComposeOpen(false)
                setSingleComposeContact(null)
              }, 3000)
            }}
          />
        </div>
      </SlidePanel>

      <CSVImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImportComplete={() => {
          setIsImporterOpen(false)
          const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          localStorage.setItem(`pulse_last_sync_${tenantId}`, now)
          localStorage.setItem(`pulse_sync_method_${tenantId}`, 'csv')
          setLastSync(now)
          fetch(`/api/contacts?tenant=${tenantId}`).then(r => r.json()).then(data => setContacts(data))
        }}
      />
    </div>
  )
}

// Memoized row — only re-renders when its own props change
const ContactRow = memo(function ContactRow({
  contact,
  index,
  isSelected,
  tenantFields,
  tenantId,
  onRowClick,
  onNameClick,
  onToggleSelect,
}: {
  contact: Contact
  index: number
  isSelected: boolean
  tenantFields: TenantField[]
  tenantId: string
  onRowClick: (contact: Contact, index: number, e: React.MouseEvent) => void
  onNameClick: (contact: Contact, e: React.MouseEvent) => void
  onToggleSelect: (id: string) => void
}) {
  return (
    <tr
      onClick={(e) => onRowClick(contact, index, e)}
      style={{ borderBottom: `1px solid ${colors.borderLight}`, background: isSelected ? '#F4F6FA' : colors.surface, cursor: 'pointer', transition: 'background 0.1s' }}
    >
      <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
        <input type="checkbox" checked={isSelected} onChange={() => onToggleSelect(contact.id)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
      </td>
      <td style={{ padding: '10px 16px', fontWeight: 500 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <Avatar firstName={contact.first_name} lastName={contact.last_name} size={24} src={shouldUseDiceBear(tenantId) ? getDiceBearUrl(contact.first_name, contact.last_name) : undefined} />
          <span
            onClick={(e) => onNameClick(contact, e)}
            style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: '#E8E8E4' }}
          >
            {contact.first_name} {contact.last_name}
          </span>
        </span>
      </td>
                  <td style={{ padding: '10px 16px', fontFamily: 'monospace', fontSize: '12px' }}>{contact.phone ? contact.phone.replace(/^\+1\s?/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3') : '—'}</td>
      <td style={{ padding: '10px 16px' }}>{contact.email || '—'}</td>
      {tenantFields.slice(0, 3).map(f => (
        <td key={f.field_key} style={{ padding: '10px 16px', color: colors.textSecondary }}>{contact.custom_fields?.[f.field_key] || '—'}</td>
      ))}
      <td style={{ padding: '10px 16px' }}>
        <Badge variant={contact.client_status === 'active' ? 'success' : 'neutral'}>{contact.client_status}</Badge>
      </td>
    </tr>
  )
})
