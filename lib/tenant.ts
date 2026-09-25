const DEFAULT_TENANT_ID = '00000000-0000-0000-0000-000000000001'
const STORAGE_KEY = 'pulse_active_tenant'

export const TENANT_BRAND = {
  headliner: {
    id: DEFAULT_TENANT_ID,
    name: 'Headliner',
    logoUrl: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1780714085/logo_white_2x_ypk002.png',
  },
  sacramentoMartialArts: {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Cobra Kai',
    logoUrl: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787105903/cobra_kai_qboy9t.png',
  },
  kumon: {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Kumon',
    logoUrl: 'https://res.cloudinary.com/diy08lj9x/image/upload/v1787105629/Screenshot_2026-08-18_at_7.12.54_PM_vno77j.png',
  },
} as const

export function getActiveTenantId(): string {
  if (typeof window === 'undefined') return DEFAULT_TENANT_ID
  try {
    return window.localStorage.getItem(STORAGE_KEY) || DEFAULT_TENANT_ID
  } catch {
    return DEFAULT_TENANT_ID
  }
}

export function setActiveTenantId(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

export const DEFAULT_TENANT = DEFAULT_TENANT_ID

export function getTenantBrand(tenantId: string) {
  if (tenantId === TENANT_BRAND.sacramentoMartialArts.id) return TENANT_BRAND.sacramentoMartialArts
  if (tenantId === TENANT_BRAND.kumon.id) return TENANT_BRAND.kumon
  return TENANT_BRAND.headliner
}

const DICEBEAR_TENANTS = [
  '00000000-0000-0000-0000-000000000002', // Sacramento Martial Arts
  '00000000-0000-0000-0000-000000000003', // Kumon Learning Center
]

const DEMO_PHOTO_TENANTS = DICEBEAR_TENANTS

const DEMO_AVATAR_POOL = {
  women: [
    '/demo-avatars/adult-woman-1.jpg',
    '/demo-avatars/adult-woman-2.jpg',
    '/demo-avatars/adult-woman-3.jpg',
  ],
  men: [
    '/demo-avatars/adult-man-1.jpg',
    '/demo-avatars/adult-man-2.jpg',
    '/demo-avatars/adult-man-3.jpg',
  ],
  girls: [
    '/demo-avatars/child-girl-1.jpg',
    '/demo-avatars/child-girl-2.jpg',
    '/demo-avatars/child-girl-3.jpg',
  ],
  boys: [
    '/demo-avatars/child-boy-1.jpg',
    '/demo-avatars/child-boy-2.jpg',
    '/demo-avatars/child-boy-3.jpg',
  ],
} as const

const FEMININE_NAMES = new Set([
  'alina', 'ana', 'anna', 'aria', 'ava', 'elena', 'emma', 'felicia', 'grace',
  'hana', 'isabella', 'julia', 'lilly', 'lucy', 'maya', 'mei', 'nora', 'olivia', 'rachel',
  'sarah', 'sofia', 'zara', 'zoe', 'zoey',
])

const MASCULINE_NAMES = new Set([
  'adrian', 'daniel', 'david', 'ethan', 'james', 'jonah', 'josh', 'kai', 'liam',
  'marcus', 'mateo', 'noah', 'owen', 'river', 'ryan', 'sam', 'samuel', 'theo',
])

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z]/g, '')
}

function pickFromPool(pool: readonly string[], firstName: string, lastName: string): string {
  const first = firstName.trim().charCodeAt(0) || 0
  const last = lastName.trim().charCodeAt(0) || 0
  return pool[(first + last) % pool.length]
}

export function shouldUseDiceBear(tenantId: string): boolean {
  return DICEBEAR_TENANTS.includes(tenantId)
}

export function getDiceBearUrl(firstName: string, lastName: string): string {
  return `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(firstName)}+${encodeURIComponent(lastName)}`
}

export function shouldUseDemoPhotos(tenantId: string): boolean {
  return DEMO_PHOTO_TENANTS.includes(tenantId)
}

export function getDemoAvatarUrl(
  tenantId: string,
  firstName: string,
  lastName: string,
  options?: { isMinor?: boolean }
): string | undefined {
  if (!shouldUseDemoPhotos(tenantId)) return undefined

  const normalizedFirst = normalizeName(firstName)

  if (options?.isMinor) {
    if (FEMININE_NAMES.has(normalizedFirst)) return pickFromPool(DEMO_AVATAR_POOL.girls, firstName, lastName)
    if (MASCULINE_NAMES.has(normalizedFirst)) return pickFromPool(DEMO_AVATAR_POOL.boys, firstName, lastName)
    return pickFromPool([...DEMO_AVATAR_POOL.girls, ...DEMO_AVATAR_POOL.boys], firstName, lastName)
  }

  if (FEMININE_NAMES.has(normalizedFirst)) return pickFromPool(DEMO_AVATAR_POOL.women, firstName, lastName)
  if (MASCULINE_NAMES.has(normalizedFirst)) return pickFromPool(DEMO_AVATAR_POOL.men, firstName, lastName)
  return pickFromPool([...DEMO_AVATAR_POOL.women, ...DEMO_AVATAR_POOL.men], firstName, lastName)
}

export function getContactDemoAvatarUrl(
  tenantId: string,
  contact: {
    first_name: string
    last_name: string
    is_minor?: boolean | null
  }
): string | undefined {
  return getDemoAvatarUrl(tenantId, contact.first_name, contact.last_name, {
    isMinor: Boolean(contact.is_minor),
  })
}

export function getStaffDemoAvatarUrl(
  tenantId: string,
  staff: {
    first_name: string | null
    last_name: string | null
  }
): string | undefined {
  return getDemoAvatarUrl(tenantId, staff.first_name || '', staff.last_name || '', { isMinor: false })
}
