/** Deployment opt-in is not proof of scheduling readiness. Keep off until the
 * real school's assignments/configuration are reconciled and release-approved.
 * The public flag controls the client; an explicit server false always denies.
 */
export function staffWorkProfileEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_STAFF_WORK_PROFILE === 'true'
    && process.env.ENABLE_STAFF_WORK_PROFILE !== 'false'
}