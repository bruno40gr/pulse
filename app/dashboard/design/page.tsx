'use client'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Toast } from '@/components/ui/Toast'
import { EmptyState } from '@/components/ui/EmptyState'
import { SectionLabel } from '@/components/ui/SectionLabel'
import { Pill } from '@/components/ui/Pill'
import { FieldRow } from '@/components/ui/FieldRow'
import { colors, typography, radius, spacing } from '@/lib/tokens'

export default function DesignPage() {
  return (
    <div style={{ padding: '48px 32px', maxWidth: '900px', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
      <h1 style={{ fontSize: '28px', fontWeight: 700, color: colors.text, marginBottom: '8px' }}>Design System</h1>
      <p style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '48px' }}>Pulse component library — built on Headliner brand tokens.</p>

      {/* COLORS */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Color tokens</SectionLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px', marginTop: '16px' }}>
          {[
            { name: 'crimson', value: colors.crimson },
            { name: 'espresso', value: colors.espresso },
            { name: 'cream', value: colors.cream },
            { name: 'teal', value: colors.teal },
            { name: 'yellow', value: colors.yellow },
            { name: 'green', value: colors.green },
            { name: 'text', value: colors.text },
            { name: 'textSecondary', value: colors.textSecondary },
            { name: 'textMuted', value: colors.textMuted },
            { name: 'border', value: colors.border },
            { name: 'surface', value: colors.surface },
            { name: 'background', value: colors.background },
            { name: 'error', value: colors.error },
            { name: 'success', value: colors.success },
            { name: 'warning', value: '#F5A623' },
          ].map(({ name, value }) => (
            <div key={name}>
              <div style={{ width: '100%', height: '48px', background: value, borderRadius: radius.md, border: `1px solid ${colors.border}`, marginBottom: '6px' }} />
              <div style={{ fontSize: '11px', color: colors.text, fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: '10px', color: colors.textMuted, fontFamily: 'monospace' }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

      {/* TYPOGRAPHY */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Typography</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
          {[
            { label: 'size3xl / 28px', size: typography.size3xl, weight: typography.weightBold, text: 'Headliner Music Academy' },
            { label: 'size2xl / 22px', size: typography.size2xl, weight: typography.weightSemibold, text: 'Start a Campaign' },
            { label: 'sizeXl / 18px', size: typography.sizeXl, weight: typography.weightSemibold, text: 'Zara Hassan' },
            { label: 'sizeLg / 16px', size: typography.sizeLg, weight: typography.weightMedium, text: 'New Message' },
            { label: 'sizeMd / 14px', size: typography.sizeMd, weight: typography.weightNormal, text: 'Messaging for small businesses that know their customers personally.' },
            { label: 'sizeBase / 13px', size: typography.sizeBase, weight: typography.weightNormal, text: 'Parent or account holder · Last attended Aug 1' },
            { label: 'sizeSm / 12px', size: typography.sizeSm, weight: typography.weightNormal, text: 'Visible to your team only' },
            { label: 'sizeXs / 11px', size: typography.sizeXs, weight: typography.weightMedium, text: 'INTERNAL NOTES · SELECT MESSAGE RECIPIENT' },
          ].map(({ label, size, weight, text }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: '24px' }}>
              <span style={{ fontSize: '11px', color: colors.textMuted, width: '160px', flexShrink: 0, fontFamily: 'monospace' }}>{label}</span>
              <span style={{ fontSize: size, fontWeight: weight, color: colors.text, fontFamily: typography.fontSans }}>{text}</span>
            </div>
          ))}
        </div>
      </section>

      {/* BUTTONS */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Buttons</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary">Send message</Button>
            <Button variant="secondary">Import Contacts</Button>
            <Button variant="ghost">Cancel</Button>
            <Button variant="destructive">Delete</Button>
            <Button variant="teal">Connect Twilio</Button>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" size="sm">Small primary</Button>
            <Button variant="primary" size="md">Medium primary</Button>
            <Button variant="primary" size="lg">Large primary</Button>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="secondary" disabled>Disabled</Button>
          </div>
        </div>
      </section>

      {/* BADGES */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Badges</SectionLabel>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '16px' }}>
          <Badge variant="success">active</Badge>
          <Badge variant="warning">needs attention</Badge>
          <Badge variant="error">opted out</Badge>
          <Badge variant="info">band</Badge>
          <Badge variant="neutral">inactive</Badge>
          <Badge variant="minor">Minor</Badge>
        </div>
      </section>

      {/* AVATARS */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Avatars</SectionLabel>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '16px' }}>
          <Avatar firstName="Zara" lastName="Hassan" size={48} />
          <Avatar firstName="Marcus" lastName="Adeyemi" size={40} />
          <Avatar firstName="Bruno" lastName="Wong" size={36} />
          <Avatar firstName="Lilly" lastName="Adkins" size={28} />
          <Avatar firstName="Josh" lastName="Brent" size={24} />
        </div>
      </section>

      {/* INPUTS */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Inputs</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', maxWidth: '480px' }}>
          <Input label="Phone number" placeholder="+19165550212" hint="Include country code" />
          <Input label="Email" placeholder="parent@gmail.com" />
          <Input label="With error" placeholder="Enter value" error="This field is required" />
          <Textarea label="Internal notes" placeholder="Add a note about this contact..." hint="Visible to your team only" />
        </div>
      </section>

      {/* PILLS */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Pills</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', maxWidth: '400px' }}>
          <div>
            <p style={{ fontSize: typography.sizeSm, color: colors.textMuted, marginBottom: '8px' }}>Send to</p>
            <Pill
              options={[{ value: 'parent', label: 'Parent' }, { value: 'student', label: 'Student' }]}
              value="parent"
              onChange={() => {}}
            />
          </div>
          <div>
            <p style={{ fontSize: typography.sizeSm, color: colors.textMuted, marginBottom: '8px' }}>With disabled option</p>
            <Pill
              options={[{ value: 'parent', label: 'Parent' }, { value: 'student', label: 'Student' }]}
              value="parent"
              onChange={() => {}}
              disabled={['student']}
            />
          </div>
        </div>
      </section>

      {/* FIELD ROWS */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Field rows</SectionLabel>
        <div style={{ marginTop: '16px', maxWidth: '480px', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius.xl, padding: '20px 24px' }}>
          <FieldRow label="Phone" value="+19165550212" />
          <FieldRow label="Email" value="hassan.zara@gmail.com" />
          <FieldRow label="Last attended" value="Aug 1, 2026" />
          <FieldRow label="Subject" value="Math" />
          <FieldRow label="Level" value="F" />
          <FieldRow label="Instructor" value="Mr. Okonkwo" />
        </div>
      </section>

      {/* TOAST */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Toast</SectionLabel>
        <div style={{ marginTop: '16px' }}>
          <Toast message="changes saved" visible={true} />
        </div>
      </section>

      {/* EMPTY STATE */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Empty state</SectionLabel>
        <div style={{ marginTop: '16px', border: `1px solid ${colors.border}`, borderRadius: radius.xl, background: colors.surface }}>
          <EmptyState
            title="No contacts yet"
            description="Import a spreadsheet or add contacts manually to get started."
            action={<Button variant="primary">Import Contacts</Button>}
          />
        </div>
      </section>

      {/* SPACING */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Spacing tokens</SectionLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '16px' }}>
          {Object.entries(spacing).map(([name, value]) => (
            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span style={{ fontSize: '11px', color: colors.textMuted, width: '60px', fontFamily: 'monospace' }}>{name}</span>
              <div style={{ height: '8px', background: colors.teal, borderRadius: '2px', width: value }} />
              <span style={{ fontSize: '11px', color: colors.textMuted, fontFamily: 'monospace' }}>{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* BORDER RADIUS */}
      <section style={{ marginBottom: '48px' }}>
        <SectionLabel>Border radius</SectionLabel>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginTop: '16px' }}>
          {Object.entries(radius).map(([name, value]) => (
            <div key={name} style={{ textAlign: 'center' }}>
              <div style={{ width: '64px', height: '64px', background: colors.cream, border: `1px solid ${colors.border}`, borderRadius: value, marginBottom: '6px' }} />
              <div style={{ fontSize: '11px', color: colors.text, fontWeight: 600 }}>{name}</div>
              <div style={{ fontSize: '10px', color: colors.textMuted, fontFamily: 'monospace' }}>{value}</div>
            </div>
          ))}
        </div>
      </section>

    </div>
  )
}