/**
 * Client-side login URL: production host keeps user on https://jungsan-time.com/login etc.
 */
export function getBrowserLoginUrl(): string {
  if (typeof window === 'undefined') return '/login'
  return new URL('/login', window.location.origin).href
}
