'use client'

import { Avatar } from '@/components/ui/Avatar'
import { useIdentity } from './IdentityProvider'
import { typography } from '@/lib/tokens'

export default function SignedInUser({ compact = false }: { compact?: boolean }) {
  const { identity, error } = useIdentity()

  return (
    <div style={{ minWidth: 0, minHeight: 36, padding: compact ? 0 : '10px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
      {identity ? (
        <>
          <Avatar key={identity.fullName} firstName={identity.firstName} lastName="" size={compact ? 30 : 36} src={identity.avatarUrl || '/avatars/staff-default.svg'} />
          <span aria-label={identity.isDemo ? 'Demo session' : `Signed in as ${identity.firstName}`} style={{ color: '#fff', fontSize: typography.sizeSm, fontWeight: typography.weightSemibold, overflowWrap: 'anywhere' }}>
            {identity.firstName}
          </span>
        </>
      ) : error ? <span role="status" style={{ color: '#fff', fontSize: typography.sizeXs }}>Unable to verify signed-in user</span> : null}
    </div>
  )
}