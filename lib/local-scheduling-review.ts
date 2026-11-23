/** Explicit opt-in for fictional UI review, never API or tenant authentication. */
export function isLocalSchedulingReview(url: string, host: string | null) {
  const parsed = new URL(url)
  return process.env.NODE_ENV === 'development'
    && process.env.LOCAL_SCHEDULING_REVIEW === '1'
    && /^(127\.0\.0\.1|localhost)(:\d+)?$/.test(host || '')
    && ['/odeon-demo', '/odeon-demo/school-setup'].includes(parsed.pathname)
    && !parsed.searchParams.has('tenant')
}