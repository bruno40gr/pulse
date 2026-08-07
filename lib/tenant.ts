const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const STORAGE_KEY = 'pulse_active_tenant'

export function getActiveTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID
  return localStorage.getItem(STORAGE_KEY) || DEFAULT_TENANT_ID
}

export function setActiveTenantId(id: string): void {
  localStorage.setItem(STORAGE_KEY, id)
}

export const DEFAULT_TENANT = DEFAULT_TENANT_ID

const DICEBEAR_TENANTS = [
  '00000000-0000-0000-0000-000000000002', // Sacramento Martial Arts
  '00000000-0000-0000-0000-000000000003', // Kumon Learning Center
]

export function shouldUseDiceBear(tenantId: string): boolean {
  return DICEBEAR_TENANTS.includes(tenantId)
}

export function getDiceBearUrl(firstName: string, lastName: string): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(firstName)}+${encodeURIComponent(lastName)}`
}
