'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, CalendarDays, GraduationCap, MapPin, Pencil, Plus, Settings, Trash2, Users, Wallet } from 'lucide-react'
import Image from 'next/image'
import { Button } from '@/beta-source/components/ui/Button'
import { ControlButton } from '@/beta-source/components/ui/ControlButton'
import { DenseSectionPanel } from '@/beta-source/components/ui/DenseSectionPanel'
import { FieldGrid } from '@/beta-source/components/ui/FieldGrid'
import { Input } from '@/beta-source/components/ui/Input'
import { StudentMultiSelect } from '@/beta-source/components/leads/StudentMultiSelect'
import { EmptyState } from '@/beta-source/components/ui/EmptyState'
import { Select } from '@/beta-source/components/ui/Select'
import { colors, typography } from '@/beta-source/lib/tokens'
import { createDiscounts, normalizePricing, pricingName, cloneCurriculum, createMaterials, createSetupData, defaultLevelNames, levelIds, lessonFormats, schedulingChoices, selection, serviceDefaults, setupAreas, validateRooms, validateSetup, visibleFields, type DiscountPolicy, type SetupCurriculum, type SetupMaterial, type SetupArea, type SetupExperience, type SetupRecord, type SetupRoom } from './setup-content'
import ServiceEditor from './ServiceEditor'
import CurriculumSection from './CurriculumSection'
import DiscountsPanel from './DiscountsPanel'
import DurationPricing from './DurationPricing'
import TeacherEditor from './TeacherEditor'
import RoomTable from './RoomTable'
import HeadlinerLogo from '@/beta-source/components/layout/HeadlinerLogo'
import ClosureTable from './ClosureTable'
import { policyEditorValues, validatePolicyDraft } from './policy-content'
import PolicyEditor from './PolicyEditor'
import AgreementsPanel from './AgreementsPanel'
import styles from './school-setup.module.css'

const icons = [Settings, MapPin, Wallet, BookOpen, Users, CalendarDays]
const theme = { '--setup-cream': colors.cream, '--setup-ink': colors.espresso, '--setup-border': colors.border, '--setup-muted': colors.textSecondary, '--setup-surface': colors.surface, fontFamily: typography.fontSans } as CSSProperties
type Editor = { id: string; values: Record<string, string>; rooms: SetupRoom[]; curriculum: SetupCurriculum; materials: SetupMaterial[]; fresh: boolean; title: string; initial: string }
function createEditor(area: SetupArea, data: Record<string, SetupRecord[]>, record?: SetupRecord, lastServiceId?: string, materials: SetupMaterial[] = []): Editor {
  const values = area.id === 'policies' ? policyEditorValues(record?.values || { name: 'School defaults' }) : { ...(record?.values || area.defaults) }
  if (!record && area.id === 'services') Object.assign(values, serviceDefaults(data.services.find(item => item.id === lastServiceId) || data.services[data.services.length - 1]))
  if (area.id === 'school') Object.assign(values, { ...defaultLevelNames, ...values })
  if (area.id === 'teachers' && !values.levelIds) values.levelIds = JSON.stringify(levelIds)
  if (!record) {
    if ('service' in values) values.service = data.services[0]?.id || ''
    if ('location' in values) values.location = data.locations[0]?.id || ''
    if (area.id === 'plans') values.price = ''
  }
  const rooms = record?.rooms?.map(room => ({ ...room, serviceIds: [...room.serviceIds] })) || (area.id === 'locations' ? [{ id: 'first-room', name: '', capacity: '1', serviceIds: [], allServices: true }] : [])
  if (area.id === 'plans') Object.assign(values, normalizePricing(values))
  const curriculum = cloneCurriculum(record?.curriculum)
  return { curriculum, materials, id: record?.id || `new-${area.id}`, values, rooms, fresh: !record, title: record?.values.name || '', initial: JSON.stringify({ values, rooms, curriculum, materials }) }
}

export default function SchoolSetup({ configuredData, onConfiguredChange, demo = false }: { configuredData?: Record<string, SetupRecord[]>; onConfiguredChange?: (data: Record<string, SetupRecord[]>) => void; demo?: boolean } = {}) {
  const [view, setView] = useState('overview')
  const [experience, setExperience] = useState<SetupExperience>('new')
  const [experiences, setExperiences] = useState(() => ({ new: createSetupData('new'), configured: configuredData || createSetupData('configured') }))
  useEffect(() => { onConfiguredChange?.(experiences.configured) }, [experiences.configured, onConfiguredChange])
  const data = experiences[experience]
  const [libraries, setLibraries] = useState(() => ({ new: createMaterials('new'), configured: createMaterials('configured') }))
  const [schoolLevels, setSchoolLevels] = useState(() => ({ new: { ...defaultLevelNames }, configured: { ...defaultLevelNames } }))
  const [enabledLevels, setEnabledLevels] = useState(() => ({ new: levelIds.slice(0, 3), configured: levelIds.slice(0, 3) }))
  const [discountPolicies, setDiscountPolicies] = useState<Record<SetupExperience, DiscountPolicy>>({ new: { combination: 'best', order: 'percentage-first' }, configured: { combination: 'best', order: 'percentage-first' } })
  const [discounts, setDiscounts] = useState(() => ({ new: createDiscounts('new'), configured: createDiscounts('configured') }))
  const [curriculumDirty, setCurriculumDirty] = useState(false)
  const [lastServices, setLastServices] = useState<Record<SetupExperience, string>>({ new: '', configured: '' })
  const [draft, setEditor] = useState<Editor | null>(null)
  const area = view === 'calendar' ? { ...setupAreas.find(item => item.id === 'policies')!, title: 'Calendar' } : setupAreas.find(item => item.id === view)
  const inlineSettings = Boolean(area?.singleton)
  const editor = draft || (area && (inlineSettings || (area.id !== 'plans' && !data[area.id].length)) ? createEditor(area, data, area.singleton ? data[area.id][0] : undefined, lastServices[experience], libraries[experience]) : null)
  const dirty = Boolean(editor && editor.initial !== JSON.stringify({ values: editor.values, rooms: editor.rooms, curriculum: editor.curriculum, materials: editor.materials }))
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [backHref, setBackHref] = useState('/content-studio-prototype/students?prototype=v3')
  const mainRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const sync = () => { const params = new URLSearchParams(window.location.search); const id = params.get('section'); setExperience(params.get('experience') === 'configured' ? 'configured' : 'new'); setView((id === 'calendar' || id === 'curriculum' || setupAreas.some(area => area.id === id)) ? id! : 'overview'); setEditor(null); setCurriculumDirty(false); setError(''); setNotice('') }
    sync()
    const url = new URL(demo ? '/dashboard' : window.location.pathname === '/school-setup' ? '/students' : '/content-studio-prototype/students', window.location.origin)
    url.searchParams.set('prototype', 'v3')
    const tenant = new URLSearchParams(window.location.search).get('tenant')
    if (tenant) url.searchParams.set('tenant', tenant)
    setBackHref(url.pathname + url.search)
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [demo])
  function canLeave() { return !(dirty || curriculumDirty) || window.confirm('Discard unsaved changes?') }
  function navigate(next: string) {
    if (!canLeave()) return
    setView(next); setCurriculumDirty(false); setEditor(null); setError(''); setNotice('')
    const url = new URL(window.location.href)
    if (next === 'overview') url.searchParams.delete('section'); else url.searchParams.set('section', next)
    window.history.pushState(null, '', url); mainRef.current?.focus(); window.scrollTo(0, 0)
  }
  function edit(record?: SetupRecord) {
    if (!area || !canLeave()) return
    setCurriculumDirty(false)
    setEditor(createEditor(area, data, record, lastServices[experience], libraries[experience])); setError(''); setNotice(''); mainRef.current?.focus(); window.scrollTo(0, 0)
  }
  function closeEditor() {
    if (!canLeave()) return
    if (area && area.id !== 'plans' && !data[area.id].length) { setEditor(null); setView('overview'); setError(''); const url = new URL(window.location.href); url.searchParams.delete('section'); window.history.pushState(null, '', url) }
    else { setEditor(null); setError(''); mainRef.current?.focus() }
  }
  function updateValue(key: string, value: string) {
    if (!editor) return
    setEditor({ ...editor, values: area?.id === 'plans' ? normalizePricing({ ...editor.values, [key]: value }) : { ...editor.values, [key]: value } }); setError('')
  }
  function updateRooms(rooms: SetupRoom[]) {
    if (!editor) return
    setEditor({ ...editor, rooms }); setError('')
  }
  function loadLogo(file?: File) {
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { setError('Choose a PNG, JPEG or WebP logo under 5 MB.'); return }
    const reader = new FileReader()
    reader.onload = () => { if (typeof reader.result === 'string') updateValue('logo', reader.result) }
    reader.onerror = () => setError('The logo could not be read. Try another file.')
    reader.readAsDataURL(file)
  }
  function save() {
    if (!area || !editor) return
    const message = (area.id === 'policies' && view !== 'calendar' ? validatePolicyDraft(editor.values) : null) || validateSetup(area, editor.values) || (area.id === 'locations' ? validateRooms(editor.rooms, data.services.map(record => record.id)) : null)
    if (message) { setError(message); return }
    if (area.id === 'teachers' && !data.services.some(record => record.id === editor.values.service)) { setError('Choose an available service.'); return }
    if (area.id === 'services' && selection(editor.values.planIds).some(id => !data.plans.some(plan => plan.id === id))) { setError('Choose available pricing models.'); return }
    if (area.id === 'teachers' && !data.locations.some(record => record.id === editor.values.location)) { setError('Choose an available location.'); return }
    const record: SetupRecord = { id: editor.fresh ? (area.singleton ? data[area.id][0]?.id : undefined) || crypto.randomUUID() : editor.id, ...(area.id === 'locations' ? { rooms: editor.rooms.map(room => ({ ...room, name: room.name.trim() })) } : {}), values: Object.fromEntries(Object.entries(area.id === 'plans' ? normalizePricing(editor.values) : editor.values).map(([key, value]) => [key, value.trim()])) }
    if (area.id === 'policies') record.values.agreements = data.policies[0]?.values.agreements || ''
    if (area.id === 'services') { record.curriculum = cloneCurriculum(editor.curriculum); setLibraries(current => ({ ...current, [experience]: editor.materials })) }
    if (area.id === 'services') setLastServices(current => ({ ...current, [experience]: record.id }))
    setExperiences(current => ({ ...current, [experience]: { ...current[experience], [area.id]: editor.fresh && !(area.singleton && current[experience][area.id].length) ? [...current[experience][area.id], record] : current[experience][area.id].map(item => item.id === record.id ? record : item) } }))
    setEditor(null); setError(''); setNotice('Changes saved.'); mainRef.current?.focus()
  }
  function display(key: string, value: string) {
    if (key === 'service') return data.services.find(record => record.id === value)?.values.name || 'Service unavailable'
    if (key === 'location') return data.locations.find(record => record.id === value)?.values.name || 'Location unavailable'
    if (['price', 'fee', 'deposit'].includes(key)) return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(value))
    if (key === 'levelIds') return selection(value).map(id => schoolLevels[experience][id]).join(', ')
    return value || 'Not set'
  }
  const completed = setupAreas.filter(item => data[item.id].length > 0).length
  const nextArea = setupAreas.find(item => !data[item.id].length)
  const actions = view === 'curriculum' ? null : inlineSettings ? (dirty ? <Button form="setup-editor" type="submit">Save changes</Button> : null) : editor ? <><Button variant="secondary" onClick={closeEditor}>Cancel</Button><Button form="setup-editor" type="submit">Save changes</Button></> : area ? <Button onClick={() => edit(area.singleton ? data[area.id][0] : undefined)}>{area.singleton && data[area.id].length ? <Pencil size={15} /> : <Plus size={15} />}{area.singleton ? (data[area.id].length ? 'Edit details' : `Set up ${area.singular}`) : `Add ${area.singular}`}</Button> : experience === 'new' && nextArea ? <Button onClick={() => navigate(nextArea.id)}>{completed ? 'Continue setup' : 'Start setup'}<ArrowRight size={16} /></Button> : null
  return <div style={theme}>
    <div className={styles.shell}>
    {demo && <p role="status" className={styles.betaNotice}>Beta · Sample data · No live school changes, payments or messages. Changes are not shared with other testers.</p>}
    <a href="#setup-content" className={styles.skip}>Skip to setup content</a>
    <header className={styles.topbar}><a href={backHref} className={styles.brand} onClick={event => { if (!canLeave()) event.preventDefault() }}>{demo ? <HeadlinerLogo height={28} /> : <><GraduationCap size={23} aria-hidden="true" /><strong>odeon.</strong></>}</a><span>School Setup</span><div className={styles.exit}><Button variant="destructive" size="sm" onClick={() => { if (canLeave()) window.location.assign(backHref) }}><ArrowLeft size={15} aria-hidden="true" />{demo ? 'Back to Headliner' : 'Back to Odeon'}</Button></div></header>
    <div className={styles.layout}>
      <aside className={styles.sidebar}><div className={styles.identity}><h2>{data.school[0]?.values.name || 'Your school'}</h2></div><nav aria-label="School setup sections"><ControlButton kind="navigation" selected={view === 'overview'} aria-current={view === 'overview' ? 'page' : undefined} onClick={() => navigate('overview')}>Overview</ControlButton>{setupAreas.map((item, index) => { const Icon = icons[index]; return <ControlButton key={item.id} kind="navigation" selected={view === item.id} aria-current={view === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon size={17} aria-hidden="true" />{item.title}</ControlButton> })}<ControlButton kind="navigation" selected={view === 'calendar'} aria-current={view === 'calendar' ? 'page' : undefined} onClick={() => navigate('calendar')}><CalendarDays size={17} aria-hidden="true" />Calendar</ControlButton><ControlButton kind="navigation" selected={view === 'curriculum'} aria-current={view === 'curriculum' ? 'page' : undefined} onClick={() => navigate('curriculum')}><BookOpen size={17} aria-hidden="true" />Curriculum</ControlButton></nav></aside>
      <main id="setup-content" tabIndex={-1} ref={mainRef} className={styles.main}>

        <section className={styles.progress} aria-label="Setup progress"><div><span>{completed} of {setupAreas.length} sections set up</span><strong>{Math.round(completed / setupAreas.length * 100)}%</strong></div><progress aria-label="School setup completion" max={setupAreas.length} value={completed} /></section>
        <header className={styles.pageHeader}><div>{area && editor && !inlineSettings && data[area.id].length > 0 && <ControlButton kind="link" onClick={closeEditor}>{area.title}</ControlButton>}<div className={styles.editorTitle}>{area && editor && !inlineSettings && data[area.id].length > 0 && <ControlButton kind="icon" aria-label={editor ? `Back to ${data[area.id].length ? area.title : 'overview'}` : 'Back to overview'} onClick={editor ? closeEditor : () => navigate('overview')}><ArrowLeft size={24} /></ControlButton>}<h1>{inlineSettings ? area?.title : editor && area ? (view === 'calendar' ? 'Edit calendar' : editor.fresh ? (area.singleton ? area.title : `Add ${area.singular}`) : `Edit ${area.id === 'locations' ? `“${editor.title}”` : editor.title}`) : area?.title || (view === 'curriculum' ? 'Curriculum' : null) || (experience === 'new' ? 'Set up your school' : 'School Setup')}</h1></div></div><div className={styles.actions}>{actions}</div></header>
        {view === 'plans' && !editor && <p className={styles.sectionDescription}>Create reusable pricing models for your school. Choose which models to offer when editing each service; the same model can be used by multiple services.</p>}
        {inlineSettings && dirty && <p role="status" className={styles.sectionDescription}>Unsaved changes</p>}
        {notice && <p role="status" className={styles.notice}>{notice}</p>}
        {view === 'curriculum' ? <CurriculumSection key={experience} levelNames={schoolLevels[experience]} enabledLevels={enabledLevels[experience]} materials={libraries[experience]} onDirty={setCurriculumDirty} onSave={(names, materials, enabled) => { setEnabledLevels(current => ({ ...current, [experience]: enabled })); setSchoolLevels(current => ({ ...current, [experience]: names })); setLibraries(current => ({ ...current, [experience]: materials })); setCurriculumDirty(false) }} /> : !area ? <>{experience === 'configured' && <div className={styles.summary}><div><span>School</span><strong>{data.school[0]?.values.name || 'Not set'}</strong></div><div><span>Timezone</span><strong>{data.school[0]?.values.timezone || 'Not set'}</strong></div><div><span>Currency</span><strong>USD</strong></div></div>}<div className={styles.grid}>{setupAreas.map((item, index) => {
          const Icon = icons[index]
          const records = data[item.id]
          const summary = !records.length ? 'Not set up' : item.singleton ? (item.id === 'school' ? records[0].values.name : 'School-wide rules & agreements') : `${records.length} ${item.singular}${records.length === 1 ? '' : 's'}`
          return <DenseSectionPanel key={item.id} title={item.title} headingLevel="h2" actions={<Button size="sm" variant={records.length ? 'secondary' : 'primary'} aria-label={`${records.length ? 'Manage' : 'Set up'} ${item.title}`} onClick={() => navigate(item.id)}>{records.length ? 'Manage' : 'Set up'}<ArrowRight size={15} /></Button>}><div className={styles.tile}>{records.length ? <><Icon size={24} aria-hidden="true" /><strong>{summary}</strong></> : <EmptyState variant="embedded" density="compact" icon={<Icon size={28} aria-hidden="true" />} title="Not set up" description={`Set up ${item.title.toLowerCase()} to get started.`} />}</div></DenseSectionPanel>
        })}</div></> : editor ? <form id="setup-editor" noValidate onSubmit={event => { event.preventDefault(); save() }} className={['teachers', 'policies'].includes(area.id) ? styles.teacherForm : styles.editor}>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          {area.id === 'locations' && <h2 className={styles.sectionTitle}>Location Details</h2>}
          {area.id === 'plans' && <p className={styles.sectionDescription} role="status">{pricingName(editor.values)}</p>}
          {area.id === 'plans' && editor.values.kind === 'Subscription' && editor.values.basis === 'Per scheduled lesson' && <DurationPricing values={editor.values} onChange={value => updateValue('durationPrices', value)} />}
          {area.id === 'teachers' && <TeacherEditor values={editor.values} services={data.services} locations={data.locations} levels={Object.fromEntries(enabledLevels[experience].map(id => [id, schoolLevels[experience][id]]))} onChange={values => { setEditor({ ...editor, values }); setError('') }} />}
          {area.id === 'policies' && (view === 'calendar' ? <ClosureTable values={editor.values} locations={data.locations} onChange={value => updateValue('closures', value)} /> : <PolicyEditor values={editor.values} onChange={values => { setEditor({ ...editor, values }); setError('') }} />)}
          {!['services', 'teachers', 'policies'].includes(area.id) && <div className={area.id === 'policies' || area.id === 'plans' ? styles.policyFields : undefined}><FieldGrid>{visibleFields(area, editor.values).map(item => {
            const references = item.key === 'service' ? data.services : item.key === 'location' ? data.locations : null
            const options = references?.map(record => ({ value: record.id, label: record.values.name })) || item.options?.map(value => ({ value, label: value }))
            const update = (value: string) => updateValue(item.key, value)
            return options ? <Select key={item.key} label={item.label} value={editor.values[item.key] || ''} onChange={event => update(event.target.value)} required={!item.optional}><option value="">Choose…</option>{options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</Select> : <Input key={item.key} label={item.label} type={item.type || 'text'} min={item.type === 'number' ? 0 : undefined} step={['price', 'fee', 'deposit'].includes(item.key) ? '0.01' : item.type === 'number' ? '1' : undefined} required={!item.optional} value={editor.values[item.key] || ''} onChange={event => update(event.target.value)} />
          })}</FieldGrid></div>}

          {area.id === 'services' && <ServiceEditor plans={data.plans} values={editor.values} levelNames={schoolLevels[experience]} enabledLevels={enabledLevels[experience]} curriculum={editor.curriculum} materials={editor.materials} onValue={updateValue} onCurriculum={curriculum => setEditor(current => ({ ...(current || editor), curriculum }))} />}
          {area.id === 'school' && <section className={styles.formSection} aria-label="School logo"><Input label="School logo" type="file" accept="image/png,image/jpeg,image/webp" hint="PNG, JPEG or WebP, up to 5 MB" onChange={event => loadLogo(event.target.files?.[0])} />{editor.values.logo && <div className={styles.logoPreview}><Image src={editor.values.logo} alt="School logo preview" width={180} height={100} unoptimized /><Button variant="secondary" onClick={() => updateValue('logo', '')}>Remove logo</Button></div>}</section>}
          {area.id === 'locations' && <section className={styles.formSection} aria-label="Rooms"><div className={styles.roomsHeader}><h2>Rooms</h2><Button variant="secondary" onClick={() => updateRooms([...editor.rooms, { id: crypto.randomUUID(), name: '', capacity: '1', serviceIds: [], allServices: true }])}><Plus size={16} />Add room</Button></div><div className={styles.records}>{!editor.rooms.length && <EmptyState variant="embedded" density="compact" icon={<MapPin size={28} aria-hidden="true" />} title="No rooms yet" description="Add a room and set its capacity and available services." />}{editor.rooms.map((room, index) => <DenseSectionPanel key={room.id} title={`Room ${index + 1}`} actions={<ControlButton kind="icon" aria-label={`Remove room ${index + 1}`} onClick={() => updateRooms(editor.rooms.filter(item => item.id !== room.id))}><Trash2 size={17} /></ControlButton>}><FieldGrid columns={1}><Input label="Room name" required value={room.name} onChange={event => updateRooms(editor.rooms.map(item => item.id === room.id ? { ...item, name: event.target.value } : item))} /><Input label="Capacity" type="number" min={1} step={1} required value={room.capacity} onChange={event => updateRooms(editor.rooms.map(item => item.id === room.id ? { ...item, capacity: event.target.value } : item))} /><StudentMultiSelect label="Services this room can accommodate" ariaLabel={`Room ${index + 1} services`} value={room.allServices ? '__all__' : room.serviceIds.join(', ')} options={[{ value: '__all__', label: 'All' }, ...data.services.map(service => ({ value: service.id, label: service.values.name }))]} onChange={value => updateRooms(editor.rooms.map(item => item.id === room.id ? { ...item, allServices: value.includes('__all__') && !item.allServices || value === '__all__', serviceIds: value.split(',').map(id => id.trim()).filter(id => id && id !== '__all__') } : item))} /></FieldGrid><FieldGrid columns={1}><Input label={`Room ${index + 1} online lesson link`} type="url" hint="Optional conference URL for lessons in this room." value={room.conferenceUrl || ''} onChange={event => updateRooms(editor.rooms.map(item => item.id === room.id ? { ...item, conferenceUrl: event.target.value } : item))} /></FieldGrid></DenseSectionPanel>)}</div></section>}
        </form> : <div className={styles.records}>{area.id === 'plans' && !data.plans.length && <EmptyState variant="panel" density="compact" icon={<Wallet size={28} aria-hidden="true" />} title="No pricing models yet" description="Add a plan to set your prices and billing rules." />}{data[area.id].map(record => <DenseSectionPanel key={record.id} title={view === 'calendar' ? 'School calendar' : area.id === 'plans' ? pricingName(record.values) : record.values.name} headingLevel="h2" actions={!area.singleton ? <Button variant="ghost" aria-label={`Edit ${area.id === 'plans' ? pricingName(record.values) : record.values.name}`} onClick={() => edit(record)}><Pencil size={15} aria-hidden="true" />Edit</Button> : undefined}><dl className={styles.facts}>{(area.id === 'policies' ? [] : visibleFields(area, record.values)).filter(item => item.key !== 'name').map(item => <div key={item.key}><dt>{item.label}</dt><dd>{display(item.key, record.values[item.key])}</dd></div>)}</dl>{area.id === 'services' && <dl className={styles.facts}><div><dt>Lesson formats</dt><dd>{lessonFormats.filter(format => selection(record.values.formats).includes(format.id)).map(format => format.label).join(' · ')}</dd></div><div><dt>Scheduling</dt><dd>{schedulingChoices.filter(option => selection(record.values.scheduling).includes(option.value)).map(option => option.label).join(', ')}</dd></div><div><dt>Pricing models</dt><dd>{selection(record.values.planIds).map(id => data.plans.find(plan => plan.id === id)?.values.name).filter(Boolean).join(' · ') || 'None selected'}</dd></div><div><dt>Levels offered</dt><dd>{display('levelIds', record.values.levelIds)}</dd></div></dl>}{area.id === 'teachers' && <p>{display('levelIds', record.values.levelIds)}</p>}{area.id === 'school' && record.values.logo && <div className={styles.logoPreview}><Image src={record.values.logo} alt="School logo" width={180} height={100} unoptimized /></div>}{area.id === 'locations' && <RoomTable rooms={record.rooms || []} services={data.services} locationName={record.values.name} />}</DenseSectionPanel>)}{area.id === 'plans' && <DiscountsPanel key={experience} policy={discountPolicies[experience]} onPolicySave={policy => setDiscountPolicies(current => ({ ...current, [experience]: policy }))} value={discounts[experience]} onSave={value => setDiscounts(current => ({ ...current, [experience]: value }))} onDirty={setCurriculumDirty} />}</div>}
        {area?.id === 'policies' && view !== 'calendar' && <AgreementsPanel key={experience} value={data.policies[0]?.values.agreements || ''} services={data.services} onDirty={setCurriculumDirty} onSave={value => { setExperiences(current => ({ ...current, [experience]: { ...current[experience], policies: current[experience].policies.length ? current[experience].policies.map(record => ({ ...record, values: { ...record.values, agreements: value } })) : [{ id: crypto.randomUUID(), values: { name: 'School defaults', agreements: value } }] } })); setCurriculumDirty(false) }} />}
      </main>
    </div>
    </div>
  </div>
}