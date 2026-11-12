import { createRequestLogContext, getDurationMs } from './request-runtime'
import { getRequestAccessTimings } from './request-context'

/** Per-request diagnostics only. Stage names must be static, never user data. */
export function createDetailRequestTiming(request?: Request) {
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
        if (name === 'access' && request) Object.assign(timings, getRequestAccessTimings(request))
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