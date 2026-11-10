import { supabaseAdmin } from '@/lib/supabase/admin'
import { contentCommand, contentAssetId, academyInstant } from '@/lib/website-content'
import { contentAccess, contentJson, limitedBody } from '@/lib/website-content-server'

export async function GET(request: Request) {
  const access = await contentAccess(request)
  if (!access.ok) return contentJson({ error: access.error }, access.status)
  const { data, error } = await supabaseAdmin.rpc('website_content_workspace', { p_tenant: access.tenantId })
  if (error) return contentJson({ error: 'Content storage is unavailable. Verify the website-content migration has been applied.' }, 503)
  return contentJson(data)
}

export async function POST(request: Request) {
  const access = await contentAccess(request, true)
  if (!access.ok) return contentJson({ error: access.error }, access.status)
  let command: ReturnType<typeof contentCommand>
  try {
    command = contentCommand(JSON.parse((await limitedBody(request, 100000)).toString()), access.tenantId)
    if (command.action === 'publish' && command.item.kind === 'event') academyInstant(command.item.date, command.item.time)
  } catch (error) { return contentJson({ error: error instanceof Error ? error.message : 'Invalid content.' }, 400) }
  const ids = [command.item.image, command.item.artworkImage || '', ...(command.item.bodyImages || []).map(image => image.src)].map(value => contentAssetId(value, access.tenantId)).filter((id): id is string => !!id)
  if (ids.length) {
    const { data, error } = await supabaseAdmin.from('website_content_assets').select('id').eq('tenant_id', access.tenantId).in('id', ids)
    if (error || new Set(data?.map(asset => asset.id)).size !== new Set(ids).size) return contentJson({ error: 'An uploaded image is unavailable for this academy.' }, 400)
  }
  const { data, error } = await supabaseAdmin.rpc('website_content_command', {
    p_tenant: access.tenantId, p_actor: access.context.membershipId,
    p_revision: command.revision, p_action: command.action, p_item: command.item,
  })
  if (error) return contentJson({ error: error.code === '40001' ? 'Another admin changed the workspace. Reload before saving; your editor has not been cleared.' : 'Content could not be saved. No partial content change was committed.' }, error.code === '40001' ? 409 : 503)
  return contentJson(data)
}