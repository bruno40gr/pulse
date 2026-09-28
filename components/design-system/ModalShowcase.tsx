'use client'

import { useEffect, useState } from 'react'
import { Badge, Button, Input, LoadingButton, Modal, ModalBody, ModalFooter, ModalHeader, ModalStepper, Notice, Textarea, type ModalSize } from '@/components/ui'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type Example = 'size' | 'actions' | 'feedback' | 'destructive' | 'stepper' | 'long' | null

const sizeDescriptions: Record<ModalSize, string> = {
  sm: 'Short confirmations, reminders, and simple decisions.',
  md: 'Standard forms and focused selection tasks.',
  lg: 'Import flows, multi-field forms, and richer content.',
  wide: 'Branded welcomes and intentional two-column experiences.',
}

export function ModalShowcase() {
  const [example, setExample] = useState<Example>(null)
  const [size, setSize] = useState<ModalSize>('md')
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState(0)

  useEffect(() => {
    if (!loading) return
    const timeout = window.setTimeout(() => setLoading(false), 1800)
    return () => window.clearTimeout(timeout)
  }, [loading])

  const close = () => {
    setExample(null)
    setLoading(false)
    setStep(0)
  }

  const openSize = (nextSize: ModalSize) => {
    setSize(nextSize)
    setExample('size')
  }

  return (
    <section style={{ marginBottom: '48px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: spacing.lg, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: typography.sizeXs, fontWeight: typography.weightSemibold, color: colors.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Modal system</div>
          <h2 style={{ ...typography.sectionTitle, color: colors.text, margin: `${spacing.xs} 0 0` }}>Interactive modal lab</h2>
          <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: `${spacing.sm} 0 0`, maxWidth: 680 }}>
            These examples define the approved shell, hierarchy, action placement, feedback, loading, and multi-step behavior before production modals are migrated.
          </p>
        </div>
        <Badge variant="info">Internal</Badge>
      </div>

      <div style={showcaseGridStyle}>
        <ShowcaseCard title="Named sizes" description="Use semantic sizes instead of one-off widths.">
          <div style={buttonRowStyle}>
            {(['sm', 'md', 'lg', 'wide'] as ModalSize[]).map(option => <Button key={option} variant="secondary" size="sm" onClick={() => openSize(option)}>{option.toUpperCase()}</Button>)}
          </div>
        </ShowcaseCard>

        <ShowcaseCard title="Action combinations" description="Primary, secondary, tertiary, destructive, and loading states.">
          <Button size="sm" onClick={() => setExample('actions')}>Open actions</Button>
        </ShowcaseCard>

        <ShowcaseCard title="Feedback hierarchy" description="Inline information, warnings, errors, and success states.">
          <Button size="sm" onClick={() => setExample('feedback')}>Open feedback</Button>
        </ShowcaseCard>

        <ShowcaseCard title="Destructive confirmation" description="Explicit consequence copy with a cancel-first action pair.">
          <Button size="sm" variant="destructive" onClick={() => setExample('destructive')}>Open confirmation</Button>
        </ShowcaseCard>

        <ShowcaseCard title="Stepper workflow" description="Feature code owns the step; the modal renders consistent progress and actions.">
          <Button size="sm" onClick={() => setExample('stepper')}>Open stepper</Button>
        </ShowcaseCard>

        <ShowcaseCard title="Long content" description="The body scrolls while the header and actions remain available.">
          <Button size="sm" onClick={() => setExample('long')}>Open long modal</Button>
        </ShowcaseCard>
      </div>

      <Modal isOpen={example === 'size'} onClose={close} size={size} ariaLabel={`${size} modal example`}>
        <ModalHeader title={`${size.toUpperCase()} modal`} description={sizeDescriptions[size]} onClose={close} />
        <ModalBody>
          <Notice variant="info" title="When to use this size">Choose the smallest named size that lets the content remain clear without compressing fields or actions.</Notice>
        </ModalBody>
        <ModalFooter><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={close}>Continue</Button></ModalFooter>
      </Modal>

      <Modal isOpen={example === 'actions'} onClose={close} size="md" ariaLabel="Modal action examples">
        <ModalHeader title="Action combinations" description="Keep the primary decision on the right and low-emphasis actions on the left." onClose={close} />
        <ModalBody style={{ display: 'grid', gap: spacing.xl }}>
          <ActionExample label="Primary and secondary"><Button variant="secondary">Cancel</Button><Button>Save changes</Button></ActionExample>
          <ActionExample label="Tertiary, secondary, and primary"><Button variant="ghost">Save draft</Button><Button variant="secondary">Cancel</Button><Button>Continue</Button></ActionExample>
          <ActionExample label="Stable loading label"><LoadingButton loading={loading} loadingLabel="Saving changes" onClick={() => setLoading(true)}>Save changes</LoadingButton></ActionExample>
        </ModalBody>
        <ModalFooter><Button variant="secondary" onClick={close}>Close example</Button></ModalFooter>
      </Modal>

      <Modal isOpen={example === 'feedback'} onClose={close} size="md" ariaLabel="Modal feedback examples">
        <ModalHeader title="Feedback hierarchy" description="Keep blocking feedback in context; reserve toasts for non-blocking confirmation after an action." onClose={close} />
        <ModalBody style={{ display: 'grid', gap: spacing.md }}>
          <Notice variant="info" title="Information">This explains context without requiring action.</Notice>
          <Notice variant="warning" title="Needs attention">An email is required before this staff member can be invited.</Notice>
          <Input label="Email" value="not-an-email" readOnly error="Enter a valid email address." />
          <Notice variant="error" title="Could not save">The request failed. Your changes are still here so you can retry.</Notice>
          <Notice variant="success" title="Invitation sent">The secure setup email is on its way.</Notice>
        </ModalBody>
        <ModalFooter><Button variant="secondary" onClick={close}>Close</Button><Button>Retry</Button></ModalFooter>
      </Modal>

      <Modal isOpen={example === 'destructive'} onClose={close} size="sm" ariaLabel="Delete confirmation">
        <ModalHeader title="Delete selected leads?" description="This action permanently removes 12 leads and their associated activity history." onClose={close} />
        <ModalBody><Notice variant="warning" title="This cannot be undone">Export anything you need before deleting these records.</Notice></ModalBody>
        <ModalFooter><Button variant="secondary" onClick={close}>Cancel</Button><Button variant="destructive" onClick={close}>Delete 12 leads</Button></ModalFooter>
      </Modal>

      <Modal isOpen={example === 'stepper'} onClose={close} size="lg" ariaLabel="Stepper modal example" closeOnBackdrop={false}>
        <ModalHeader title="Add a staff account" description="A three-step workflow with validation and reversible navigation." onClose={close} />
        <ModalBody style={{ display: 'grid', gap: spacing['2xl'] }}>
          <ModalStepper steps={['Account', 'Permissions', 'Review']} currentStep={step} />
          {step === 0 && <div style={formGridStyle}><Input label="First name" defaultValue="Jordan" /><Input label="Last name" defaultValue="Lee" /><Input label="Email" type="email" placeholder="jordan@example.com" /></div>}
          {step === 1 && <div style={formGridStyle}><Notice variant="info" title="Role selection">Permissions remain feature-specific; the workflow shell only standardizes progress and navigation.</Notice><Input label="Role" defaultValue="Instructor" /></div>}
          {step === 2 && <div style={formGridStyle}><Notice variant="success" title="Ready to create">Jordan Lee will be added as an Instructor. No invitation will be sent until you explicitly invite them.</Notice></div>}
        </ModalBody>
        <ModalFooter leading={step > 0 ? <Button variant="ghost" onClick={() => setStep(current => current - 1)}>Back</Button> : undefined}>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          {step < 2 ? <Button onClick={() => setStep(current => current + 1)}>Continue</Button> : <LoadingButton loading={loading} loadingLabel="Creating account" onClick={() => setLoading(true)}>Create account</LoadingButton>}
        </ModalFooter>
      </Modal>

      <Modal isOpen={example === 'long'} onClose={close} size="md" ariaLabel="Scrollable modal example">
        <ModalHeader title="Review import fields" description="The header and footer remain fixed while only this body scrolls." onClose={close} />
        <ModalBody style={{ display: 'grid', gap: spacing.md }}>
          {Array.from({ length: 14 }, (_, index) => <Textarea key={index} label={`Imported field ${index + 1}`} defaultValue={`Spreadsheet column ${index + 1}`} style={{ minHeight: 54 }} />)}
        </ModalBody>
        <ModalFooter><Button variant="secondary" onClick={close}>Cancel</Button><Button onClick={close}>Confirm fields</Button></ModalFooter>
      </Modal>
    </section>
  )
}

function ShowcaseCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <div style={showcaseCardStyle}><h3 style={{ ...typography.h2, margin: 0, color: colors.text }}>{title}</h3><p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: `${spacing.xs} 0 ${spacing.lg}` }}>{description}</p>{children}</div>
}

function ActionExample({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ display: 'grid', gap: spacing.sm }}><span style={{ fontSize: typography.sizeSm, color: colors.textSecondary }}>{label}</span><div style={{ ...buttonRowStyle, justifyContent: 'flex-end' }}>{children}</div></div>
}

const showcaseGridStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: spacing.lg, marginTop: spacing.xl }
const showcaseCardStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'flex-start', minHeight: 150, padding: spacing.xl, border: `1px solid ${colors.border}`, borderRadius: radius.xl, background: colors.surface }
const buttonRowStyle: React.CSSProperties = { display: 'flex', gap: spacing.sm, alignItems: 'center', flexWrap: 'wrap' }
const formGridStyle: React.CSSProperties = { display: 'grid', gap: spacing.lg }