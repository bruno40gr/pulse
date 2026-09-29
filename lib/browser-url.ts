export function removeCurrentSearchParam(name: string): void {
  if (typeof window === 'undefined') return

  try {
    const url = new URL(window.location.href)
    url.searchParams.delete(name)
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    )
  } catch {
    // Closing UI state must not depend on browser history access.
  }
}