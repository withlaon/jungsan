/**
 * Prevent hung requests from blocking module-level _promise caches indefinitely.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    })
  } finally {
    clearTimeout(t)
  }
}

export async function raceWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  label = 'timeout'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, rej) => {
      setTimeout(() => rej(new Error(label)), timeoutMs)
    }),
  ])
}
