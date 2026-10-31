export const SIDEBAR_POLL_INTERVAL_MS = 60_000

/** One request at a time, no hidden-tab polling, and at most one queued action refresh. */
export function startVisiblePolling(
  load: (signal: AbortSignal) => Promise<void>,
  intervalMs = SIDEBAR_POLL_INTERVAL_MS,
) {
  let stopped = false
  let running = false
  let queued = false
  let lastStarted: number | null = null
  let timer: number | undefined
  let controller: AbortController | undefined

  const isVisible = () => document.visibilityState !== 'hidden'
  const clearTimer = () => {
    window.clearTimeout(timer)
    timer = undefined
  }
  const schedule = () => {
    clearTimer()
    if (!stopped && !running && isVisible()) {
      timer = window.setTimeout(() => { void run(false) }, intervalMs)
    }
  }
  const run = async (force: boolean) => {
    if (stopped) return
    if (!isVisible()) {
      if (force) queued = true
      clearTimer()
      return
    }
    if (running) {
      if (force) queued = true
      return
    }
    if (!force && lastStarted !== null && Date.now() - lastStarted < intervalMs) return
    clearTimer()
    queued = false
    running = true
    lastStarted = Date.now()
    const requestController = new AbortController()
    controller = requestController
    const timeout = window.setTimeout(() => requestController.abort(), 10_000)
    try {
      await load(requestController.signal)
    } catch {
      // Keep the previous badge value and retry on the next visible refresh.
    } finally {
      window.clearTimeout(timeout)
      running = false
      controller = undefined
      if (!stopped) {
        if (queued && isVisible()) void run(true)
        else schedule()
      }
    }
  }
  const resume = () => {
    if (!isVisible()) clearTimer()
    else {
      void run(queued)
      if (!running) schedule()
    }
  }
  document.addEventListener('visibilitychange', resume)
  window.addEventListener('focus', resume)
  void run(false)
  return {
    refresh: () => { void run(true) },
    stop: () => {
      stopped = true
      clearTimer()
      controller?.abort()
      document.removeEventListener('visibilitychange', resume)
      window.removeEventListener('focus', resume)
    },
  }
}