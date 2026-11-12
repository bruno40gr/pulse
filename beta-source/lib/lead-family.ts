export type LeadFamilyMember = { name: string; age: string; instrument_interest: string }

export function normalizeFamilyMembers(value: unknown): LeadFamilyMember[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const member = entry as Record<string, unknown>
    const normalized = {
      name: typeof member.name === 'string' ? member.name.trim() : '',
      age: typeof member.age === 'string' || typeof member.age === 'number' ? String(member.age).trim() : '',
      instrument_interest: typeof member.instrument_interest === 'string' ? member.instrument_interest.trim() : '',
    }
    return Object.values(normalized).some(Boolean) ? [normalized] : []
  })
}

export function familyMembersChanged(current: unknown, saved: unknown): boolean {
  return JSON.stringify(normalizeFamilyMembers(current)) !== JSON.stringify(normalizeFamilyMembers(saved))
}