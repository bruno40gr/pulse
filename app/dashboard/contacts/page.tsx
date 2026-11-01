'use client'

import { useContext } from 'react'
import { ContactPrototypeContext } from '@/components/contacts/ContactPrototypeContext'
import ContactBulkComposer from '@/components/inbox/ContactBulkComposer'
import ContactBulkMessageModal from '@/components/inbox/ContactBulkMessageModal'
import MessageActions from '@/components/inbox/MessageActions'
import { PROFILE_PANEL_WIDTH } from '@/lib/conversation-display'

import { ControlButton } from '@/components/ui/ControlButton'
import { PersonName } from '@/components/ui/PersonName'
import { useState, useEffect, useRef } from 'react'
import { getActiveTenantId } from '@/lib/tenant'
import { SlidersHorizontal, X, RefreshCw, Sparkles } from 'lucide-react'
import { SlidePanelHeader } from '@/components/ui'
import ContactSlidePanel from '@/components/contacts/ContactSlidePanel'
import { CONTACT_TABLE_SCHEMA } from '@/lib/contact-table-preferences'
import FamilyListTable from '@/components/contacts/FamilyListTable'
import AccountFamilyPanel from '@/components/contacts/AccountFamilyPanel'
import { groupContactFamilies } from '@/lib/family-list'
import { contactDestination, familyHolderPerson } from '@/lib/contact-presentation'
import CSVImporter from '@/components/contacts/CSVImporter'
import BulkEditPanel from '@/components/contacts/BulkEditPanel'
import { Button, Badge, SlidePanel, PageHeader, FieldLabel, StatusBadge, type DataTableColumn, type DataTableSort } from '@/components/ui'
import { formatPhoneNumber } from '@/lib/phone'
import { colors, typography, radius, spacing } from '@/lib/tokens'
import { useIsMobile } from '@/lib/useMediaQuery'
import { useMobilePanelHistory } from '@/lib/useMobilePanelHistory'
import { removeCurrentSearchParam } from '@/lib/browser-url'

interface Contact {
  id: string
  tenant_id?: string
  student_id?: string | null
  is_student?: boolean
  account_holder_person_id?: string | null
  account_holders?: { person_id?: string; name: string | null; phone: string | null; email: string | null; relationship: string | null; is_primary: boolean }[]
  message_routing?: string
  account_id?: string | null
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
  instructor?: {
    staff_id: string
    person_id: string | null
    name: string | null
    phone: string | null
    email: string | null
  } | null
  staff_id?: string | null
  is_active?: boolean
  funded?: boolean
}

type ContactSortKey = 'name' | 'status' | 'accountManager' | 'contact' | 'instructor'

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
  const prototype = useContext(ContactPrototypeContext)
  const [contacts, setContacts] = useState<Contact[]>([])
  const [tenantFields, setTenantFields] = useState<TenantField[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [filterExplanation, setFilterExplanation] = useState('')
  const [searchError, setSearchError] = useState('')
  const [displayIds, setDisplayIds] = useState<string[] | null>(null)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Record<string, string>>({})
  const [appliedFilters, setAppliedFilters] = useState<Record<string, string>>({})
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null)
  const [selectedAccount, setSelectedAccount] = useState<{ name: string; members: Contact[] } | null>(null)
  const [accountPanelTab, setAccountPanelTab] = useState<'profile' | 'scheduling' | 'billing'>('profile')
  const [initialNotesTab, setInitialNotesTab] = useState<'notes' | 'internal'>('notes')
  const [composeChannel, setComposeChannel] = useState<'sms' | 'email'>('sms')
  const [isComposeOpen, setIsComposeOpen] = useState(false)
  const [isImporterOpen, setIsImporterOpen] = useState(false)
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [savingContact, setSavingContact] = useState(false)
  const [newContact, setNewContact] = useState({ first_name: '', last_name: '', phone: '', email: '' })
  const [singleComposeContact, setSingleComposeContact] = useState<Contact | null>(null)
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number>(-1)
  const [syncing, setSyncing] = useState(false)
  const [lastSynced, setLastSynced] = useState<string | null>(null)
  const [showStaleBanner, setShowStaleBanner] = useState(false)
  const [bannerDismissed, setBannerDismissed] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [aiMessageIndex, setAiMessageIndex] = useState(0)
  const [showStickyActions, setShowStickyActions] = useState(false)
  const [visibleCount, setVisibleCount] = useState(12)
  const [contactSort, setContactSort] = useState<DataTableSort<ContactSortKey>>({ key: 'name', direction: 'asc' })
  const tenantId = getActiveTenantId()
  const isMobile = useIsMobile()
  const controlsAnchorRef = useRef<HTMLDivElement | null>(null)

  const closeContactState = () => {
    setSelectedContact(null)
    setSelectedAccount(null)
    removeCurrentSearchParam('contact')
  }
  const contactHistory = useMobilePanelHistory({
    isOpen: Boolean(selectedContact || selectedAccount),
    isMobile,
    historyKey: 'pulseMobileContactProfile',
    onClose: closeContactState,
  })

  // Apply standard filters
  const standardFiltered = contacts.filter(c => {
    for (const [key, val] of Object.entries(appliedFilters)) {
      if (!val) continue
      if (key === 'client_status') {
        if (c.client_status !== val) return false
        continue
      }
      if (c.custom_fields?.[key] !== val) return false
    }
    return true
  })

  const displayed = displayIds !== null ? contacts.filter(c => displayIds.includes(c.id)) : standardFiltered
  const sortedDisplayed = [...displayed].sort((left, right) => {
    const direction = contactSort.direction === 'asc' ? 1 : -1
    const text = (value: string | null | undefined) => value || ''
    const leftDestination = contactDestination(left)
    const rightDestination = contactDestination(right)
    const leftContact = leftDestination.phone || leftDestination.email
    const rightContact = rightDestination.phone || rightDestination.email
    const values: Record<ContactSortKey, [string, string]> = {
      name: [`${text(left.last_name)} ${text(left.first_name)}`, `${text(right.last_name)} ${text(right.first_name)}`],
      status: [text(left.client_status), text(right.client_status)],
      accountManager: [text(left.account_holder_name), text(right.account_holder_name)],
      contact: [text(leftContact), text(rightContact)],
      instructor: [text(left.instructor?.name), text(right.instructor?.name)],
    }
    const [leftValue, rightValue] = values[contactSort.key]
    const comparison = leftValue.localeCompare(rightValue, undefined, { sensitivity: 'base' })
    if (comparison !== 0) return comparison * direction
    return `${text(left.last_name)} ${text(left.first_name)}`.localeCompare(`${text(right.last_name)} ${text(right.first_name)}`, undefined, { sensitivity: 'base' })
  })
  const visibleFamilies = groupContactFamilies(sortedDisplayed).slice(0, visibleCount)
  const holderPersonIds = new Set(visibleFamilies.flatMap(group => {
    const holder = familyHolderPerson(group.members)
    return holder ? [holder.id] : []
  }))
  const visibleContactCount = visibleFamilies.reduce((count, group) => count + group.members.length, 0)
  const filterSummary = filterExplanation
    ? formatFilterSummary(filterExplanation, displayIds ? displayIds.length : null)
    : ''

  useEffect(() => {
    localStorage.getItem(`pulse_last_sync_${tenantId}`)
  }, [tenantId])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const contactId = params.get('contact')
    if (!contactId || selectedContact) return
    fetch(`/api/contacts/${contactId}?tenant=${tenantId}`)
      .then((response) => response.json())
      .then((contact) => {
        if (!contact?.error) {
          setInitialNotesTab(params.get('notes') === 'internal' ? 'internal' : 'notes')
          setSelectedContact(contact)
        }
      })
      .catch(() => {})
  }, [selectedContact, tenantId])

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
      setSearchError('')
      return
    }
    setAiLoading(true)
    setSearchError('')
    try {
      const res = await fetch('/api/ai-filter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, tenant: tenantId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Search could not be completed.')
      if (!Array.isArray(data.contact_ids)) throw new Error('Search returned an invalid response.')
      setDisplayIds(data.contact_ids)
      setFilterExplanation(data.explanation || query.trim())
      setSelectedIds(new Set())
    } catch (e) {
      console.error(e)
      setSearchError(e instanceof Error ? e.message : 'Search could not be completed.')
    } finally {
      setAiLoading(false)
    }
  }

  const clearSearch = () => {
    setQuery('')
    setDisplayIds(null)
    setFilterExplanation('')
    setSearchError('')
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
      const rangeIds = sortedDisplayed.slice(start, end + 1).map(c => c.id)
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
      const rangeIds = sortedDisplayed.slice(start, end + 1).map(c => c.id)
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

  const handleNameClick = async (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation()
    if (contact.staff_id) {
      const response = await fetch(`/api/contacts/${contact.id}?tenant=${tenantId}`)
      const detailedContact = await response.json()
      if (response.ok && detailedContact && !detailedContact.error) {
        setSelectedContact(detailedContact)
        return
      }
    }
    setSelectedContact(contact)
  }

  const toggleSelectAll = () => {
    if (displayed.length > 0 && displayed.every(contact => selectedIds.has(contact.id))) setSelectedIds(new Set())
    else setSelectedIds(new Set(displayed.map(c => c.id)))
  }

  const clearSelection = () => {
    setSelectedIds(new Set())
    setLastSelectedIndex(-1)
  }

  const openComposePanel = (channel: 'sms' | 'email' = 'sms') => {
    setComposeChannel(channel)
    if (selectedIds.size === 0) return

    if (selectedIds.size === 1) {
      const contact = contacts.find(c => c.id === [...selectedIds][0])
      setSingleComposeContact(contact || null)
    } else {
      setSingleComposeContact(null)
    }

    setIsComposeOpen(true)
  }

  const handleAddContact = async () => {
    if (!newContact.first_name.trim() || !newContact.last_name.trim()) return
    setSavingContact(true)
    try {
      const res = await fetch(`/api/contacts/create?tenant=${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newContact),
      })
      const data = await res.json()
      if (data && data.error) throw new Error(data.error)

      setIsAddOpen(false)
      setNewContact({ first_name: '', last_name: '', phone: '', email: '' })
      fetch(`/api/contacts?tenant=${tenantId}`).then(r => r.json()).then(d => {
        if (Array.isArray(d)) setContacts(d)
      })
    } catch (e) {
      console.error(e)
    } finally {
      setSavingContact(false)
    }
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

  const addInputStyle: React.CSSProperties = { border: `1px solid ${colors.border}`, borderRadius: radius.sm, padding: `${spacing.xs} ${spacing.sm}`, fontSize: typography.sizeBase, fontFamily: typography.fontSans, color: colors.text, background: colors.surface, outline: 'none', width: '100%', boxSizing: 'border-box' }

  const contactColumns: DataTableColumn<Contact, ContactSortKey>[] = [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(180px, 1.2fr)',
      sortable: true,
      sortKey: 'name',
      render: (contact) => (
        <span style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
          <PersonName as="button"
            weight={holderPersonIds.has(contact.id) ? 'semibold' : contact.account_id ? 'normal' : 'semibold'}
            type="button"
            onClick={(event) => handleNameClick(contact, event)}
            style={{ minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          >
            {contact.first_name} {contact.last_name}
          </PersonName>
          {contact.staff_id && <Badge size="sm" variant="info">Instructor</Badge>}
          {contact.staff_id && contact.is_active === false && <Badge size="sm" variant="inactive">Sunset</Badge>}
        </span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      width: 'minmax(86px, 0.72fr)',
      sortable: true,
      sortKey: 'status',
      render: (contact) => contact.is_student === false ? null : <StatusBadge status={contact.client_status} label={contact.client_status.charAt(0).toUpperCase() + contact.client_status.slice(1)} />,
    },
    {
      id: 'funded',
      header: 'Funding',
      width: '100px',
      render: (contact) => contact.funded
        ? <Badge size="sm" variant="success">Funded</Badge>
        : <span style={{ color: colors.textMuted }}>—</span>,
    },
    {
      id: 'phone',
      header: 'Phone',
      width: 'minmax(140px, 0.9fr)',
      sortable: true,
      sortKey: 'contact',
      render: (contact) => {
        const { holder, phone } = contactDestination(contact)
        return (
          <div style={{ color: colors.tableSecondary, minWidth: 0 }}>
            {holder ? null : phone ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 }}>
                <span style={{ overflowWrap: 'anywhere' }}>{formatPhoneNumber(phone)}</span>
              </span>
            ) : <span style={{ color: colors.textMuted }}>No phone</span>}
          </div>
        )
      },
    },
    {
      id: 'email',
      header: 'Email',
      width: 'minmax(200px, 1.25fr)',
      render: (contact) => {
        const destination = contactDestination(contact)
        return destination.holder ? null : <span style={{ color: colors.tableSecondary, overflowWrap: 'anywhere' }}>{destination.email || ''}</span>
      },
    },
    {
      id: 'instructor',
      header: 'Instructor',
      width: 'minmax(160px, 0.9fr)',
      sortable: true,
      sortKey: 'instructor',
      render: (contact) => contact.instructor?.name ? <PersonName>{contact.instructor.name}</PersonName> : <span style={{ color: colors.textSecondary }}>—</span>,
    },
  ]

  return (
    <div style={{ padding: spacing['3xl'], width: '100%', maxWidth: '100%', minWidth: 0, boxSizing: 'border-box' }}>
      {/* Header */}
      <PageHeader
        title="Contacts"
        subtitle={loading ? 'Loading...' : `${contacts.length} contacts`}
        right={
          <MessageActions disabled={selectedIds.size === 0} onSms={() => openComposePanel('sms')} onEmail={() => openComposePanel('email')} />
        }
      />

      <div style={{ display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap', marginBottom: spacing.lg }}>
            {!loading && (
              <Button variant="secondary" size="toolbar"
                onClick={handleSync}
                disabled={syncing}
                style={{ whiteSpace: 'nowrap' }}
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
              </Button>
            )}
            <Button variant="secondary" size="toolbar" onClick={() => setIsImporterOpen(true)}>Import Contacts</Button>
            <Button variant="secondary" size="toolbar" onClick={() => setIsAddOpen(true)}>+ Add contact</Button>
          </div>

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
            <ControlButton kind="close" aria-label="Close sync reminder" onClick={() => setBannerDismissed(true)} />
          </div>
        </div>
      )}

      <div ref={controlsAnchorRef} />

      {/* Search bar + Filters row */}


      {searchError && (
        <div style={{ marginBottom: spacing.md, padding: `${spacing.sm} ${spacing.md}`, border: `1px solid ${colors.error}`, borderRadius: radius.md, color: colors.error, background: colors.surface, fontSize: typography.sizeSm }}>
          {searchError}
        </div>
      )}

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
                <ControlButton kind="link"
                  onClick={clearSelection}

                >
                  Unselect all
                </ControlButton>
              </>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
            <MessageActions onSms={() => openComposePanel('sms')} onEmail={() => openComposePanel('email')} />
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
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center', columnGap: spacing.lg, rowGap: spacing.sm, marginTop: spacing.md, marginBottom: spacing.lg, minHeight: 40 }}>
          <p style={{ color: colors.textMuted, fontSize: typography.sizeSm, margin: 0, fontFamily: typography.fontSans }}>
            {selectedIds.size > 0
              ? `${selectedIds.size} out of ${displayed.length} ${displayed.length === 1 ? 'contact' : 'contacts'} selected`
              : `Viewing ${displayed.length} ${displayed.length === 1 ? 'contact' : 'contacts'}`}
          </p>
          {visibleContactCount > 0 && visibleContactCount < displayed.length && (
            <p style={{ color: colors.textMuted, fontSize: typography.sizeSm, margin: 0, fontFamily: typography.fontSans }}>
              Showing {visibleContactCount} of {displayed.length}
            </p>
          )}
          {
            <ControlButton kind="link"
              onClick={clearSelection}
              disabled={selectedIds.size === 0 || showStickyActions}
              aria-hidden={selectedIds.size === 0 || showStickyActions}
              style={{ gridColumn: 2, gridRow: 1, visibility: selectedIds.size > 0 && !showStickyActions ? 'visible' : 'hidden', whiteSpace: 'nowrap' }}
            >
              Unselect all
            </ControlButton>
          }
        </div>
      )}

      {/* Contact table */}
      {(
        <FamilyListTable
          preferenceSchema={CONTACT_TABLE_SCHEMA}
          toolbar={<>
        <div style={{ flex: '1 1 240px', minWidth: 0, display: 'flex', alignItems: 'center', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.md, padding: `${spacing.sm} ${spacing.md}`, gap: spacing.sm }}>
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
            <ControlButton kind="icon" onClick={clearSearch} >
              <X size={15} />
            </ControlButton>
          )}
          <Button variant="primary" size="sm"
            onClick={handleSearch}
            disabled={aiLoading || !query.trim()}
            style={{ whiteSpace: 'nowrap' }}
          >
            {aiLoading ? 'Searching...' : 'Search'}
          </Button>
        </div>
        <Button variant="secondary" size="toolbar"
          onClick={() => setShowFilters(!showFilters)}

        >
          <SlidersHorizontal size={14} /> Filters
        </Button>
        <Button variant="secondary" size="toolbar" onClick={() => setIsBulkEditOpen(true)} disabled={selectedIds.size < 2}>
          Edit Contacts{selectedIds.size > 0 ? ` (${selectedIds.size})` : ''}
        </Button>
          </>}
          groups={visibleFamilies.map(group => {
            const holderPerson = familyHolderPerson(group.members)
            return {
              id: group.id,
              parent: group.holder ? holderPerson : group.members[0],
              name: holderPerson ? `${holderPerson.first_name} ${holderPerson.last_name}`.trim() : group.holder || `${group.members[0].first_name} ${group.members[0].last_name}`.trim(),
              subtitle: group.holder ? 'Account holder' : '',
              summaryCells: {
                phone: <span style={{ color: colors.tableSecondary }}>{formatPhoneNumber(group.members[0].account_holder_phone) || 'No phone'}</span>,
                email: <span style={{ color: colors.tableSecondary }}>{group.members[0].account_holder_email || ''}</span>,
              },
              members: group.holder ? group.members.filter(contact => contact.id !== holderPerson?.id).map(contact => ({
                id: contact.id, row: contact, name: `${contact.first_name} ${contact.last_name}`.trim(),
                isAccountHolder: group.members.some(member => member.tenant_id === contact.tenant_id
                  && (member.account_holder_person_id === contact.id || member.account_holders?.some(holder => holder.person_id === contact.id))),
              })).sort((left, right) => Number(right.isAccountHolder) - Number(left.isAccountHolder)) : [],
            }
          })}
          nameColumn="name"
          onOpenMember={member => { setSelectedAccount(null); setAccountPanelTab('profile'); setSelectedContact(member) }}
          onOpenGroup={group => {
            if (group.parent) {
              setSelectedAccount(null)
              setAccountPanelTab('profile')
              setSelectedContact(group.parent)
              return
            }
            const members = [...(group.parent ? [group.parent] : []), ...group.members.flatMap(member => member.row ? [member.row] : [])]
            if (members.some(member => member.account_id)) {
              setSelectedContact(null)
              const accountId = members[0]?.account_id
              const accountTenant = members[0]?.tenant_id
              setSelectedAccount({ name: group.name, members: contacts.filter(member => member.account_id === accountId && member.tenant_id === accountTenant) })
            } else if (group.parent) {
              setAccountPanelTab('profile')
              setSelectedContact(group.parent)
            }
          }}
          columns={['status', 'name', 'phone', 'email', 'funded', 'instructor'].flatMap(id => contactColumns.filter(column => column.id === id))}
          getRowKey={(contact) => contact.id}
          sort={contactSort}
          onSortChange={setContactSort}
          onToggleMembers={(members, checked) => {
            setSelectedIds(current => {
              const next = new Set(current)
              for (const member of members) {
                if (checked) next.add(member.id)
                else next.delete(member.id)
              }
              return next
            })
            setLastSelectedIndex(-1)
          }}
          selection={{
            selectedKeys: selectedIds,
            onToggle: (contact, _index, event) => handleCheckboxToggle(contact, sortedDisplayed.findIndex(row => row.id === contact.id), (event.nativeEvent as MouseEvent).shiftKey),
            onToggleAll: toggleSelectAll,
            allSelected: displayed.length > 0 && displayed.every((contact) => selectedIds.has(contact.id)),
            someSelected: selectedIds.size > 0 && !displayed.every((contact) => selectedIds.has(contact.id)),
            selectAllLabel: 'Select all contacts',
            getRowLabel: (contact) => `${contact.first_name} ${contact.last_name}`.trim(),
          }}
          loading={loading || aiLoading}
          skeletonRows={8}
          emptyContent="No contacts found."
          onRowClick={(contact, _index, event) => handleRowClick(contact, sortedDisplayed.findIndex(row => row.id === contact.id), event)}
          getRowStyle={(contact) => ({ background: selectedIds.has(contact.id) ? colors.surfaceMuted : colors.surface })}
          ariaLabel="Contacts"
        />
      )}

      {/* Contact slide panel */}
      {selectedAccount && !selectedContact && <AccountFamilyPanel
        name={selectedAccount.name}
        members={selectedAccount.members}
        onClose={contactHistory.closePanel}
        onOpenMember={(member, tab) => { setAccountPanelTab(tab); setSelectedContact(member) }}
      />}
      {selectedContact && (
        <ContactSlidePanel
          key={selectedContact.id}
          prototype={prototype}
          contact={selectedContact}
          initialPanelTab={accountPanelTab}
          initialNotesTab={initialNotesTab}
          tenantFields={tenantFields}
          onClose={contactHistory.closePanel}
          onUpdated={(updated) => {
            setContacts(prev => prev.map(c => c.id === updated.id ? updated : c))
            setSelectedContact(updated)
          }}
          onCompose={(ids) => {
            if (ids.length === 1) {
              const contact = contacts.find(c => c.id === ids[0])
              setSingleComposeContact(contact || null)
              contactHistory.dismissPanel(() => { setComposeChannel('sms'); setIsComposeOpen(true) })
            } else {
              setSelectedIds(new Set(ids))
              contactHistory.dismissPanel(() => { setComposeChannel('sms'); setIsComposeOpen(true) })
            }
          }}
          onViewInstructor={async (personId) => {
            const response = await fetch(`/api/contacts/${personId}?tenant=${tenantId}`)
            const instructorContact = await response.json()
            if (response.ok && instructorContact && !instructorContact.error) {
              setSelectedContact(instructorContact)
            }
          }}
        />
      )}

      {/* Compose slide panel */}
      {isComposeOpen && !singleComposeContact && <ContactBulkMessageModal
        key={composeChannel + [...selectedIds].sort().join(',')}
        tenantId={tenantId} contacts={contacts.filter(contact => selectedIds.has(contact.id))} channel={composeChannel}
        onClose={() => setIsComposeOpen(false)} />}
      <SlidePanel isOpen={isComposeOpen && !!singleComposeContact} onClose={() => setIsComposeOpen(false)} fullScreen={isMobile} width={PROFILE_PANEL_WIDTH}>
        <SlidePanelHeader
          title={composeChannel === 'email' ? 'Send Email' : singleComposeContact ? `Message to ${singleComposeContact.first_name}` : 'Send SMS'}
          onBack={singleComposeContact ? () => { setIsComposeOpen(false); setSelectedContact(singleComposeContact) } : undefined}
          backLabel="Back to student details"
          onClose={() => {
            setIsComposeOpen(false)
            setSingleComposeContact(null)
          }}
        />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <ContactBulkComposer key={`${composeChannel}:${singleComposeContact?.id || [...selectedIds].sort().join(',')}`} tenantId={tenantId}
            contactIds={singleComposeContact ? [singleComposeContact.id] : [...selectedIds]} channel={composeChannel}
            onClose={() => { setIsComposeOpen(false); setSingleComposeContact(null) }} />
        </div>
      </SlidePanel>

      {/* Add contact slide panel */}
      {isAddOpen && (
        <SlidePanel isOpen={true} onClose={() => setIsAddOpen(false)}>
          <SlidePanelHeader title="Add contact" onClose={() => setIsAddOpen(false)} />
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px', background: colors.surface }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: spacing.lg, maxWidth: 420 }}>
              <div>
                <FieldLabel>First name</FieldLabel>
                <input
                  type="text"
                  value={newContact.first_name}
                  onChange={e => setNewContact(prev => ({ ...prev, first_name: e.target.value }))}
                  placeholder="First name"
                  style={addInputStyle}
                />
              </div>
              <div>
                <FieldLabel>Last name</FieldLabel>
                <input
                  type="text"
                  value={newContact.last_name}
                  onChange={e => setNewContact(prev => ({ ...prev, last_name: e.target.value }))}
                  placeholder="Last name"
                  style={addInputStyle}
                />
              </div>
              <div>
                <FieldLabel>Phone</FieldLabel>
                <input
                  type="text"
                  value={newContact.phone}
                  onChange={e => setNewContact(prev => ({ ...prev, phone: formatPhoneNumber(e.target.value) }))}
                  placeholder="Phone number"
                  style={addInputStyle}
                />
              </div>
              <div>
                <FieldLabel>Email</FieldLabel>
                <input
                  type="email"
                  value={newContact.email}
                  onChange={e => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                  placeholder="Email address"
                  style={addInputStyle}
                />
              </div>
            </div>
          </div>
          <div style={{ padding: '16px 28px', borderTop: `1px solid ${colors.borderLight}`, display: 'flex', justifyContent: 'flex-end', gap: '10px', background: colors.surface }}>
            <Button variant="secondary" onClick={() => setIsAddOpen(false)}>Cancel</Button>
            <Button
              variant="primary"
              onClick={handleAddContact}
              disabled={savingContact || !newContact.first_name.trim() || !newContact.last_name.trim()}
            >
              {savingContact ? 'Adding...' : 'Add contact'}
            </Button>
          </div>
        </SlidePanel>
      )}

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
