import { createRequestLogContext, getDurationMs } from './request-runtime'

/** Per-request diagnostics only. Stage names must be static, never user data. */
export function createDetailRequestTiming() {
  const requestLog = createRequestLogContext()
  const timings: Record<string, number> = {}
  return {
    requestLog,
    timings,
    async measure<T>(name: string, work: () => PromiseLike<T>): Promise<T> {
      const startedAt = Date.now()
      try {
        return await work()
      } finally {
        timings[name] = getDurationMs(startedAt)
      }
    },
    responseHeaders() {
      return {
        'Cache-Control': 'private, no-store',
        'X-Request-Id': requestLog.requestId,
        'Server-Timing': [...Object.entries(timings), ['total', getDurationMs(requestLog.startedAt)]]
          .map(([name, duration]) => `${name};dur=${duration}`).join(', '),
      }
    },
  }
}