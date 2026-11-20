import { authorizeTenantRequest } from '@/lib/tenant-request'
import { PERMISSIONS } from '@/lib/permissions'

/** The Host check is defense in depth, not proof of a local client. Bind the server to loopback. */
export async function authorizeLocalBandReview(request: Request) {
  const directory = process.env.LOCAL_BAND_REVIEW_DIR
  const configuredTenant = process.env.LOCAL_BAND_REVIEW_TENANT_ID
  if (process.env.NODE_ENV !== 'development' || !directory || !configuredTenant ||
    !/^(?:127\.0\.0\.1|localhost)(?::\d+)?$/.test(request.headers.get('host') || '')) {
    return { ok: false as const, status: 404, error: 'Not found.' }
  }
  const access = await authorizeTenantRequest(request, { permission: PERMISSIONS.contactsRead, allowDemo: false })
  if (!access.ok) return access
  if (access.tenantId !== configuredTenant || !access.context ||
    (access.context.roleKey !== 'owner' && !access.context.permissions.has(PERMISSIONS.leadsRead))) {
    return { ok: false as const, status: 403, error: 'Permission to review this account is required.' }
  }
  return { ok: true as const, directory, tenantId: access.tenantId }
}