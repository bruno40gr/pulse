/**
 * Two gates, because reading and writing have different risk.
 *
 * The operational Bands workspace and its read-only roster are on by default so a
 * school can inspect real bands and tentative candidacies. Anything that creates
 * opportunities, groups, or links stays opt-in until explicitly enabled.
 *
 * The page is a client component, so the public name must also be honoured; an
 * explicit `false` on either name turns the surface off.
 */
function enabled(value: string | undefined): boolean {
  return value === 'true'
}

/** Read-only surfaces: Bands page, enrolled roster, tentative listing, nav link. */
export function bandWorkspaceEnabled(): boolean {
  return process.env.NEXT_PUBLIC_ENABLE_CONTACT_BAND_OPPORTUNITIES !== 'false'
    && process.env.ENABLE_CONTACT_BAND_OPPORTUNITIES !== 'false'
}

/** Writes: create opportunities, create/relate tentative bands. Opt-in only. */
export function bandWritesEnabled(): boolean {
  return enabled(process.env.NEXT_PUBLIC_ENABLE_CONTACT_BAND_OPPORTUNITIES)
    || enabled(process.env.ENABLE_CONTACT_BAND_OPPORTUNITIES)
}
