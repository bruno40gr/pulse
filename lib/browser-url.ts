export function removeCurrentSearchParam(name: string): void {
  const url = new URL(window.location.href)
  url.searchParams.delete(name)
  window.history.replaceState(
    window.history.state,
    '',
    `${url.pathname}${url.search}${url.hash}`,
  )
}