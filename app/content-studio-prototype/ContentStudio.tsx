'use client'

import { useEffect, useState, type ChangeEvent, type ReactNode, type CSSProperties } from 'react'
import { CalendarDays, Clock, Megaphone, Newspaper, Link as LinkIcon, ArrowLeft, Guitar, Drum, Mic, NotebookPen } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { PageHeader } from '@/components/ui/PageHeader'
import { colors } from '@/lib/tokens'
import { canonicalCommunityUrl } from '@/lib/community-posts'
import { contentKinds, newStudioDraft, placements, publishErrors, studioSteps, studioStepErrors, safeCta, eventThemes, eventTreatment, eventTimes, posterLogoFilter, type StudioDraft } from '@/lib/content-studio-prototype'
import LocationField from './LocationField'
import styles from './studio.module.css'

const icons = [CalendarDays, Clock, Megaphone, Newspaper, LinkIcon]
const storageKey = 'pulse-content-studio-prototype-v1'

export default function ContentStudio() {
  const [items, setItems] = useState<StudioDraft[]>([])
  const [draft, setDraft] = useState<StudioDraft | null>(null)
  const [step, setStep] = useState(0)
  const [ready, setReady] = useState(false)
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState<string[]>([])
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || '[]')
      if (Array.isArray(saved)) setItems(saved.filter(item => item && typeof item.id === 'string' && contentKinds.some(type => type.kind === item.kind)))
    } catch { /* An unavailable browser store starts an empty session. */ }
    setReady(true)
  }, [])

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
  const save = (status: StudioDraft['status']) => {
    if (!draft) return
    if (status === 'published') {
      const problems = publishErrors(draft, items.filter(item => item.id !== draft.id && item.kind === 'social' && item.status === 'published' && item.featured).length)
      if (problems.length) { setErrors(problems); return }
    }
    const saved = { ...draft, status, publishedAt: status === 'published' ? draft.publishedAt || new Date().toISOString() : draft.publishedAt }
    setMessage(status === 'published' ? 'Published in this prototype only. Nothing was sent to the website.' : 'Draft saved in this browser tab only.')
    persist([...items.filter(item => item.id !== saved.id), saved])
    setDraft(saved)
    setErrors([])
  }
  const upload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setErrors(['Choose a JPG, PNG, or WebP image smaller than 4 MB for this local prototype.']); return
    }
    const targetId = draft?.id
    const isArtwork = draft?.artwork === 'upload' && !['article', 'social'].includes(draft.kind)
    const reader = new FileReader()
    reader.onload = () => setDraft(current => current && current.id === targetId ? { ...current, ...(isArtwork ? { artworkImage: String(reader.result) } : { image: String(reader.result) }) } : current)
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
  const text = (key: 'summary' | 'body', label: string, rows = 3) => <div><label htmlFor={`studio-${key}`}>{label}</label><Textarea id={`studio-${key}`} rows={rows} value={draft?.[key] ?? ''} onChange={event => update({ [key]: event.target.value })} /></div>
  const banner = draft ? ['event', 'deadline', 'announcement'].includes(draft.kind) : false
  const goHome = () => {
    if (draft) persist([...items.filter(item => item.id !== draft.id), draft])
    setDraft(null)
    setStep(0)
    setErrors([])
  }
  const imageLayoutControls = draft?.image ? <fieldset className={styles.imageOptions}><legend>Photo placement</legend>{(['separate', 'overlay'] as const).map(value => <label key={value}><input type="radio" name="image-layout" value={value} checked={(draft.imageLayout || 'separate') === value} onChange={() => update({ imageLayout: value })} />{value === 'separate' ? 'Separate' : 'Overlay'}</label>)}</fieldset> : null
  const references = <div><label htmlFor="studio-references">Style references</label><div className={styles.upload}><span>Upload references</span><input id="studio-references" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={uploadReferences} /></div><div className={styles.referenceGrid}>{draft?.styleReferences?.map((reference, index) => <div key={`${reference.name}-${index}`}>
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={reference.image} alt={reference.name} /><Button variant="ghost" size="sm" onClick={() => update({ styleReferences: draft.styleReferences?.filter((_, position) => position !== index) })}>Remove</Button></div>)}</div></div>
  const imageFields = <>
    <div><label htmlFor="studio-image">{draft?.kind === 'article' ? 'Article image' : draft?.kind === 'social' ? 'Preview image (optional)' : 'Supporting photo (optional)'}</label><div className={styles.upload}><span>{draft?.image ? 'Replace photo' : 'Upload photo'}</span><input id="studio-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></div></div>
    {draft?.image && <>{field('imageAlt', 'Image description')}<Button variant="ghost" size="sm" onClick={() => update({ image: '', imageAlt: '' })}>Remove image</Button></>}
    {draft?.kind === 'article' && field('credit', 'Photo / contributor credit (optional)')}
  </>

  return <div className={styles.light}><main className={styles.shell}>
    <div className={styles.notice}><strong>Prototype</strong> · Publishing is simulated.</div>
    <PageHeader title={draft ? contentKinds.find(item => item.kind === draft.kind)!.label : 'Content Studio'} subtitle={draft ? undefined : 'What are you updating at Headliner?'} />
    <div role="status" aria-live="polite">{message}</div>
    {!draft ? <>
      <div className={styles.choices}>{contentKinds.map((type, index) => {
        const Icon = icons[index]
        return <button className={styles.choice} key={type.kind} disabled={!ready} onClick={() => { setDraft(newStudioDraft(type.kind)); setStep(0); setErrors([]); setMessage('') }}><Icon size={24} aria-hidden="true" /><strong>{type.label}</strong><span>{type.description}</span></button>
      })}</div>
      {!!items.length && <h2>Your workspace</h2>}
      <ul className={styles.list}>{items.map(item => <li key={item.id}><div><strong>{item.title || 'Untitled draft'}</strong><span className={styles.small}>{item.kind} · {item.status === 'published' ? 'Published (simulation)' : item.status}</span></div><div className={styles.actions}><Button variant="secondary" size="sm" onClick={() => { setDraft(item); setStep(0); setErrors([]) }}>Open</Button><Button variant="ghost" size="sm" onClick={() => persist(items.map(row => row.id === item.id ? { ...row, status: row.status === 'archived' ? 'draft' : 'archived' } : row))}>{item.status === 'archived' ? 'Restore draft' : 'Archive'}</Button></div></li>)}</ul>
      {!!items.length && <Button variant="ghost" onClick={() => { if (window.confirm('Clear all prototype drafts in this tab?')) persist([]) }}>Reset prototype workspace</Button>}
    </> : <div className={styles.eventEditor}>
      <Button variant="ghost" size="sm" onClick={goHome}><ArrowLeft size={16} />Content Studio</Button>
      <ol className={styles.wizardSteps} aria-label="Content creation steps">{studioSteps(draft.kind).map((label, index) => <li key={label} aria-current={step === index ? 'step' : undefined} data-active={step === index}><span>{index + 1}</span>{label}</li>)}</ol>
      {step === 0 && <section className={`${styles.panel} ${styles.fields} ${styles.details}`} aria-label="Content details">
        {field('title', draft.kind === 'social' ? 'Internal post title' : 'Headline')}
        {draft.kind !== 'social' && text('summary', draft.kind === 'article' ? 'Homepage summary' : 'Supporting text')}
        {draft.kind === 'event' && <><div className={styles.pair}>{field('date', 'Event date', 'date')}<div><label htmlFor="studio-time">Event time</label><select id="studio-time" className={styles.select} value={draft.time} onChange={event => update({ time: event.target.value })}><option value="">Select time</option>{draft.time && !eventTimes.some(option => option.value === draft.time) && <option value={draft.time} disabled>{draft.time} — choose a new time</option>}{eventTimes.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div></div><LocationField value={draft.location} onChange={location => update({ location })} /></>}
        {draft.kind === 'deadline' && field('date', 'Deadline date', 'date')}
        {draft.kind === 'announcement' && field('expires', 'Expiration (optional)', 'date')}
        {draft.kind === 'article' && <>{field('category', 'Editorial label (optional)')}{text('body', 'Full story', 10)}{field('ctaLabel', 'Link text (optional)')}{field('ctaUrl', 'Destination URL', 'url')}</>}
        {banner && field('ctaLabel', 'Banner CTA (optional)')}
        {draft.kind === 'social' && <>{field('socialUrl', 'Original Instagram / TikTok post URL', 'url')}<label><input type="checkbox" checked={draft.permission} onChange={event => update({ permission: event.target.checked })} /> Permission confirmed</label><label><input type="checkbox" checked={draft.featured} onChange={event => update({ featured: event.target.checked })} /> Feature on homepage</label></>}
      </section>}
      {step === 1 && <div className={styles.workspace}>
        <section className={`${styles.panel} ${styles.fields}`} aria-label="Content design">
          {banner && <div className={styles.actions}>{(['template', 'upload'] as const).map(value => <Button key={value} variant={draft.artwork === value ? 'primary' : 'secondary'} aria-pressed={draft.artwork === value} onClick={() => update({ artwork: value })}>{value === 'template' ? 'Use Template' : 'Upload artwork'}</Button>)}</div>}
          {banner && draft.artwork === 'upload' ? <><div className={styles.upload}><span>{(draft.artworkImage ?? draft.image) ? 'Replace artwork' : 'Upload artwork'}</span><input aria-label="Upload artwork" id="studio-image" type="file" accept="image/jpeg,image/png,image/webp" onChange={upload} /></div>{(draft.artworkImage ?? draft.image) && <><div><label htmlFor="studio-artworkAlt">Image description</label><Input id="studio-artworkAlt" value={draft.artworkAlt ?? draft.imageAlt} onChange={event => update({ artworkAlt: event.target.value })} /></div><Button variant="ghost" onClick={() => update({ artworkImage: '', artworkAlt: '' })}>Remove artwork</Button></>}</> : <>
            {banner && <><label><input type="checkbox" checked={draft.includeLogo !== false} onChange={event => update({ includeLogo: event.target.checked })} /> Include Logo</label><div><label>Design</label><div className={styles.designPicker}>{eventThemes.map(theme => <button type="button" key={theme.id} aria-label={`Choose ${theme.label} design`} aria-pressed={eventTreatment(draft).id === theme.id} onClick={() => update({ designId: theme.id, posterLayout: undefined })}><div className={styles.designThumbnail} style={{ background: theme.background, color: theme.foreground }}><strong>{theme.label}</strong>{theme.layout === 'workshop' ? <NotebookPen /> : theme.layout === 'portrait' ? <Mic /> : <Guitar />}</div><span>{theme.label}</span></button>)}</div></div></>}
            {imageFields}
            {banner && imageLayoutControls}
          </>}
          {references}
        </section>
        <aside className={styles.preview} aria-label="Live preview"><h2>Preview</h2><ContentPreview draft={draft} mode={draft.kind === 'article' ? 'story' : 'digital'} /></aside>
      </div>}
      {step === 2 && <section className={styles.final} aria-label="Final preview"><h2>Final Preview</h2><div className={styles.printArtwork}><ContentPreview draft={draft} mode={draft.kind === 'article' ? 'story' : 'digital'} /></div><div className={styles.actions}>{placements(draft).map(place => <span className={styles.eyebrow} key={place}>{place}</span>)}</div></section>}
      {!!errors.length && <ul role="alert" className={styles.errors}>{errors.map(error => <li key={error}>{error}</li>)}</ul>}
      <footer className={styles.wizardFooter}><Button variant="secondary" onClick={() => { setErrors([]); if (step > 0) setStep(step - 1); else goHome() }}>Back</Button><div className={styles.footerForward}><Button variant="ghost" onClick={() => save('draft')}>Save draft</Button>{step === 2 ? <>{banner && <Button variant="secondary" onClick={() => window.print()}>Print</Button>}<Button onClick={() => save('published')}>Publish to Website</Button></> : <Button onClick={() => { const problems = studioStepErrors(draft, step); if (problems.length) setErrors(problems); else { setErrors([]); setStep(step + 1) } }}>Next</Button>}</div></footer>
    </div>}

  </main></div>
}

function ContentPreview({ draft, mode }: { draft: StudioDraft; mode: string }) {
  // Browser-local data URLs must stay local; do not send prototype uploads to an image optimizer.
  // eslint-disable-next-line @next/next/no-img-element
  const image = draft.image ? <img className={styles.artwork} src={draft.image} alt={draft.imageAlt || 'Uploaded artwork preview'} /> : <div className={styles.placeholder}>Your supplied image will appear here.</div>
  const cta: ReactNode = draft.ctaLabel && safeCta(draft.ctaUrl) ? <a href={draft.ctaUrl} target="_blank" rel="noreferrer" style={{ color: colors.crimson }}>{draft.ctaLabel} ↗</a> : null
  if (['event', 'deadline', 'announcement'].includes(draft.kind) && draft.artwork === 'upload') {
    const artwork = draft.artworkImage ?? draft.image
    // eslint-disable-next-line @next/next/no-img-element
    return artwork ? <img className={styles.artwork} src={artwork} alt={draft.artworkAlt ?? draft.imageAlt} /> : <div className={styles.placeholder}>Upload artwork</div>
  }
  if (draft.kind === 'social') {
    let post: ReturnType<typeof canonicalCommunityUrl> | null = null
    try { post = canonicalCommunityUrl(draft.socialUrl) } catch { /* Show a neutral preview until the URL is valid. */ }
    return <div className={styles.panel}><p className={styles.eyebrow}>{post?.platform || 'Social post'} · preview reference</p>{image}<h3>{draft.title || 'Curated community post'}</h3>{post ? <a href={post.url} target="_blank" rel="noreferrer" style={{ color: colors.crimson }}>Open original {post.platform} post ↗</a> : null}</div>
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