import { DEFAULT_TENANT } from '@/lib/tenant'

// Website teacher photos and owner-provided staff photos, matched to the Pulse roster.
const PHOTOS = [
  { names: ['Alyssa Abbott', 'Alyssa'], file: 'v1781563497/alyssa_dtv0xb.jpg' },
  { names: ['Jessica Suase', 'Jessica'], file: 'v1781563497/jessica_xdzc2o.jpg' },
  { names: ['Drew Johnson', 'Andrew Johnson', 'Drew'], file: 'v1781563497/drew_mgkx8d.jpg' },
  { names: ['Scott Gaona', 'Scott'], file: 'v1781563499/scott_ynydho.jpg' },
  { names: ['Marshall James-Solano', 'Marshall'], file: 'v1781563500/marshall_qjlobv.jpg' },
  { names: ['Collin Franks', 'Collin'], file: 'v1781563497/collin_ilzutz.jpg' },
  { names: ['Josh Brent', 'Josh'], file: 'v1781563903/josh_b8y6ii.jpg' },
  { names: ['Noah Campos', 'Noah'], file: 'v1789667700/fc93fb02-fedd-454d-a38b-b6e54afd5fec.png' },
  { names: ['Jacob Rogelstad', 'Jake Rogelstad', 'Jake'], file: 'v1781563498/jake_agjuva.jpg' },
  { names: ['Vitto Trinchese', 'Vittorio Trinchese', 'Vitto'], file: 'v1781563498/vitto_smf9f9.jpg' },
  { names: ['Isaias Pallib', 'Zais Pallib'], file: 'v1791300259/02e7a8a4-d3d1-4156-b1eb-8b6bdd6e2fe2.png' },
  { names: ['Lorena Rudha', 'Lorena'], file: 'v1788312254/9fd46acb-1557-437d-8776-5c969e96687f.png' },
  { names: ['Bruno Wong', 'Bruno'], file: 'v1791589510/17012fbf-9cac-457a-ac51-f3d3c926378f.png' },
  { names: ['Cohen Roden', 'Cohen'], file: 'v1787758377/e1553540-685b-41fe-943b-c22c213e95d5.png' },
]

function nameKey(name: string) {
  const parts = name.trim().toLowerCase().replace(/\./g, '').split(/\s+/)
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1]}` : parts[0]
}

/** Use only for staff identities and note authors, never arbitrary student names. */
export function getStaffAvatarUrl(tenantId: string, name: string | null | undefined): string | undefined {
  if (tenantId !== DEFAULT_TENANT || !name?.trim()) return undefined
  const key = nameKey(name)
  // Fixture portraits are illustrative only, not the fictional users' identities.
  if (process.env.NEXT_PUBLIC_SUPABASE_URL === 'https://xpnygavujqmzkdmcktdm.supabase.co') {
    const fixtures: Record<string, string> = { 'stagingowner tester': 'owner', 'stagingadmin tester': 'admin', 'stagingstaff tester': 'staff', 'stagingassistant tester': 'assistant', 'staging tester': 'tester', 'staging t': 'tester', 'jamie bennett': 'tester', 'jamie b': 'tester', 'morgan reyes': 'owner', 'morgan r': 'owner', 'avery chen': 'admin', 'avery c': 'admin', 'jordan patel': 'staff', 'jordan p': 'staff', 'riley brooks': 'assistant', 'riley b': 'assistant' }
    const fixture = fixtures[key]
    const portraits: Record<string, string> = {
      owner: PHOTOS[6].file,
      admin: PHOTOS[1].file,
      staff: PHOTOS[2].file,
      assistant: PHOTOS[0].file,
      tester: PHOTOS[3].file,
    }
    if (fixture) return `https://res.cloudinary.com/diy08lj9x/image/upload/${portraits[fixture]}`
  }
  const match = PHOTOS.find(photo => photo.names.some(alias => {
    const aliasKey = nameKey(alias)
    const parts = aliasKey.split(' ')
    return key === aliasKey || (parts.length === 2 && key === `${parts[0]} ${parts[1][0]}`)
  }))
  return match ? `https://res.cloudinary.com/diy08lj9x/image/upload/${match.file}` : undefined
}