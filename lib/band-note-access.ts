import type { MembershipRequestContext } from '@/lib/request-context'
import { PERMISSIONS } from '@/lib/permissions'
import { bandWorkspaceEnabled } from '@/lib/band-feature'
import { GET as getBands } from '@/app/api/bands/route'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { NoteTaskError } from '@/lib/note-task-access'

/** Band notes are internal, including when reached through general notes URLs. */
export function canAccessBandNotes(context: Pick<MembershipRequestContext, 'roleKey' | 'permissions'> | null | undefined, write = false): boolean {
  if (!bandWorkspaceEnabled() || !context || /^(family|student|parent|customer|guardian)$/.test(context.roleKey)) return false
  return context.roleKey === 'owner' || (context.permissions.has(PERMISSIONS.contactsRead)
    && context.permissions.has(write ? PERMISSIONS.notesManage : PERMISSIONS.notesRead))
}

/** Reuse the authoritative roster, including imported bands without a profile. */
export async function bandExistsForNotes(request: Request, name: string): Promise<boolean> {
  const response = await getBands(request)
  if (!response.ok) throw new Error('Could not verify the band.')
  const data = await response.json()
  return Array.isArray(data.bands) && data.bands.some((band: { name: string }) => band.name === name)
}

/** Do not send internal note previews to an ineligible mention/task recipient. */
export async function validateBandNoteRecipients(tenantId: string, ids: string[]): Promise<void> {
  for (const id of new Set(ids)) {
    const { data: member, error } = await supabaseAdmin.from('tenant_memberships').select('role_id,status')
      .eq('tenant_id', tenantId).eq('id', id).maybeSingle()
    if (error) throw error
    if (!member || !['unclaimed', 'invited', 'active'].includes(member.status)) throw new NoteTaskError('Choose staff with access to band notes.')
    const { data: role, error: roleError } = await supabaseAdmin.from('roles')
      .select('key,role_permissions(permissions(key))').eq('tenant_id', tenantId).eq('id', member.role_id).maybeSingle()
    if (roleError) throw roleError
    const permissions = new Set<string>((role?.role_permissions || []).flatMap((mapping: { permissions: unknown }) => {
      const values = Array.isArray(mapping.permissions) ? mapping.permissions : [mapping.permissions]
      return values.flatMap((value: { key?: string } | null) => value?.key ? [value.key] : [])
    }))
    if (!role || !canAccessBandNotes({ roleKey: role.key, permissions })) throw new NoteTaskError('Choose staff with access to band notes.')
  }
}