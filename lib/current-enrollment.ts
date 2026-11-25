/** Either persisted status can mark an enrollment ended; absent status stays unknown. */
export function isCurrentEnrollment(enrollment: { status?: string | null; custom_fields?: Record<string, unknown> | null } | null | undefined): boolean {
  return ![enrollment?.status, enrollment?.custom_fields?.status].some(status =>
    typeof status === 'string' && status.trim().toLowerCase() === 'ended')
}
