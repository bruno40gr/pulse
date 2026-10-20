'use client'

import { useState, type CSSProperties } from 'react'
import { BackControl } from '@/components/ui/BackControl'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { ControlButton } from '@/components/ui/ControlButton'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type Look = 'chevron' | 'link' | 'plain' | 'outlined'
type Placement = 'above' | 'beside' | 'current'
type Location = 'above' | 'beside' | 'right' | 'body' | 'footer'
type Example = {
  id: string; group: string; title: string; subtitle: string; destination: string
  current: string; location: Location; note: string; content: 'sms' | 'email' | 'profile' | 'recipients' | 'funding' | 'auth'
}

const examples: Example[] = [
  { id: 'lead-sms', group: 'Card → composer', title: 'Text message', subtitle: 'Kim Erickson · Lead card', destination: 'lead', current: 'Back to lead', location: 'beside', note: 'A deeper view in the same lead drawer. Back returns to the card; Close dismisses the drawer.', content: 'sms' },
  { id: 'contact-sms', group: 'Card → composer', title: 'Text message', subtitle: 'Kim Erickson · Contact card', destination: 'contact', current: 'Back to contact', location: 'beside', note: 'Same SMS composer and drawer width as the lead flow.', content: 'sms' },
  { id: 'card-email', group: 'Card → composer', title: 'Send email', subtitle: 'Kim Erickson · Contact / lead card', destination: 'contact', current: 'No Back control — Close only', location: 'above', note: 'Currently Close returns to the underlying card. This explores adding an explicit Back affordance; it does not change the live email flow.', content: 'email' },
  { id: 'lead-list', group: 'Detail → list', title: 'Kim Erickson', subtitle: 'Lead details', destination: 'leads', current: 'Leads', location: 'above', note: 'Currently shown only on mobile. This lab shows the proposed control at both widths.', content: 'profile' },
  { id: 'conversations', group: 'Workspace → directory', title: 'Kim Erickson', subtitle: 'Conversations · SMS / Email', destination: 'conversations', current: 'Go back to Conversations', location: 'right', note: 'Currently a link in the top-right action slot. Existing leave/draft confirmation behavior must be retained.', content: 'email' },
  { id: 'email-list', group: 'Reader → list', title: 'Lesson availability', subtitle: 'Email reader', destination: 'emails', current: 'Back to emails', location: 'body', note: 'Currently inside the reader content on narrower screens. Proposed Back belongs to the email pane, not the whole workspace.', content: 'email' },
  { id: 'student', group: 'Legacy contact composer', title: 'Text message', subtitle: 'Student details · Contacts / Dashboard', destination: 'student details', current: 'View student details', location: 'footer', note: 'The same footer pattern appears on the Contacts page and dashboard. One example represents both occurrences.', content: 'sms' },
  { id: 'staff', group: 'Staff composer', title: 'Message to Jordan', subtitle: 'Staff card', destination: 'staff card', current: 'Staff card', location: 'beside', note: 'Currently uses the drawer header. Bulk staff composing has no staff-card Back action.', content: 'sms' },
  { id: 'recipients', group: 'Compose → recipients', title: 'New message', subtitle: 'Two recipients selected', destination: 'recipients', current: 'Recipients', location: 'beside', note: 'Returns to recipient selection, rather than closing the messaging flow.', content: 'recipients' },
  { id: 'message-type', group: 'New-message modal', title: 'SMS recipients', subtitle: 'Choose who receives this message', destination: 'message type', current: 'Back', location: 'footer', note: 'Currently a ghost button in the modal footer. Proposed destination wording explains the previous step.', content: 'recipients' },
  { id: 'funding-list', group: 'Funding detail → list', title: 'Funding program', subtitle: 'Program details and funded students', destination: 'funding programs', current: 'All funding programs', location: 'above', note: 'Currently an outlined button with an arrow above the details.', content: 'funding' },
  { id: 'funding-search', group: 'Funding request modal', title: 'Request an organization', subtitle: 'Add funding program', destination: 'search', current: 'Back to search', location: 'body', note: 'Currently an outlined button below the request fields.', content: 'funding' },
  { id: 'bulk', group: 'Bulk Win-back composer', title: 'Message selected students', subtitle: '12 Win-back students selected', destination: 'leads', current: 'Back', location: 'above', note: 'Currently a mobile-only generic Back control. Destination wording here is a proposal for review.', content: 'sms' },
  { id: 'auth', group: 'Account recovery / claim', title: 'Reset your password', subtitle: 'Account recovery', destination: 'sign in', current: 'Return to sign in', location: 'footer', note: 'Represents both recovery and claim pages. Compare the shared header placement against the existing below-form convention.', content: 'auth' },
]

const panel: CSSProperties = { background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.lg, minWidth: 0 }
const row: CSSProperties = { display: 'flex', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }
const muted: CSSProperties = { ...typography.bodySmall, color: colors.textSecondary, lineHeight: 1.6 }

function DemoBack({ label, look, onClick }: { label: string; look: Look; onClick: () => void }) {
  if (look === 'chevron') return <BackControl label={label} onClick={onClick} />
  if (look === 'outlined') return <Button type="button" variant="secondary" size="sm" onClick={onClick} style={{ minHeight: 36 }}><ArrowLeft size={16} aria-hidden="true" />{label}</Button>
  return <ControlButton type="button" kind="link" onClick={onClick} style={{ minHeight: 36, textDecoration: look === 'plain' ? 'none' : 'underline', textAlign: 'left', justifyContent: 'flex-start' }}><ArrowLeft size={16} aria-hidden="true" />{label}</ControlButton>
}

function Content({ kind, mobile }: { kind: Example['content']; mobile: boolean }) {
  if (kind === 'sms') return <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) 130px', gap: spacing.md }}>
    <div><strong>Kim Erickson</strong><Textarea aria-label="Example SMS draft" placeholder="Write your message…" style={{ marginTop: spacing.md, minHeight: 90 }} /><div style={{ ...row, justifyContent: 'space-between', marginTop: spacing.sm }}><span style={muted}>Attach image</span><span style={muted}>Draft with AI</span></div></div>
    {!mobile && <div aria-label="Illustrative phone preview" style={{ border: `5px solid ${colors.espresso}`, borderRadius: 22, background: colors.backgroundSecondary, minHeight: 175, display: 'flex', alignItems: 'flex-end', padding: spacing.sm }}><span style={{ background: '#007AFF', color: 'white', borderRadius: 12, padding: spacing.sm, fontSize: typography.sizeSm }}>Your message preview</span></div>}
  </div>
  if (kind === 'email') return <div><div style={muted}>To: Kim Erickson</div><strong>Lesson availability</strong><Textarea aria-label="Example email draft" placeholder="Write your email…" style={{ marginTop: spacing.md, minHeight: 110 }} /></div>
  if (kind === 'recipients') return <div><Input aria-label="Example recipient search" placeholder="Search recipients…" /><div style={{ ...panel, padding: spacing.md, marginTop: spacing.md }}>Kim Erickson <span style={muted}>· Selected</span></div><p style={muted}>Recipients stay selected when you go back.</p></div>
  if (kind === 'profile') return <div><strong>Kim Erickson</strong><p style={muted}>Lesson inquiry · Piano<br />kim@example.com</p><div style={{ ...row, marginTop: spacing.xl }}><span style={muted}>Send SMS</span><span style={muted}>Send email</span></div></div>
  if (kind === 'auth') return <div><Input label="Email address" placeholder="you@example.com" /><p style={muted}>We’ll send instructions to recover your account.</p></div>
  return <div><Input label="Organization name" placeholder="Search or enter an organization…" /><p style={muted}>Program details, agreement information, and funded students appear here.</p></div>
}

function ExampleCard({ example, look, placement, mobile, resetKey }: { example: Example; look: Look; placement: Placement; mobile: boolean; resetKey: number }) {
  return <ExamplePreview key={resetKey} example={example} look={look} placement={placement} mobile={mobile} />
}

function ExamplePreview({ example, look, placement, mobile }: { example: Example; look: Look; placement: Placement; mobile: boolean }) {
  const [returned, setReturned] = useState(false)
  const [closed, setClosed] = useState(false)
  const location = placement === 'current' ? example.location : placement
  const back = <DemoBack label={`Back to ${example.destination}`} look={look} onClick={() => setReturned(true)} />
  return <article id={example.id} aria-label={`${example.group} example`} style={{ ...panel, overflow: 'hidden' }}>
    <div style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}`, background: colors.surfaceMuted }}>
      <h2 style={{ ...typography.h2, margin: 0 }}>{example.group}</h2>
      <p style={{ ...muted, margin: `${spacing.xs} 0 0` }}>Current: {example.current} · {example.location === 'beside' ? 'Beside title on desktop' : example.location}</p>
    </div>
    <div style={{ padding: mobile ? spacing.sm : spacing.lg, background: colors.backgroundSecondary }}>
      <div style={{ ...panel, maxWidth: mobile ? 360 : undefined, margin: '0 auto', overflow: 'hidden' }}>
        {returned || closed ? <div style={{ padding: spacing.xl, minHeight: 320 }}>
          <strong>{closed ? 'Drawer / view closed' : `Returned to ${example.destination}`}</strong>
          <p role="status" style={muted}>Simulation only. No records changed and no messages sent.</p>
          <Button type="button" variant="secondary" size="sm" onClick={() => { setReturned(false); setClosed(false) }}>Reopen example</Button>
        </div> : <>
          <header style={{ padding: spacing.lg, borderBottom: `1px solid ${colors.border}`, display: 'flex', flexDirection: 'column', gap: spacing.sm }}>
            {location === 'above' && <div style={{ ...row, justifyContent: 'space-between', flexWrap: 'nowrap' }}>{back}<ControlButton type="button" kind="close" aria-label="Close example" onClick={() => setClosed(true)} /></div>}
            <div style={{ display: 'flex', alignItems: 'center', gap: look === 'chevron' ? spacing.xs : spacing.md, minWidth: 0 }}>
              {location === 'beside' && back}
              <div style={{ flex: 1, minWidth: 0 }}><h3 style={{ ...typography.h2, margin: 0, overflowWrap: 'anywhere' }}>{example.title}</h3><div style={muted}>{example.subtitle}</div></div>
              {location === 'right' && back}
              {location !== 'above' && <ControlButton type="button" kind="close" aria-label="Close example" onClick={() => setClosed(true)} />}
            </div>
          </header>
          <div style={{ padding: spacing.lg, minHeight: 220 }}>{location === 'body' && <div style={{ marginBottom: spacing.lg }}>{back}</div>}<Content kind={example.content} mobile={mobile} /></div>
          <footer style={{ ...row, justifyContent: 'space-between', padding: spacing.lg, borderTop: `1px solid ${colors.border}` }}>
            {location === 'footer' ? back : <span style={muted}>Example only</span>}
            <Button type="button" size="sm" disabled>{example.content === 'sms' ? 'Send message' : example.content === 'email' ? 'Send email' : 'Continue'}</Button>
          </footer>
        </>}
      </div>
    </div>
    <p style={{ ...muted, margin: 0, padding: spacing.lg }}>{example.note}</p>
  </article>
}

export function BackNavigationShowcase() {
  const [look, setLook] = useState<Look>('chevron')
  const [placement, setPlacement] = useState<Placement>('beside')
  const [mobile, setMobile] = useState(false)
  const [resetKey, setResetKey] = useState(0)
  return <main style={{ padding: spacing['3xl'], fontFamily: typography.fontSans, color: colors.text, maxWidth: 1600, margin: '0 auto' }}>
    <h1 style={{ ...typography.h1, margin: 0 }}>Back navigation lab</h1>
    <p style={{ ...muted, maxWidth: 850 }}>All audited navigation use cases on one page. Change the look and placement below to compare a single pattern across drawers, pages, panes, modals, and account forms. These are illustrative previews—not the live composers. Nothing is sent or saved.</p>
    <section aria-label="Preview settings" style={{ ...panel, padding: spacing.lg, margin: `${spacing.xl} 0`, display: 'flex', gap: spacing.xl, flexWrap: 'wrap' }}>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ ...muted, marginBottom: spacing.sm }}>Component look</legend><div style={row}>{([{ id: 'chevron', label: 'Chevron only' }, { id: 'plain', label: 'Plain + arrow' }, { id: 'link', label: 'Underlined link' }, { id: 'outlined', label: 'Outlined button' }] as const).map(option => <Button key={option.id} type="button" size="sm" variant={look === option.id ? 'primary' : 'secondary'} aria-pressed={look === option.id} onClick={() => setLook(option.id)}>{option.label}</Button>)}</div></fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ ...muted, marginBottom: spacing.sm }}>Placement</legend><div style={row}>{([{ id: 'above', label: 'Above title' }, { id: 'beside', label: 'Beside title' }, { id: 'current', label: 'Current locations' }] as const).map(option => <Button key={option.id} type="button" size="sm" variant={placement === option.id ? 'primary' : 'secondary'} aria-pressed={placement === option.id} onClick={() => setPlacement(option.id)}>{option.label}</Button>)}</div></fieldset>
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}><legend style={{ ...muted, marginBottom: spacing.sm }}>Preview width</legend><div style={row}><Button type="button" size="sm" variant={!mobile ? 'primary' : 'secondary'} aria-pressed={!mobile} onClick={() => setMobile(false)}>Desktop</Button><Button type="button" size="sm" variant={mobile ? 'primary' : 'secondary'} aria-pressed={mobile} onClick={() => setMobile(true)}>Mobile</Button><Button type="button" size="sm" variant="ghost" onClick={() => setResetKey(key => key + 1)}>Reset examples</Button></div></fieldset>
    </section>
    <p style={muted}><strong>Starting proposal:</strong> chevron-left beside the title, with “Back to…” on hover or keyboard focus. A 44px hit area surrounds the 22px icon without adding a navigation row. “Current locations” compares placement only; the chosen look and normalized labels still apply. Prototype-only duplicates and design-system wizard samples are represented by their matching live use cases.</p>
    <nav aria-label="Jump to example" style={{ ...row, marginBottom: spacing.xl }}>{examples.map((example, index) => <a key={example.id} href={`#${example.id}`} style={{ color: colors.link, fontSize: typography.sizeSm, padding: spacing.xs }}>{index + 1}. {example.group}</a>)}</nav>
    <div className="back-navigation-examples">{examples.map(example => <ExampleCard key={example.id} example={example} look={look} placement={placement} mobile={mobile} resetKey={resetKey} />)}</div>
    <style>{`.back-navigation-examples{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:24px}.back-navigation-examples article{scroll-margin-top:24px}@media(max-width:1100px){.back-navigation-examples{grid-template-columns:minmax(0,1fr)}}@media(max-width:600px){main:has(.back-navigation-examples){padding:16px!important}}`}</style>
  </main>
}