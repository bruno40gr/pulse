import type { PulseActor } from '@/lib/access'
import { requireOwner, requireOwnerActor as requireOwnerActorContext, type RequestContextResult } from '@/lib/request-context'

export type OwnerAccessResult =
  | { ok: true; membershipId: string; personId: string; tenantId: string }
  | { ok: false; status: number; error: string }

function ownerAccessResult(result: RequestContextResult): OwnerAccessResult {
  if (!result.ok) return result
  return {
    ok: true,
    membershipId: result.context.membershipId,
    personId: result.context.personId,
    tenantId: result.context.tenantId,
  }
}

export async function requireOwnerAccess(request: Request, tenantId: string): Promise<OwnerAccessResult> {
  return ownerAccessResult(await requireOwner(request, tenantId))
}

export async function requireOwnerActor(actor: PulseActor | null, tenantId: string): Promise<OwnerAccessResult> {
  return ownerAccessResult(await requireOwnerActorContext(actor, tenantId))
}