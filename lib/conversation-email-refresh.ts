/** Poll saved history only after the API confirms stored mode. Never overlap loads. */
export function startStoredEmailRefresh(options: {
  load: (quiet: boolean) => Promise<boolean | undefined>
  visible: () => boolean
  schedule: (tick: () => void, interval: number) => () => void
}) {
  let stopped = false, running = false, loaded = false, stored = false
  const refresh = async () => {
    if (stopped || running || !options.visible() || (loaded && !stored)) return
    running = true
    try {
      const result = await options.load(loaded)
      if (typeof result === 'boolean') { stored = result; loaded = true }
    } finally { running = false }
  }
  // The caller displays load failures; retain the last confirmed mode on error.
  const tick = () => { void refresh().catch(() => {}) }
  const cancel = options.schedule(tick, 15000)
  tick()
  return () => { stopped = true; cancel() }
}