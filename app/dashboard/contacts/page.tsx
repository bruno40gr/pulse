'use client'
import { useState, useEffect, useRef, memo } from 'react'
import { getActiveTenantId, shouldUseDemoPhotos, getContactDemoAvatarUrl } from '@/lib/tenant'
import { SlidersHorizontal, X, Send, House, RefreshCw, Sparkles } from 'lucide-react'
import { SlidePanelHeader } from '@/components/ui'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import StaffSlidePanel from '@/components/contacts/StaffSlidePanel'
import CSVImporter from '@/components/contacts/CSVImporter'
import ComposePanel from '@/components/campaigns/ComposePanel'
import BulkEditPanel from '@/components/contacts/BulkEditPanel'
import { Button, Badge, Avatar, SlidePanel, PageHeader } from '@/components/ui'
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
  is_minor?: boolean
  custom_fields: Record<string, unknown>
}

interface TenantField {
  field_key: string
  field_label: string
  field_type: string
  field_options: string[] | null
}

interface SyncStatusResponse {
  last_synced_at?: string | null
}

const PLACEHOLDER_MESSAGES = [
  "Find students who haven't attended in 3 weeks...",
  'Show me all drum students...',
  'Who are the active piano students?',
  'Find contacts with no email...',
  'Show band students without a band name...',
]

const AI_LOADING_MESSAGES = [
  'Analyzing your request...',
  'Searching through contacts...',
  'Finding the best matches...',
  'Almost there...',
]

function formatFilterSummary(explanation: string, resultCount: number | null) {
  const compactCount = resultCount !== null
    ? `${resultCount} ${resultCount === 1 ? 'contact' : 'contacts'}`
    : null

  const normalized = explanation
    .replace(/^filtered for\s*/i, '')
    .replace(/\.?\s*found\s+\d+\s+contacts?:.*$/i, '')
    .replace(/\bwho have\b/gi, 'with')
    .replace(/\bin band classes\b/gi, 'Band')
    .replace(/\s+/g, ' ')
    .trim()

  if (!normalized) return compactCount || 'Filtered'
  return compactCount ? `${compactCount} · ${normalized}` : normalized
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
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [singleComposeContact, setSingleComposeContact] = useState<Contact | null>(null)
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [showStaleBanner, setShowStaleBanner] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [aiMessageIndex, setAiMessageIndex] = useState(0)
  const [showStickyActions, setShowStickyActions] = useState(false)
  const [visibleCount, setVisibleCount] = useState(12)
  const tenantId = getActiveTenantId()
  const controlsAnchorRef = useRef<HTMLDivElement | null>(null)

  // Apply standard filters
  const standardFiltered = contacts.filter(c => {
    for (const [key, val] of Object.entries(appliedFilters)) {
      if (!val) continue
      if (key === 'client_status' && c.client_status !== val) return false
      if (c.custom_fields?.[key] !== val) return false
    }
    return true
  })

  const displayed = displayIds !== null ? contacts.filter(c => displayIds.includes(c.id)) : standardFiltered
  const visibleContacts = displayed.slice(0, visibleCount)
  const filterSummary = filterExplanation
    ? formatFilterSummary(filterExplanation, displayIds ? displayIds.length : null)
    : ''

  useEffect(() => {
    localStorage.getItem(`pulse_last_sync_${tenantId}`)
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
  }, [tenantId])

  useEffect(() => {
    if (loading) {
      setVisibleCount(12)
      return
    }

    if (displayed.length <= 12) {
      setVisibleCount(displayed.length)
      return
    }

    setVisibleCount(12)
    let cancelled = false
    let timeoutId: ReturnType<typeof setTimeout> | null = null

    const revealMore = () => {
      timeoutId = setTimeout(() => {
        if (cancelled) return
        setVisibleCount(prev => {
          const next = Math.min(prev + 12, displayed.length)
          if (next < displayed.length) revealMore()
          return next
        })
      }, 45)
    }

    revealMore()

    return () => {
      cancelled = true
      if (timeoutId) clearTimeout(timeoutId)
    }
  }, [loading, displayed.length])

  useEffect(() => {
    fetch(`/api/tenant/sync-status?tenant=${tenantId}`)
      .then(r => r.json())
      .then((data: SyncStatusResponse) => {
        if (data.last_synced_at) {
          setLastSynced(data.last_synced_at)
          const daysSince = Math.floor(
            (Date.now() - new Date(data.last_synced_at).getTime()) / (1000 * 60 * 60 * 24)
          )
          if (daysSince > 14) setShowStaleBanner(true)
        }
        // Don't show banner for tenants that have never synced
      })
      .catch(() => {})
  }, [tenantId])

  // Cycle placeholder prompts
  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex(prev => (prev + 1) % PLACEHOLDER_MESSAGES.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  // Cycle AI loading messages
  useEffect(() => {
    if (!aiLoading) return
    let i = 0
    const interval = setInterval(() => {
      i = (i + 1) % AI_LOADING_MESSAGES.length
      setAiMessageIndex(i)
    }, 3000)
    return () => clearInterval(interval)
  }, [aiLoading])

  useEffect(() => {
    const handleScroll = () => {
      const anchor = controlsAnchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      setShowStickyActions(rect.bottom < 0)
    }

    handleScroll()
    window.addEventListener('scroll', handleScroll, { passive: true })
    window.addEventListener('resize', handleScroll)
    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
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
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleCheckboxToggle = (contact: Contact, index: number, shiftKey: boolean) => {
    if (shiftKey && lastSelectedIndex >= 0) {
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

  const clearSelection = () => {
    setSelectedIds(new Set())
    setLastSelectedIndex(-1)
  }

  const openComposePanel = () => {
    if (selectedIds.size === 0) return

    if (selectedIds.size === 1) {
      const contact = contacts.find(c => c.id === [...selectedIds][0])
      setSingleComposeContact(contact || null)
    } else {
      setSingleComposeContact(null)
    }

    setIsComposeOpen(true)
  }

  // Unique filter options from contacts
  const filterOptions: Record<string, string[]> = {}
  tenantFields.forEach(f => {
    if (f.field_options?.length) {
      filterOptions[f.field_key] = f.field_options
    } else {
      const vals = [...new Set(
        contacts
          .map(c => c.custom_fields?.[f.field_key])
          .filter((value): value is string => typeof value === 'string' && value.length > 0)
      )]
      if (vals.length) filterOptions[f.field_key] = vals
    }
  })
  filterOptions['client_status'] = ['active', 'inactive', 'member']

  const sel = { border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.sm}`, fontSize: typography.sizeBase, background: colors.surface, outline: 'none', fontFamily: typography.fontSans, cursor: 'pointer' }

  return (
    <div style={{ padding: spacing['3xl'] }}>
      {/* Header */}
      <PageHeader
        title="Contacts"
        subtitle={loading ? 'Loading...' : `${contacts.length} students`}
        right={
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center' }}>
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
                {syncing ? (
                  'Syncing...'
                ) : lastSynced ? (
                  `Last synced ${Math.floor((Date.now() - new Date(lastSynced).getTime()) / (1000 * 60 * 60 * 24))} days ago`
                ) : (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <RefreshCw size={12} />
                    Sync now
                  </span>
                )}
              </button>
            )}
            <Button variant="secondary" onClick={() => setIsImporterOpen(true)}>Import Contacts</Button>
            <Button variant="secondary" onClick={() => {}}>+ Add contact</Button>
          </div>
        }
      />

      {/* Stale data banner */}
      {showStaleBanner && !bannerDismissed && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: colors.surfaceMuted,
          borderRadius: radius.md,
          padding: `${spacing.sm} ${spacing.lg}`,
          marginBottom: spacing.lg,
        }}>
          <span style={{
            ...typography.bodySmall,
            color: colors.warning,
          }}>
            Your contact data is from {lastSynced
              ? new Date(lastSynced).toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
              : 'a while ago'}. Attendance and enrollment info may have changed.
          </span>
          <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexShrink: 0 }}>
            <Button variant="secondary" size="sm" onClick={() => setIsImporterOpen(true)}>
              Sync now
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setBannerDismissed(true)}>
              ✕
            </Button>
          </div>
        </div>
      )}

      <div ref={controlsAnchorRef} />

      {/* Search bar + Filters row */}
      <div style={{ display: 'flex', gap: spacing.sm, marginBottom: spacing.md, alignItems: 'stretch' }}>
        <div style={{ maxWidth: '75%', flex: 1, display: 'flex', alignItems: 'center', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`, gap: spacing.sm }}>
          <span style={{ fontSize: typography.sizeLg }}>✦</span>
          <input
            type="text"
            value={query}
            onChange={e => {
              setQuery(e.target.value)
            }}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder={PLACEHOLDER_MESSAGES[placeholderIndex]}
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: typography.sizeMd, fontFamily: typography.fontSans, background: 'transparent', transition: 'opacity 0.4s ease-in-out' }}
            onFocus={e => { e.target.style.opacity = '1' }}
            onBlur={e => { e.target.style.opacity = '1' }}
          />
          {query && (
            <button onClick={clearSearch} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.textMuted, display: 'flex' }}>
              <X size={15} />
            </button>
          )}
          <button
            onClick={handleSearch}
            disabled={aiLoading || !query.trim()}
            style={{ background: aiLoading || !query.trim() ? colors.borderLight : colors.action, color: aiLoading || !query.trim() ? colors.textMuted : 'white', border: 'none', borderRadius: radius.sm, padding: `${spacing.xs} ${spacing.md}`, fontSize: typography.sizeBase, cursor: aiLoading || !query.trim() ? 'not-allowed' : 'pointer', fontFamily: typography.fontSans, whiteSpace: 'nowrap' }}
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
        <Button variant="secondary" onClick={() => setIsBulkEditOpen(true)} disabled={selectedIds.size < 2}>
          Edit Contacts{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </Button>
      </div>

      {showStickyActions && selectedIds.size > 0 && (
        <div style={{
          position: 'sticky',
          top: spacing.md,
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          padding: `${spacing.sm} ${spacing.md}`,
          marginBottom: spacing.md,
          background: 'rgba(255,255,255,0.96)',
          border: `1px solid ${colors.border}`,
          borderRadius: radius.lg,
          boxShadow: '0 8px 24px rgba(0,0,0,0.06)',
          backdropFilter: 'blur(10px)',
          animation: 'stickyBarFadeIn 180ms ease-out',
          transition: 'opacity 180ms ease-out, transform 180ms ease-out',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            {selectedIds.size > 0 && (
              <>
                <span style={{ fontSize: typography.sizeSm, color: colors.text, fontFamily: typography.fontSans, fontWeight: typography.weightMedium }}>
                  {selectedIds.size} out of {displayed.length} {displayed.length === 1 ? 'contact' : 'contacts'} selected
                </span>
                <button
                  onClick={clearSelection}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    padding: 0,
                    color: colors.textSecondary,
                    fontSize: typography.sizeSm,
                    fontFamily: typography.fontSans,
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                    cursor: 'pointer',
                  }}
                >
                  Unselect all
                </button>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <Button variant="secondary" onClick={() => setIsBulkEditOpen(true)} disabled={selectedIds.size < 2}>
              Edit Contacts{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
            </Button>
          </div>
        </div>
      )}

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

      {/* Active filter summary */}
      {filterExplanation && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.md,
          padding: `${spacing.sm} ${spacing.md}`,
          background: colors.surfaceMuted,
          border: `1px solid ${colors.border}`,
          borderRadius: '10px',
          marginBottom: spacing.md,
        }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: spacing.sm }}>
            <div style={{
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: colors.textSecondary,
            }}>
              <Sparkles size={12} />
            </div>
            <div style={{ fontSize: typography.sizeSm, color: colors.text, lineHeight: 1.4, fontFamily: typography.fontSans, minWidth: 0 }}>
              {filterSummary}
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearSearch}
            style={{ flexShrink: 0 }}
          >
            Clear
          </Button>
        </div>
      )}


      {/* AI loading state */}
      {aiLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '200px', gap: spacing.lg, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg }}>
          <div style={{
            width: '28px', height: '28px', border: `2px solid ${colors.borderLight}`,
            borderTop: `2px solid ${colors.crimson}`, borderRadius: '50%',
            animation: 'spin 0.8s linear infinite'
          }} />
          <p style={{ fontSize: typography.sizeMd, color: colors.textSecondary, margin: 0, fontFamily: typography.fontSans, transition: 'opacity 0.3s' }}>
            {AI_LOADING_MESSAGES[aiMessageIndex]}
          </p>
        </div>
      )}

      {/* Viewing counter */}
      {!aiLoading && !loading && (
        <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm, flexWrap: 'wrap' }}>
          <p style={{ color: colors.textMuted, fontSize: typography.sizeSm, margin: 0, fontFamily: typography.fontSans }}>
            {selectedIds.size > 0
              ? `${selectedIds.size} out of ${displayed.length} ${displayed.length === 1 ? 'contact' : 'contacts'} selected`
              : `Viewing ${displayed.length} ${displayed.length === 1 ? 'contact' : 'contacts'}`}
          </p>
          {visibleContacts.length > 0 && visibleContacts.length < displayed.length && (
            <p style={{ color: colors.textMuted, fontSize: typography.sizeSm, margin: 0, fontFamily: typography.fontSans }}>
              Showing {visibleContacts.length} of {displayed.length}
            </p>
          )}
          {selectedIds.size > 0 && !showStickyActions && (
            <button
              onClick={clearSelection}
              style={{
                background: 'transparent',
                border: 'none',
                padding: 0,
                color: colors.textSecondary,
                fontSize: typography.sizeSm,
                fontFamily: typography.fontSans,
                textDecoration: 'underline',
                textUnderlineOffset: '2px',
                cursor: 'pointer',
              }}
            >
              Unselect all
            </button>
          )}
        </div>
      )}

      {/* Contact table */}
      {!aiLoading && (
      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, overflow: 'hidden' }}>
        {loading ? (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '60px 1.4fr 1fr 1fr repeat(3, 1fr) 100px', gap: 0, background: colors.surfaceMuted, borderBottom: `1px solid ${colors.border}` }}>
              {Array.from({ length: 8 }).map((_, idx) => (
                <div key={idx} style={{ height: '42px', margin: '10px 16px', borderRadius: radius.sm, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
              ))}
            </div>
            {Array.from({ length: 8 }).map((_, rowIdx) => (
              <div key={rowIdx} style={{ display: 'grid', gridTemplateColumns: '60px 1.4fr 1fr 1fr repeat(3, 1fr) 100px', alignItems: 'center', borderBottom: rowIdx === 7 ? 'none' : `1px solid ${colors.borderLight}` }}>
                {Array.from({ length: 8 }).map((__, cellIdx) => (
                  <div key={cellIdx} style={{ margin: '14px 16px', height: cellIdx === 1 ? '24px' : '14px', borderRadius: radius.sm, background: colors.borderLight, animation: 'skeletonPulse 1.4s ease-in-out infinite' }} />
                ))}
              </div>
            ))}
          </div>
        ) : displayed.length === 0 ? (
          <div style={{ padding: '48px', textAlign: 'center', color: colors.textMuted, ...typography.body }}>No contacts found.</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: colors.surfaceMuted, color: colors.textSecondary }}>
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
              {visibleContacts.map((contact, index) => (
                <ContactRow
                  key={contact.id}
                  contact={contact}
                  index={index}
                  isSelected={selectedIds.has(contact.id)}
                  tenantFields={tenantFields}
                  tenantId={tenantId}
                  onRowClick={handleRowClick}
                  onNameClick={handleNameClick}
                  onToggleSelect={handleCheckboxToggle}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
      )}

      {!selectedContact && selectedIds.size > 0 && (
        <button
          onClick={openComposePanel}
          style={{
            position: 'fixed',
            right: spacing['2xl'],
            bottom: spacing['2xl'],
            zIndex: 30,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm,
            background: colors.action,
            color: 'white',
            border: 'none',
            borderRadius: radius.lg,
            padding: `${spacing.md} ${spacing.xl}`,
            fontSize: typography.sizeMd,
            fontWeight: typography.weightMedium,
            cursor: 'pointer',
            fontFamily: typography.fontSans,
            boxShadow: '0 14px 36px rgba(0,0,0,0.16)',
            whiteSpace: 'nowrap',
          }}
        >
          <Send size={14} />
          {selectedIds.size > 0 ? `compose (${selectedIds.size})` : 'compose'}
        </button>
      )}

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
          onViewStaff={(staffId) => {
            setSelectedStaffId(staffId)
          }}
        />
      )}

      {/* Staff slide panel */}
      {selectedStaffId && (
        <StaffSlidePanel
          staffId={selectedStaffId}
          onClose={() => setSelectedStaffId(null)}
          onViewStudent={(personId) => {
            const contact = contacts.find(c => c.id === personId)
            if (contact) {
              setSelectedStaffId(null)
              setSelectedContact(contact)
            }
          }}
        />
      )}

      {/* Compose slide panel */}
      <SlidePanel isOpen={isComposeOpen} onClose={() => setIsComposeOpen(false)}>
        <SlidePanelHeader
          title={singleComposeContact
            ? `Message to ${singleComposeContact.first_name}`
            : 'New Message'}
          onClose={() => {
            setIsComposeOpen(false)
            setSingleComposeContact(null)
          }}
        />
        <div style={{ flex: 1, overflow: 'auto' }}>
          <ComposePanel
            recipientCount={singleComposeContact ? 1 : selectedIds.size}
            filterExplanation={filterExplanation}
            recipientIds={singleComposeContact ? [singleComposeContact.id] : [...selectedIds]}
            channel="sms"
            mode={singleComposeContact ? 'single' : 'bulk'}
            contactContext={singleComposeContact || undefined}
            composeSource="scratch"
            composeIntent="neutral"
            footerLeadingAction={singleComposeContact ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsComposeOpen(false)
                  setSelectedContact(singleComposeContact)
                }}
              >
                ← View student details
              </Button>
            ) : undefined}
            recipientPreview={singleComposeContact
              ? [{
                  id: singleComposeContact.id,
                  first_name: singleComposeContact.first_name,
                  last_name: singleComposeContact.last_name,
                  avatar_src: shouldUseDemoPhotos(tenantId)
                    ? getContactDemoAvatarUrl(tenantId, singleComposeContact)
                    : undefined,
                }]
              : displayed.filter(contact => selectedIds.has(contact.id)).slice(0, 3).map(contact => ({
                  id: contact.id,
                  first_name: contact.first_name,
                  last_name: contact.last_name,
                  avatar_src: shouldUseDemoPhotos(tenantId)
                    ? getContactDemoAvatarUrl(tenantId, contact)
                    : undefined,
                }))}
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

      {/* Bulk edit panel */}
      {isBulkEditOpen && (
        <BulkEditPanel
          selectedCount={selectedIds.size}
          selectedIds={[...selectedIds]}
          tenantFields={tenantFields}
          onClose={() => setIsBulkEditOpen(false)}
          onSaved={() => {
            setIsBulkEditOpen(false)
            setSelectedIds(new Set())
            fetch(`/api/contacts?tenant=${tenantId}`).then(r => r.json()).then(data => setContacts(data))
          }}
        />
      )}

      <CSVImporter
        isOpen={isImporterOpen}
        onClose={() => setIsImporterOpen(false)}
        onImportComplete={() => {
          setIsImporterOpen(false)
          const now = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
          localStorage.setItem(`pulse_last_sync_${tenantId}`, now)
          localStorage.setItem(`pulse_sync_method_${tenantId}`, 'csv')
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
  onToggleSelect: (contact: Contact, index: number, shiftKey: boolean) => void
}) {
  return (
    <tr
      onClick={(e) => onRowClick(contact, index, e)}
      style={{ borderBottom: `1px solid ${colors.borderLight}`, background: isSelected ? colors.surfaceMuted : colors.surface, cursor: 'pointer', transition: 'background 0.1s' }}
    >
      <td style={{ padding: '10px 16px' }} onClick={e => e.stopPropagation()}>
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelect(contact, index, (e.nativeEvent as MouseEvent).shiftKey)}
          style={{ width: '18px', height: '18px', cursor: 'pointer' }}
        />
      </td>
      <td style={{ padding: '10px 16px', fontWeight: 500 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm }}>
                      <Avatar
                        firstName={contact.first_name}
                        lastName={contact.last_name}
                        size={32}
                        src={shouldUseDemoPhotos(tenantId)
                          ? getContactDemoAvatarUrl(tenantId, contact)
                          : undefined}
                      />
          <span
            onClick={(e) => onNameClick(contact, e)}
            style={{ cursor: 'pointer', textDecoration: 'underline', textDecorationColor: colors.border, fontWeight: typography.weightBold }}
          >
            {contact.first_name} {contact.last_name}
          </span>
        </span>
      </td>
                  <td style={{ padding: '10px 16px', fontSize: '12px' }}>
                    {(() => {
                      const phone = contact.phone || contact.account_holder_phone
                      const showIcon = Boolean((contact.custom_fields as Record<string, unknown> | undefined)?.is_minor) || (contact.custom_fields?.message_routing === 'account_holder')
                      if (!phone) return <span style={{ color: colors.textMuted }}>—</span>
                      return (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span>{phone.replace(/^\+1\s?/, '').replace(/(\d{3})(\d{3})(\d{4})/, '($1) $2-$3')}</span>
                          {showIcon && <House size={12} color="#A0A0A0" strokeWidth={1.5} />}
                        </span>
                      )
                    })()}
                  </td>
      <td style={{ padding: '10px 16px' }}>{contact.email || '—'}</td>
      {tenantFields.slice(0, 3).map(f => {
        const fieldValue = contact.custom_fields?.[f.field_key]
        return (
          <td key={f.field_key} style={{ padding: '10px 16px', color: colors.textSecondary }}>
            {typeof fieldValue === 'string' || typeof fieldValue === 'number'
              ? String(fieldValue)
              : '—'}
          </td>
        )
      })}
      <td style={{ padding: '10px 16px' }}>
        <Badge size="sm" variant={contact.client_status === 'active' ? 'success' : 'neutral'}>{contact.client_status}</Badge>
      </td>
    </tr>
  )
})
