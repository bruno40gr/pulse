export type RequestLogContext = {
  requestId: string
  startedAt: number
}

export function createRequestLogContext() {
  return {
    requestId: Math.random().toString(36).slice(2, 10),
    startedAt: Date.now(),
  } satisfies RequestLogContext
}

export function getDurationMs(startedAt: number) {
  return Date.now() - startedAt
}

export async function withTimeout<T>(
  promise: PromiseLike<T> | T,
  timeoutMs: number,
  label: string,
) {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`${label} timed out after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    return await Promise.race([Promise.resolve(promise), timeoutPromise])
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle)
  }
}