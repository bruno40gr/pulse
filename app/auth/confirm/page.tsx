import { Button } from '@/components/ui/Button'
import { colors, radius, spacing, typography } from '@/lib/tokens'

type ConfirmationType = 'invite' | 'recovery'

function confirmationDestination(type: ConfirmationType, redirectTo: string) {
  if (type === 'invite') return '/claim'

  try {
    const pathname = new URL(redirectTo).pathname
    if (pathname === '/claim' || pathname === '/reset-password') return pathname
  } catch {
    if (redirectTo === '/claim' || redirectTo === '/reset-password') return redirectTo
  }

  return '/reset-password'
}

export default async function ConfirmAuthActionPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const tokenHash = typeof params.token_hash === 'string' ? params.token_hash : ''
  const type = params.type === 'invite' || params.type === 'recovery' ? params.type : null
  const redirectTo = typeof params.redirect_to === 'string' ? params.redirect_to : ''
  const valid = Boolean(tokenHash && type)
  const destination = type ? confirmationDestination(type, redirectTo) : '/reset-password'
  const isClaim = destination === '/claim'

  return (
    <main style={pageStyle}>
      <section style={cardStyle}>
        <h1 style={{ ...typography.h1, margin: 0, color: colors.text }}>
          {isClaim ? 'Create your password and access the Headliner App.' : 'Continue to reset your password'}
        </h1>
        {(!valid || !isClaim) && (
          <p style={{ ...typography.body, color: colors.textSecondary, margin: `${spacing.sm} 0 ${spacing.xl}` }}>
            {valid
              ? 'Press the button below to continue resetting your password.'
              : 'This email link is incomplete or invalid. Request a new email and try again.'}
          </p>
        )}

        {valid ? (
          <form action="/api/account/confirm" method="post" style={isClaim ? { marginTop: spacing.xl } : undefined}>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type || ''} />
            <input type="hidden" name="next" value={destination} />
            <Button variant="primary" size="sm" type="submit" style={{ width: '100%' }}>
              {isClaim ? 'Continue' : 'Continue to reset password'}
            </Button>
          </form>
        ) : (
          <a href={isClaim ? '/login' : '/forgot-password'} style={linkStyle}>
            {isClaim ? 'Return to sign in' : 'Request another reset email'}
          </a>
        )}
      </section>
    </main>
  )
}

const pageStyle: React.CSSProperties = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.background, padding: spacing.lg }
const cardStyle: React.CSSProperties = { width: 'min(100%, 460px)', background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: radius['2xl'], padding: spacing['4xl'], boxShadow: '0 18px 50px rgba(20, 30, 34, 0.08)' }
const submitStyle: React.CSSProperties = { width: '100%', padding: spacing.md, border: 'none', borderRadius: radius.lg, background: colors.action, color: colors.surface, fontFamily: typography.fontSans, fontSize: typography.sizeMd, fontWeight: typography.weightSemibold, cursor: 'pointer' }
const linkStyle: React.CSSProperties = { color: colors.crimson, fontFamily: typography.fontSans, fontSize: typography.sizeSm }