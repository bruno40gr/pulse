import Link from 'next/link'
import { Badge } from '@/components/ui'
import { colors, typography, radius, spacing, shadows } from '@/lib/tokens'

const systemFlow = [
  {
    title: '1. Inputs',
    body: 'Spreadsheets, attendance, billing, notes, and whatever staff already had lying around.',
  },
  {
    title: '2. Reconciliation',
    body: 'Map fields, normalize the messy stuff, catch duplicates, and stop when the system is not confident.',
  },
  {
    title: '3. Core records',
    body: 'People, students, families, enrollments, campaigns, and messages. Clear enough to route and segment against.',
  },
  {
    title: '4. Outreach',
    body: 'Find the right audience, draft the message, review it, send it over SMS, and track what came back.',
  },
]

const entities = [
  'People',
  'Students',
  'Families',
  'Enrollments',
  'Campaigns',
  'Messages',
]

const aiBoundary = [
  {
    label: 'AI could',
    body: 'draft, summarize, and help narrow the audience',
    tone: '#EEF2FF',
    color: '#3730A3',
  },
  {
    label: 'Humans kept',
    body: 'approval, routing judgment, and any irreversible data decision',
    tone: '#FFF7ED',
    color: '#9A3412',
  },
]

function Arrow() {
  return (
    <div
      aria-hidden
      style={{
        display: 'grid',
        placeItems: 'center',
        color: colors.textMuted,
        fontSize: '22px',
        lineHeight: 1,
      }}
    >
      →
    </div>
  )
}

export default function HeyCohenPage() {
  return (
    <main style={{ minHeight: '100vh', background: colors.background, fontFamily: typography.fontSans }}>
      <div style={{ maxWidth: '1180px', margin: '0 auto', padding: '32px 24px 72px' }}>
        <div style={{ marginBottom: spacing['3xl'] }}>
          <Link href="/" style={{ color: colors.textMuted, textDecoration: 'none', fontSize: typography.sizeBase }}>
            ← Back
          </Link>
        </div>

        <div style={{ marginBottom: spacing['3xl'] }}>
          <div style={{ display: 'flex', gap: spacing.sm, flexWrap: 'wrap', marginBottom: spacing.lg }}>
            <Badge variant="opportunity">Hey Cohen</Badge>
            <Badge variant="milestone">One infographic</Badge>
            <Badge variant="nudge">Design engineering</Badge>
          </div>

          <h1 style={{ ...typography.h1, fontSize: '48px', color: colors.text, margin: `0 0 ${spacing.sm} 0`, maxWidth: '720px' }}>
            The whole product in one view.
          </h1>
          <p style={{ ...typography.body, color: colors.textSecondary, margin: 0, maxWidth: '760px' }}>
            Not a giant architecture diagram. Just the part that matters: how messy school data turned into staff-approved outreach.
          </p>
        </div>

        <section
          style={{
            background: 'linear-gradient(180deg, #FFF8FA 0%, #FFFFFF 100%)',
            border: '1px solid #F2D9E2',
            borderRadius: radius['2xl'],
            boxShadow: shadows.md,
            padding: spacing['3xl'],
            display: 'grid',
            gap: spacing['3xl'],
          }}
        >
          <div style={{ display: 'grid', gap: spacing.sm }}>
            <div style={{ ...typography.helper, color: colors.crimson, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Workflow map
            </div>
            <h2 style={{ ...typography.sectionTitle, color: colors.text, margin: 0 }}>
              From spreadsheets to a sent message
            </h2>
            <p style={{ ...typography.body, color: colors.textSecondary, margin: 0, maxWidth: '760px' }}>
              The hard part wasn’t the SMS. It was building a clean enough system underneath it that staff could trust the output.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: spacing.md, alignItems: 'stretch' }}>
            {systemFlow.map((step, index) => (
              <>
                <div
                  key={step.title}
                  style={{
                    background: colors.surface,
                    border: `1px solid ${colors.borderLight}`,
                    borderRadius: radius.xl,
                    padding: spacing.xl,
                    display: 'grid',
                    gap: spacing.sm,
                    minHeight: '180px',
                  }}
                >
                  <div style={{ ...typography.h2, color: colors.text, margin: 0 }}>{step.title}</div>
                  <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>{step.body}</p>
                </div>
                {index < systemFlow.length - 1 ? <Arrow key={`${step.title}-arrow`} /> : null}
              </>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: spacing['3xl'] }}>
            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.borderLight}`,
                borderRadius: radius.xl,
                padding: spacing.xl,
                display: 'grid',
                gap: spacing.lg,
              }}
            >
              <div>
                <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.xs }}>Core records</div>
                <div style={{ ...typography.h2, color: colors.text }}>Data model</div>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: spacing.sm }}>
                {entities.map((entity) => (
                  <div
                    key={entity}
                    style={{
                      padding: `${spacing.sm} ${spacing.lg}`,
                      borderRadius: radius.full,
                      background: '#FCFCFD',
                      border: `1px solid ${colors.borderLight}`,
                      color: colors.text,
                      ...typography.label,
                    }}
                  >
                    {entity}
                  </div>
                ))}
              </div>

              <p style={{ ...typography.bodySmall, color: colors.textSecondary, margin: 0 }}>
                These records existed so the product could answer practical questions: who gets the message, what context matters,
                and when a student should route through a parent instead.
              </p>
            </div>

            <div
              style={{
                background: colors.surface,
                border: `1px solid ${colors.borderLight}`,
                borderRadius: radius.xl,
                padding: spacing.xl,
                display: 'grid',
                gap: spacing.lg,
              }}
            >
              <div>
                <div style={{ ...typography.helper, color: colors.textMuted, marginBottom: spacing.xs }}>Boundary</div>
                <div style={{ ...typography.h2, color: colors.text }}>AI + human handoff</div>
              </div>

              <div style={{ display: 'grid', gap: spacing.md }}>
                {aiBoundary.map((item) => (
                  <div
                    key={item.label}
                    style={{
                      padding: spacing.lg,
                      borderRadius: radius.xl,
                      background: item.tone,
                      color: item.color,
                    }}
                  >
                    <div style={{ ...typography.label, marginBottom: spacing.xs }}>{item.label}</div>
                    <div style={{ ...typography.bodySmall }}>{item.body}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  )
}