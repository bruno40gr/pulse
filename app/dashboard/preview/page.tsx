'use client'

import { Avatar, Badge, PageHeader } from '@/components/ui'
import { colors, typography, radius, spacing, shadows } from '@/lib/tokens'

const contact = {
  firstName: 'Maya',
  lastName: 'Chen',
  ageLabel: 'Age 12',
  status: 'Active',
  avatar: '/demo-avatars/child-girl-3.jpg',
  guardian: 'Elena Chen',
  guardianPhone: '(916) 555-1844',
  guardianEmail: 'elena.chen@example.com',
  lesson: 'Piano · Wed 4:00 PM',
  details: [
    ['Program', 'Intermediate piano'],
    ['Instructor', 'Rachel Kim'],
    ['Family route', 'Account holder first'],
    ['Last attended', 'Aug 12'],
  ],
  highlights: [
    {
      tone: 'attention',
      title: 'Attendance slipped after a strong streak',
      body: 'Maya missed 2 of the last 3 sessions. Family has still been responsive when staff reaches out.',
    },
    {
      tone: 'opportunity',
      title: 'Ready for a progress update',
      body: 'Recent teacher notes suggest this is a good week to send encouragement and recommend next-step repertoire.',
    },
  ],
  notes: [
    'Parent asked for more specific practice guidance before the next recital check-in.',
    'Student responds well when praise is paired with one clear next step.',
  ],
}

const toneStyles = {
  attention: { bg: '#FEF7E7', title: '#92400E', dot: '#92400E' },
  opportunity: { bg: '#F2F7FF', title: '#1D4ED8', dot: '#1D4ED8' },
}

function SectionCard({ children, style = {} }: { children: React.ReactNode, style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: colors.surface,
        borderRadius: radius['2xl'],
        padding: spacing.xl,
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function HighlightCards() {
  return (
    <div style={{ display: 'grid', gap: spacing.sm }}>
      {contact.highlights.map((item) => {
        const tone = toneStyles[item.tone as keyof typeof toneStyles]
        return (
          <div
            key={item.title}
            style={{
              background: tone.bg,
              borderRadius: radius.xl,
              padding: `${spacing.lg} ${spacing.xl}`,
              display: 'grid',
              gap: spacing.xs,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm }}>
              <div style={{ fontSize: typography.sizeSm, fontWeight: typography.weightBold, color: tone.title, lineHeight: 1.4 }}>
                {item.title}
              </div>
              <div style={{ width: 8, height: 8, borderRadius: radius.full, background: tone.dot, marginTop: 5, flexShrink: 0 }} />
            </div>
            <div style={{ ...typography.label, color: colors.textSecondary }}>{item.body}</div>
          </div>
        )
      })}
    </div>
  )
}

function InfoGrid() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: `${spacing.lg} ${spacing.xl}` }}>
      {contact.details.map(([label, value]) => (
        <div key={label}>
          <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.xs }}>{label}</div>
          <div style={{ ...typography.label, color: colors.text }}>{value}</div>
        </div>
      ))}
    </div>
  )
}

function NotesPanel({ surface = colors.surfaceMuted }: { surface?: string }) {
  return (
    <div style={{ display: 'grid', gap: spacing.sm }}>
      {contact.notes.map((note, index) => (
        <div key={index} style={{ background: surface, borderRadius: radius.xl, padding: spacing.lg }}>
          <div style={{ ...typography.label, color: colors.text }}>{note}</div>
        </div>
      ))}
    </div>
  )
}

function CardScaffold({
  label,
  description,
  shellStyle,
  heroStyle,
  sectionStyle,
  columnDivider,
  footerStyle,
}: {
  label: string
  description: string
  shellStyle?: React.CSSProperties
  heroStyle?: React.CSSProperties
  sectionStyle?: React.CSSProperties
  columnDivider?: string
  footerStyle?: React.CSSProperties
}) {
  return (
    <div style={{ display: 'grid', gap: spacing.md }}>
      <div>
        <div style={{ ...typography.label, color: colors.text, marginBottom: spacing.xs }}>{label}</div>
        <div style={{ ...typography.helper, color: colors.textSecondary }}>{description}</div>
      </div>

      <div
        style={{
          background: colors.background,
          borderRadius: '28px',
          overflow: 'hidden',
          minHeight: '780px',
          ...shellStyle,
        }}
      >
        <div style={{ padding: spacing['2xl'], ...heroStyle }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
            <Avatar firstName={contact.firstName} lastName={contact.lastName} size={56} src={contact.avatar} />
            <div>
              <div style={{ fontSize: typography.size2xl, fontWeight: typography.weightSemibold, color: colors.text, lineHeight: 1.1 }}>
                {contact.firstName} {contact.lastName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' }}>
                <Badge variant="success">{contact.status}</Badge>
                <Badge variant="minor">Minor</Badge>
                <span style={{ ...typography.label, color: colors.textMuted }}>{contact.ageLabel}</span>
              </div>
            </div>
          </div>
          <div style={{ ...typography.label, color: colors.textSecondary, marginTop: spacing.lg }}>{contact.lesson}</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 'calc(100% - 168px)' }}>
          <div style={{ padding: spacing['2xl'], borderRight: columnDivider }}>
            <div style={{ display: 'grid', gap: spacing.lg }}>
              <SectionCard style={sectionStyle}>
                <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.sm }}>Account holder</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm }}>
                  <Avatar firstName="Elena" lastName="Chen" size={34} src="/demo-avatars/adult-woman-2.jpg" />
                  <div>
                    <div style={{ ...typography.label, color: colors.text }}>{contact.guardian}</div>
                    <div style={{ ...typography.helper, color: colors.textMuted }}>Primary family contact</div>
                  </div>
                </div>
                <div style={{ ...typography.helper, color: colors.textSecondary }}>{contact.guardianPhone}</div>
                <div style={{ ...typography.helper, color: colors.textSecondary }}>{contact.guardianEmail}</div>
              </SectionCard>

              <SectionCard style={sectionStyle}>
                <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.sm }}>AI Highlights</div>
                <HighlightCards />
              </SectionCard>

              <SectionCard style={sectionStyle}>
                <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.sm }}>Details</div>
                <InfoGrid />
              </SectionCard>
            </div>
          </div>

          <div style={{ padding: spacing['2xl'] }}>
            <div style={{ display: 'grid', gap: spacing.lg }}>
              <SectionCard style={sectionStyle}>
                <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.sm }}>Notes</div>
                <NotesPanel />
              </SectionCard>

              <SectionCard style={sectionStyle}>
                <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.sm }}>Internal comms</div>
                <NotesPanel surface={colors.backgroundSecondary} />
              </SectionCard>
            </div>
          </div>
        </div>

        <div style={{ padding: spacing['2xl'], ...footerStyle }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.sm }}>
            <button
              style={{
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.textSecondary,
                borderRadius: radius.lg,
                padding: `${spacing.sm} ${spacing.xl}`,
                fontSize: typography.sizeBase,
                fontFamily: typography.fontSans,
              }}
            >
              Edit contact
            </button>
            <button
              style={{
                border: 'none',
                background: colors.crimson,
                color: colors.surface,
                borderRadius: radius.lg,
                padding: `${spacing.sm} ${spacing.xl}`,
                fontSize: typography.sizeBase,
                fontFamily: typography.fontSans,
              }}
            >
              Send message
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function PreviewPage() {
  return (
    <div style={{ padding: spacing['3xl'], background: colors.background, minHeight: '100%' }}>
      <PageHeader
        title="Contact card depth studies"
        subtitle="Same content, four hierarchy treatments. No font size changes, only surface, spacing, contrast, and structure."
      />

      <div style={{ display: 'grid', gap: spacing['3xl'] }}>
        <CardScaffold
          label="Option A — Editorial panels"
          description="Soft containers and refined grouping. Safer, calmer, more premium without feeling overdesigned."
          shellStyle={{ border: `1px solid ${colors.border}`, boxShadow: shadows.md }}
          heroStyle={{ background: 'linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)', borderBottom: `1px solid ${colors.borderLight}` }}
          sectionStyle={{ boxShadow: shadows.sm, border: `1px solid ${colors.borderLight}` }}
          columnDivider={`1px solid ${colors.borderLight}`}
          footerStyle={{ background: '#FCFCFD', borderTop: `1px solid ${colors.borderLight}` }}
        />

        <CardScaffold
          label="Option B — Premium workspace"
          description="A stronger hero band, deeper footer anchoring, and clearer left-right workspace separation."
          shellStyle={{ boxShadow: shadows.xl, border: `1px solid rgba(255,255,255,0.7)` }}
          heroStyle={{ background: 'linear-gradient(135deg, #FFF7F9 0%, #FFFFFF 68%)', borderBottom: `1px solid ${colors.border}` }}
          sectionStyle={{ boxShadow: '0 10px 24px rgba(17,24,39,0.06)' }}
          columnDivider={`1px solid ${colors.border}`}
          footerStyle={{ background: colors.surface, borderTop: `1px solid ${colors.border}`, boxShadow: '0 -12px 24px rgba(17,24,39,0.05)' }}
        />

        <CardScaffold
          label="Option C — Minimal layered"
          description="Least visual risk. Mostly depth through spacing rhythm and tonal grouping rather than overt elevation."
          shellStyle={{ border: `1px solid ${colors.borderLight}` }}
          heroStyle={{ background: colors.surfaceMuted }}
          sectionStyle={{ background: colors.surface }}
          columnDivider={`1px solid ${colors.backgroundSecondary}`}
          footerStyle={{ background: colors.surfaceMuted, borderTop: `1px solid ${colors.backgroundSecondary}` }}
        />

        <CardScaffold
          label="Option D — High-contrast hierarchy"
          description="Most immediate transformation. Stronger card-within-card structure and more obvious information tiers."
          shellStyle={{ background: '#F7F8FA', boxShadow: shadows.lg, border: `1px solid #E8ECF1` }}
          heroStyle={{ background: '#FFFFFF', borderBottom: `1px solid #E8ECF1`, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.02)' }}
          sectionStyle={{ background: '#FFFFFF', border: `1px solid #ECEFF3`, boxShadow: '0 8px 20px rgba(15,23,42,0.05)' }}
          columnDivider={`1px solid #E8ECF1`}
          footerStyle={{ background: '#FFFFFF', borderTop: `1px solid #E8ECF1` }}
        />
      </div>
    </div>
  )
}
