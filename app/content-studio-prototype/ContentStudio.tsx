'use client'

import { useEffect, useState, type ChangeEvent, type ReactNode, type CSSProperties } from 'react'
import { CalendarDays, Clock, Megaphone, Newspaper, Link as LinkIcon, ArrowLeft, Guitar, Drum, Mic, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ConfirmActionButton } from '@/components/ui/ConfirmActionButton'
import { ActionConfirmation } from '@/components/ui/ActionConfirmation'
import { SectionTitle } from '@/components/ui/SectionTitle'
import { DenseSectionPanel } from '@/components/ui/DenseSectionPanel'
import { SurfacePanel } from '@/components/ui/SurfacePanel'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PageHeader } from '@/components/ui/PageHeader'
import { colors } from '@/lib/tokens'
import { canonicalCommunityUrl } from '@/lib/community-posts'
import { contentKinds, newStudioDraft, placements, publishErrors, studioSteps, studioStepErrors, safeCta, eventThemes, eventTreatment, eventTimes, posterLogoFilter, websiteStatus, type StudioDraft } from '@/lib/content-studio-prototype'
import LocationField from './LocationField'
import ArticlePolishField from './ArticlePolishField'
import { getActiveTenantId } from '@/lib/tenant'
import { websiteViews, type WebsiteViewKind } from '@/lib/work-area-navigation'
import styles from './studio.module.css'

const icons = [CalendarDays, Clock, Megaphone, Newspaper, LinkIcon]
const storageKey = 'pulse-content-studio-prototype-v1'

export default function ContentStudio({ connected = false, contentKind }: { connected?: boolean; contentKind?: WebsiteViewKind }) {
  const [items, setItems] = useState<StudioDraft[]>([])
  const [draft, setDraft] = useState<StudioDraft | null>(null)
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [publishedResult, setPublishedResult] = useState<StudioDraft | null>(null)
  const [revision, setRevision] = useState(0)
  const [tenant, setTenant] = useState('')
  const enabledKinds = connected ? contentKinds.filter(type => type.kind !== 'social') : contentKinds
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  const activeView = websiteViews.find(view => view.kind === contentKind)
  const visibleItems = contentKind ? items.filter(item => item.kind === contentKind) : items
  const recoveryKey = `pulse:website-editor:${tenant}:${contentKind || 'all'}`
  const dirty = !!draft && JSON.stringify(draft) !== JSON.stringify(items.find(item => item.id === draft.id))

  // Keep an interrupted editor recoverable when sidebar routes unmount it.
  useEffect(() => {
    if (!connected || !ready || !tenant) return
    try {
      if (draft) sessionStorage.setItem(recoveryKey, JSON.stringify({ draft, step }))
      else sessionStorage.removeItem(recoveryKey)
    } catch { /* The navigation guard still protects unsaved edits when storage is unavailable. */ }
  }, [connected, ready, tenant, recoveryKey, draft, step])

  useEffect(() => {
    if (!connected || !dirty) return
    const beforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    const leave = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const anchor = (event.target as Element).closest('a[href]')
      if (!anchor || anchor.getAttribute('target') === '_blank') return
      const href = (anchor as HTMLAnchorElement).href
      if (href === window.location.href) return
      if (!window.confirm('Leave this editor? Your changes have not been saved to the website. A recovery copy is kept in this tab when browser storage is available.')) {
        event.preventDefault(); event.stopPropagation()
      }
    }
    window.addEventListener('beforeunload', beforeUnload)
    document.addEventListener('click', leave, true)
    return () => { window.removeEventListener('beforeunload', beforeUnload); document.removeEventListener('click', leave, true) }
  }, [connected, dirty])
  useEffect(() => {
    if (connected) {
      const selected = new URLSearchParams(window.location.search).get('tenant') || getActiveTenantId()
      setTenant(selected)
      let cancelled = false
      fetch(`/api/website-content?tenant=${selected}`, { cache: 'no-store' }).then(async response => {
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Content could not be loaded.')
        if (!cancelled) {
          setItems(result.items); setRevision(result.revision)
          try {
            const recovered = JSON.parse(sessionStorage.getItem(`pulse:website-editor:${selected}:${contentKind || 'all'}`) || 'null')
            if (recovered?.draft && typeof recovered.draft.id === 'string' && contentKinds.some(type => type.kind === recovered.draft.kind && type.kind !== 'social') && (!contentKind || recovered.draft.kind === contentKind)) {
              setDraft(recovered.draft); setStep(Number.isInteger(recovered.step) && recovered.step >= 0 && recovered.step <= 2 ? recovered.step : 0)
              setMessage('Restored your editor from this tab. Review it before saving or publishing.')
            }
          } catch { /* Ignore invalid or unavailable recovery data. */ }
          setReady(true)
        }
      }).catch(error => { if (!cancelled) setErrors([error.message]) })
      return () => { cancelled = true }
    }
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]')
      if (Array.isArray(saved)) setItems(saved.filter(item => item && typeof item.id === 'string' && contentKinds.some(type => type.kind === item.kind)))
    } catch { /* An unavailable browser store starts an empty session. */ }
    setReady(true)
  }, [connected, contentKind])

  const update = (changes: Partial<StudioDraft>) => {
    setDraft(current => current ? { ...current, ...changes } : null)
    setErrors([])
    setMessage('')
  }
  const persist = (next: StudioDraft[]) => {
    setItems(next)
    try { sessionStorage.setItem(storageKey, JSON.stringify(next)) }
    catch { setMessage('Saved in memory only: browser storage is full or unavailable. Keep this tab open.') }
  }
  const command = async (item: StudioDraft, action: string) => {
    if (busy) return false
    setBusy(true)
    try {
      const response = await fetch(`/api/website-content?tenant=${tenant}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ item, action, revision }) })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Content could not be saved.')
      setItems(result.items); setRevision(result.revision)
      setDraft(current => current?.id === item.id ? result.items.find((row: StudioDraft) => row.id === item.id) : current)
      setErrors([])
      if (action === 'publish') setPublishedResult(result.items.find((row: StudioDraft) => row.id === item.id) || item)
      setMessage(action === 'publish' ? '' : action === 'unpublish' || action === 'archive' ? 'Removed from the live website.' : 'Draft saved. Any previously published version is unchanged.')
      return true
    } catch (error) { setErrors([error instanceof Error ? error.message : 'Content could not be saved.']); return false }
    finally { setBusy(false) }
  }
  const save = async (status: StudioDraft['status']) => {
    if (!draft) return
    if (connected) { await command(draft, status === 'published' ? 'publish' : 'save'); return }
    if (status === 'published') {
      const problems = publishErrors(draft, items.filter(item => item.id !== draft.id && item.kind === 'social' && item.status === 'published' && item.featured).length)
      if (problems.length) { setErrors(problems); return }
    }
    const saved = { ...draft, status, publishedAt: status === 'published' ? draft.publishedAt || new Date().toISOString() : draft.publishedAt }
    setMessage(status === 'published' ? '' : 'Draft saved in this browser tab only.')
    persist([...items.filter(item => item.id !== saved.id), saved])
    setDraft(saved)
    if (status === 'published') setPublishedResult(saved)
    setErrors([])
  }
  const upload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setErrors(['Choose a JPG, PNG, or WebP image smaller than 4 MB for this local prototype.']); return
    }
    const targetId = draft?.id
    const isArtwork = draft?.artwork === 'upload' && !['article', 'social'].includes(draft.kind)
    const fileDetails = isArtwork ? { artworkFileName: file.name, artworkFileType: file.type } : { imageFileName: file.name, imageFileType: file.type }
    if (connected) {
      setBusy(true)
      try {
        const response = await fetch(`/api/website-content/assets?tenant=${tenant}`, { method: 'POST', headers: { 'Content-Type': file.type }, body: file })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Image upload failed.')
        setDraft(current => current && current.id === targetId ? { ...current, ...fileDetails, ...(isArtwork ? { artworkImage: result.url } : { image: result.url }) } : current)
        setErrors([])
      } catch (error) { setErrors([error instanceof Error ? error.message : 'Image upload failed.']) }
      finally { setBusy(false); event.target.value = '' }
      return
    }
    const reader = new FileReader()
    reader.onload = () => setDraft(current => current && current.id === targetId ? { ...current, ...fileDetails, ...(isArtwork ? { artworkImage: String(reader.result) } : { image: String(reader.result) }) } : current)
    reader.onerror = () => setErrors(['The image could not be read. Please try another file.'])
    reader.readAsDataURL(file)
  }
  const field = (key: keyof StudioDraft, label: string, type = 'text', hint?: string) => <div><label htmlFor={`studio-${key}`}>{label}</label><Input id={`studio-${key}`} type={type} value={String(draft?.[key] ?? '')} onChange={event => update({ [key]: event.target.value })} hint={hint} /></div>
  const uploadReferences = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    const targetId = draft?.id
    if (files.length + (draft?.styleReferences?.length || 0) > 5 || files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024)) { setErrors(['Choose up to five JPG, PNG, or WebP references, each under 4 MB.']); return }
    try {
      const references = await Promise.all(files.map(file => new Promise<{ name: string; image: string }>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve({ name: file.name, image: String(reader.result) }); reader.onerror = reject; reader.readAsDataURL(file) })))
      setDraft(current => current && current.id === targetId ? { ...current, styleReferences: [...(current.styleReferences || []), ...references].slice(0, 5) } : current)
    } catch { setErrors(['The reference image could not be read.']) }
    event.target.value = ''
  }
  const text = (key: 'summary' | 'body', label: string, rows = 3, hint?: string) => <div><label htmlFor={`studio-${key}`}>{label}</label><Textarea id={`studio-${key}`} rows={rows} value={draft?.[key] ?? ''} onChange={event => update({ [key]: event.target.value })} hint={hint} /></div>
  const banner = draft ? ['event', 'deadline', 'announcement'].includes(draft.kind) : false
  const goHome = async () => {
    if (connected && draft && !await command(draft, 'save')) return
    if (!connected && draft) persist([...items.filter(item => item.id !== draft.id), draft])
    setDraft(null)
    setStep(0)
    setErrors([])
  }
  const startDraft = (kind: StudioDraft['kind']) => {
    setDraft({ ...newStudioDraft(kind), ...(connected && kind !== 'article' ? { artwork: 'upload' as const } : {}) })
    setStep(0); setErrors([]); setMessage('')
  }
  const imageLayoutControls = draft?.image ? <fieldset className={styles.imageOptions}><legend>Photo placement</legend>{(['separate', 'overlay'] as const).map(value => <label key={value}><input type="radio" name="image-layout" value={value} checked={(draft.imageLayout || 'separate') === value} onChange={() => update({ imageLayout: value })} />{value === 'separate' ? 'Separate' : 'Overlay'}</label>)}</fieldset> : null
  const references = <div><label htmlFor="studio-references">Style references</label><div className={styles.upload}><span>Upload references</span><input id="studio-references" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={uploadReferences} /></div><div className={styles.referenceGrid}>{draft?.styleReferences?.map((reference, index) => <div key={`${reference.name}-${index}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={reference.image} alt={reference.name} /><Button variant="ghost" size="sm" onClick={() => update({ styleReferences: draft.styleReferences?.filter((_, position) => position !== index) })}>Remove</Button></div>)}</div></div>
  const imageUpload = (artwork = false) => {
    const src = artwork ? draft?.artworkImage ?? draft?.image : draft?.image
    const name = artwork ? draft?.artworkFileName : draft?.imageFileName
    const mime = artwork ? draft?.artworkFileType : draft?.imageFileType
    const format = mime?.replace('image/', '').toUpperCase() || src?.match(/\.(png|jpe?g|webp)(?:[?#]|$)/i)?.[1].toUpperCase()
    const label = artwork ? 'Artwork' : draft?.kind === 'article' ? 'Article image' : draft?.kind === 'social' ? 'Preview image (optional)' : 'Supporting photo (optional)'
    const remove = artwork
      ? () => update({ artworkImage: '', artworkAlt: '', artworkFileName: '', artworkFileType: '' })
      : () => update({ image: '', imageAlt: '', imageFileName: '', imageFileType: '' })
    return <div><label htmlFor="studio-image">{label}</label>{src ? <SurfacePanel appearance="flat">
      <div className={styles.uploadedPhoto}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated and browser-local image URLs. */}
        <img className={styles.thumbnail} src={src} alt={artwork ? draft?.artworkAlt || '' : draft?.imageAlt || ''} />
        <div className={styles.fileDetails}><strong>{artwork ? 'Artwork uploaded' : 'Photo uploaded'}</strong>{name && <span>{name}</span>}{format && <span className={styles.small}>{format}</span>}</div>
        <div className={styles.photoActions}>
          <Button variant="secondary" size="sm" type="button" onClick={() => document.getElementById('studio-image')?.click()}>{artwork ? 'Replace artwork' : 'Replace photo'}</Button>
          <Button variant="ghost" size="sm" type="button" onClick={remove}>{artwork ? 'Remove artwork' : 'Remove photo'}</Button>
        </div>
      </div>
      <input className={styles.hiddenFile} tabIndex={-1} id="studio-image" aria-label={label} type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} />
    </SurfacePanel> : <div className={styles.upload}><span>{artwork ? 'Upload artwork' : 'Upload photo'}</span><input id="studio-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></div>}</div>
  }
  const imageFields = <>
    {imageUpload()}
    {draft?.image && field('imageAlt', 'Image description')}
    {draft?.kind === 'article' && field('credit', 'Photo / contributor credit (optional)')}
  </>

  return <div className={styles.light}><fieldset disabled={busy} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}><main className={styles.shell}>
    <div className={styles.notice}>{connected ? <><strong>Website Content</strong> · Drafts are private. Publishing updates the public website. Upload finished flyers; generated templates remain preview-only.</> : <><strong>Prototype</strong> · Publishing is simulated.</>}</div>
    <PageHeader title={draft ? contentKinds.find(item => item.kind === draft.kind)!.label : connected ? activeView?.label || 'All content' : 'Content Studio'} subtitle={draft ? undefined : connected ? activeView ? `Manage your website ${activeView.label.toLowerCase()}. Drafts stay private until you publish.` : 'All your website content in one place. Choose a content type in the sidebar to create something new.' : 'What are you updating at Headliner?'} right={connected && !draft && activeView ? <Button disabled={!ready || busy} onClick={() => startDraft(activeView.kind)}>Create {activeView.singular}</Button> : undefined} />
    <div role="status" aria-live="polite">{busy ? 'Saving…' : message}</div>
    {connected && !draft && !!errors.length && <ul role="alert" className={styles.errors}>{errors.map(error => <li key={error}>{error}</li>)}</ul>}
    {!draft ? <>
      {!connected && <div className={styles.choices}>{enabledKinds.map(type => {
        const Icon = icons[contentKinds.findIndex(kind => kind.kind === type.kind)]
        return <button className={styles.choice} key={type.kind} disabled={!ready || busy} onClick={() => startDraft(type.kind)}><Icon size={24} aria-hidden="true" /><strong>{type.label}</strong><span>{type.description}</span></button>
      })}</div>}
      {connected && !ready && !errors.length && <p role="status">Loading content…</p>}
      {connected && ready && !visibleItems.length && <p>No {activeView?.label.toLowerCase() || 'content'} yet.{activeView ? ` Create your first ${activeView.singular} to get started.` : ' Choose a content type in the sidebar to get started.'}</p>}
      {!!visibleItems.length && <SectionTitle as="h2">Your Content</SectionTitle>}
      <ul className={styles.list}>{visibleItems.map(item => {
        const preview = item.kind === 'article' || item.kind === 'social' ? item.image : item.artworkImage || item.image
        return <li key={item.id}><DenseSectionPanel title={item.title || 'Untitled draft'} actions={<div className={styles.contentActions}>{connected && item.hasPublishedVersion && <Button variant="ghost" size="sm" disabled={busy} onClick={() => void command(item, 'unpublish')}>Remove from website</Button>}<Button variant="secondary" size="sm" onClick={() => { setDraft(item); setStep(0); setErrors([]) }}>Open</Button><Button variant="ghost" size="sm" onClick={() => connected ? void command(item, item.status === 'archived' ? 'save' : 'archive') : persist(items.map(row => row.id === item.id ? { ...row, status: row.status === 'archived' ? 'draft' : 'archived' } : row))}>{item.status === 'archived' ? 'Restore draft' : 'Archive'}</Button></div>}><div className={styles.contentSummary}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Authenticated and browser-local image URLs. */}
          {preview && <img className={styles.thumbnail} src={preview} alt={item.kind === 'article' || item.kind === 'social' ? item.imageAlt || '' : item.artworkAlt || item.imageAlt || ''} loading="lazy" />}
          <div className={styles.fileDetails}><div><Badge size="sm">{contentKinds.find(type => type.kind === item.kind)?.label}</Badge></div><span className={styles.small}>{connected ? websiteStatus(item) : item.status === 'published' ? 'Published (simulation)' : item.status}</span></div>
        </div></DenseSectionPanel></li>
      })}</ul>
      {!connected && !!items.length && <Button variant="ghost" onClick={() => { if (window.confirm('Clear all prototype drafts in this tab?')) persist([]) }}>Reset prototype workspace</Button>}
    </> : <div className={styles.eventEditor}>
      <Button variant="ghost" size="sm" onClick={goHome}><ArrowLeft size={16} />{connected ? 'Back to Website Content' : 'Content Studio'}</Button>
      <ol className={styles.wizardSteps} aria-label="Content creation steps">{studioSteps(draft.kind).map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-active={step === index}><span>{index + 1}</span>{label}</li>)}</ol>
      {connected && <p className={styles.small}>{websiteStatus(draft)}</p>}
      {step === 0 && <section className={`${styles.panel} ${styles.fields} ${styles.details}`} aria-label="Content details">
        {field('title', draft.kind === 'social' ? 'Internal post title' : 'Headline', 'text', draft.kind === 'article' ? 'The title readers will see on the website and at the top of this article.' : undefined)}
        {draft.kind === 'article' && connected ? <ArticlePolishField key={`${draft.id}-summary`} tenant={tenant} field="summary" label="Short introduction" rows={3} value={draft.summary} onChange={summary => update({ summary })} hint="One or two sentences that help readers decide to open the story. This appears on the homepage article card." /> : draft.kind !== 'social' && text('summary', draft.kind === 'article' ? 'Short introduction' : 'Supporting text')}
        {draft.kind === 'event' && <><div className={styles.pair}>{field('date', 'Event date', 'date')}<div><label htmlFor="studio-time">Event time</label><select id="studio-time" className={styles.select} value={draft.time} onChange={event => update({ time: event.target.value })}><option value="">Select time</option>{draft.time && !eventTimes.some(option => option.value === draft.time) && <option value={draft.time} disabled>{draft.time} — choose a new time</option>}{eventTimes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></div><LocationField value={draft.location} onChange={location => update({ location })} /></>}
        {draft.kind === 'deadline' && field('date', 'Deadline date', 'date')}
        {draft.kind === 'announcement' && field('expires', 'Expiration (optional)', 'date')}
        {draft.kind === 'article' && <>
          {field('category', 'Category (optional)', 'text', 'A short label shown with the story, for example: Student story, Academy news, or Community event. Leave blank if you don’t need one.')}
          {connected && field('publicationDate', 'Date shown on the article (optional)', 'date', 'Choose a date to display with the story. Leave blank to use the first publish date.')}
          {connected ? <ArticlePolishField key={`${draft.id}-body`} tenant={tenant} field="body" label="Full story" rows={10} value={draft.body} onChange={body => update({ body })} /> : text('body', 'Full story', 10)}
          <details key={`${draft.id}-link`} open={draft.ctaLabel || draft.ctaUrl ? true : undefined}>
            <summary>Add a text link (optional)</summary>
            {field('ctaLabel', 'Text to display', 'text', 'The words readers click at the end of the story, such as View event details or Read the original story.')}
            {field('ctaUrl', 'Link to', 'url')}
            {(draft.ctaLabel || draft.ctaUrl) && <Button type="button" variant="ghost" onClick={() => update({ ctaLabel: '', ctaUrl: '' })}>Remove link</Button>}
          </details>
          {draft.bodyImages?.map((image, index) => <div key={image.src}><p>Additional article image: {image.alt}</p><Button variant="ghost" onClick={() => update({ bodyImages: draft.bodyImages?.filter((_, position) => position !== index) })}>Remove additional image</Button></div>)}
        </>}
        {banner && field('ctaLabel', 'Banner CTA (optional)')}
        {draft.kind === 'social' && <>{field('socialUrl', 'Original Instagram / TikTok post URL', 'url')}<label><input type="checkbox" checked={draft.permission} onChange={event => update({ permission: event.target.checked })} /> Permission confirmed</label><label><input type="checkbox" checked={draft.featured} onChange={event => update({ featured: event.target.checked })} /> Feature on homepage</label></>}
      </section>}
      {step === 1 && <div className={styles.workspace}>
        <section className={`${styles.panel} ${styles.fields}`} aria-label="Content design">
          {banner && !connected && <div className={styles.actions}>{(['template', 'upload'] as const).map(value => <Button key={value} variant={draft.artwork === value ? 'primary' : 'secondary'} aria-pressed={draft.artwork === value} onClick={() => update({ artwork: value })}>{value === 'template' ? 'Use Template' : 'Upload artwork'}</Button>)}</div>}
          {banner && draft.artwork === 'upload' ? <>{imageUpload(true)}{(draft.artworkImage ?? draft.image) && <div><label htmlFor="studio-artworkAlt">Image description</label><Input id="studio-artworkAlt" value={draft.artworkAlt ?? draft.imageAlt} onChange={event => update({ artworkAlt: event.target.value })} /></div>}</> : <>
            {banner && <><label><input type="checkbox" checked={draft.includeLogo !== false} onChange={event => update({ includeLogo: event.target.checked })} /> Include Logo</label><div><label>Design</label><div className={styles.designPicker}>{eventThemes.map(theme => <button type="button" key={theme.id} aria-label={`Choose ${theme.label} design`} aria-pressed={eventTreatment(draft).id === theme.id} onClick={() => update({ designId: theme.id, posterLayout: undefined })}><div className={styles.designThumbnail} style={{ background: theme.background, color: theme.foreground }}><strong>{theme.label}</strong>{theme.layout === 'workshop' ? <NotebookPen /> : theme.layout === 'portrait' ? <Mic /> : <Guitar />}</div><span>{theme.label}</span></button>)}</div></div></>}
            {imageFields}
            {banner && imageLayoutControls}
          </>}
          {!connected && references}
        </section>
        <aside className={styles.preview} aria-label="Live preview"><h2>Preview</h2><ContentPreview draft={draft} mode={draft.kind === 'article' ? 'story' : 'digital'} /></aside>
      </div>}
      {step === 2 && <section className={styles.final} aria-label="Final preview"><h2>Final Preview</h2><div className={styles.printArtwork}><ContentPreview draft={draft} mode={draft.kind === 'article' ? 'story' : 'digital'} /></div><div className={styles.actions}>{placements(draft).map(place => <span className={styles.eyebrow} key={place}>{place}</span>)}</div></section>}
      {!!errors.length && <ul role="alert" className={styles.errors}>{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      <footer className={styles.wizardFooter}><Button variant="secondary" onClick={() => { setErrors([]); if (step > 0) setStep(step - 1); else goHome() }}>Back</Button><div className={styles.footerForward}><Button variant="ghost" onClick={() => save('draft')}>Save draft</Button>{step === 2 ? <>{banner && <Button variant="secondary" onClick={() => window.print()}>Print</Button>}<ConfirmActionButton disabled={busy} loadingLabel="Publishing" onClick={() => save('published')}>Publish to Website</ConfirmActionButton></> : <Button onClick={() => { const problems = studioStepErrors(draft, step); if (problems.length) setErrors(problems); else { setErrors([]); setStep(step + 1) } }}>Next</Button>}</div></footer>
    </div>}

  </main></fieldset>{publishedResult && <ActionConfirmation message={connected ? `“${publishedResult.title}” published.` : `“${publishedResult.title}” published in this prototype only. Nothing was sent to the website.`} onClose={() => { setPublishedResult(null); setDraft(null); setStep(0); setMessage(''); setErrors([]) }} />}</div>
}

function ContentPreview({ draft, mode }: { draft: StudioDraft; mode: string }) {
  // Browser-local data URLs must stay local; do not send prototype uploads to an image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  const image = draft.image ? <img className={styles.artwork} src={draft.image} alt={draft.imageAlt || 'Uploaded artwork preview'} /> : <div className={styles.placeholder}>Your supplied image will appear here.</div>
  const cta: ReactNode = draft.ctaLabel && safeCta(draft.ctaUrl) ? <a href={draft.ctaUrl} target="_blank" rel="noreferrer" style={{ color: colors.link }}>{draft.ctaLabel} ↗</a> : null
  if (['event', 'deadline', 'announcement'].includes(draft.kind) && draft.artwork === 'upload') {
    const artwork = draft.artworkImage ?? draft.image
    // eslint-disable-next-line @next/next/no-img-element
    return artwork ? <img className={styles.artwork} src={artwork} alt={draft.artworkAlt ?? draft.imageAlt} /> : <div className={styles.placeholder}>Upload artwork</div>
  }
  if (draft.kind === 'social') {
    let post: ReturnType<typeof canonicalCommunityUrl> | null = null
    try { post = canonicalCommunityUrl(draft.socialUrl) } catch { /* Show a neutral preview until the URL is valid. */ }
    return <div className={styles.panel}><p className={styles.eyebrow}>{post?.platform || 'Social post'} · preview reference</p>{image}<h3>{draft.title || 'Curated community post'}</h3>{post ? <a href={post.url} target="_blank" rel="noreferrer" style={{ color: colors.link }}>Open original {post.platform} post ↗</a> : null}</div>
  }
  if (draft.kind === 'article') return <article className={`${styles.panel} ${styles.story}`}>{image}<p className={styles.eyebrow}>{draft.category || 'Article'}{draft.publishedAt ? ` · ${new Date(draft.publishedAt).toLocaleDateString('en-US')}` : ''}</p><h3>{draft.title || 'Your story headline'}</h3>{draft.credit && <p className={styles.small}>{draft.credit}</p>}<p>{draft.summary || 'A short introduction to the story.'}</p>{mode === 'story' && <><p>{draft.body || 'The full story will appear here.'}</p>{cta}</>}</article>
  return <EventPoster draft={draft} />
}

function EventPoster({ draft }: { draft: StudioDraft }) {
  const theme = eventTreatment(draft)
  const layout = theme.layout
  const date = /^\d{4}-\d{2}-\d{2}$/.test(draft.date) ? new Date(`${draft.date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }) : draft.kind === 'announcement' ? '' : 'Date to be announced'
  const time = /^\d{2}:\d{2}$/.test(draft.time) ? new Date(`2000-01-01T${draft.time}:00Z`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' }) : ''
  return <article className={`${styles.eventPoster} ${styles[layout]} ${draft.imageLayout === 'overlay' ? styles.overlayPhoto : styles.separatePhoto}`} style={{ backgroundColor: theme.background, color: theme.foreground, '--poster-background': theme.background } as CSSProperties} aria-label={`${theme.label} poster`}>
    {draft.image ? /* Browser-local supporting photos stay out of the image optimizer. */
      // eslint-disable-next-line @next/next/no-img-element
      <img className={styles.supportingPhoto} src={draft.image} alt={draft.imageAlt || 'Supporting photo preview'} /> : null}
    <div className={styles.posterContent}><h3>{draft.title || 'Your headline'}</h3>{!draft.image && <div className={styles.musicGraphic} aria-hidden="true">{layout === 'workshop' ? <NotebookPen /> : layout === 'portrait' ? <Mic /> : layout === 'instruments' || layout === 'ensemble' ? <><Guitar /><Drum /><Guitar /></> : <><Mic /><Guitar /></>}</div>}<div className={styles.posterDetails}><strong>{date}{time && <><br />{time}</>}</strong>{draft.summary && <p>{draft.summary}</p>}{draft.location && <p className={styles.posterLocation}>{draft.location}</p>}{draft.ctaLabel.trim() && <p className={styles.posterCta}>{draft.ctaLabel}</p>}</div>
      {draft.includeLogo !== false && <div className={styles.posterBrand}>
        {/* Existing academy-managed logo; no image optimization for this prototype. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img style={{ filter: posterLogoFilter(theme.foreground) }} src="https://res.cloudinary.com/diy08lj9x/image/upload/v1780713493/Asset_1_2x_a5hm0v.png" alt="Headliner Music Academy" />
      </div>}
    </div>
  </article>
}