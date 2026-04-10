'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearUserCache } from '@/hooks/useUser'
import { clearSettlementsCache, revalidateSettlements } from '@/hooks/useSettlements'
import { revalidateRiders } from '@/hooks/useRiders'
import { revalidatePayments } from '@/hooks/useAdvancePayments'
import { toast } from 'sonner'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { getBrowserLoginUrl } from '@/lib/auth/login-redirect'

const REFETCH_AFTER_MS = 5 * 60 * 1000

const MSG_IDLE_LOGOUT =
  '\u0031\uC2DC\uAC04 \uB3D9\uC548 \uC774\uC6A9\uC774 \uC5C6\uC5B4 \uC790\uB3D9 \uB85C\uADF8\uC544\uC6C3\uB418\uC5C8\uC2B5\uB2C8\uB2E4.'
const MSG_IDLE_WARN =
  '\uACE7 \uC790\uB3D9 \uB85C\uADF8\uC544\uC6C3\uB429\uB2C8\uB2E4. (\uC57D 5\uBD84 \uC804 \uC548\uB0B4)'
const MSG_SESSION_EXPIRED =
  '\uC138\uC158\uC774 \uB9CC\uB8CC\uB418\uC5B4 \uC790\uB3D9 \uB85C\uADF8\uC544\uC6C3\uB418\uC5C8\uC2B5\uB2C8\uB2E4.'
const MSG_LOGIN_REQUIRED = '\uB85C\uADF8\uC778\uC774 \uD544\uC694\uD569\uB2C8\uB2E4.'

/**
 * Admin layout: idle1h auto sign-out to /login on current origin (e.g. jungsan-time.com/login).
 * Tab visible again: session check, optional refresh, cache revalidation after long background.
 */
export function InactivityGuard() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const redirectingRef = useRef(false)
  const hiddenAtRef = useRef<number>(0)

  const doLogout = useCallback(
    async (reason: string) => {
      if (redirectingRef.current) return
      redirectingRef.current = true
      clearUserCache()
      clearSettlementsCache()
      await supabase.auth.signOut().catch(() => {})
      toast.info(reason, { id: 'session-expired', duration: 4000 })
      const target = getBrowserLoginUrl()
      if (typeof window !== 'undefined') {
        window.location.replace(target)
      } else {
        router.replace('/login')
      }
    },
    [router, supabase],
  )

  useInactivityLogout(
    () => {
      void doLogout(MSG_IDLE_LOGOUT)
    },
    () => {
      toast.warning(MSG_IDLE_WARN, {
        id: 'inactivity-warn',
        duration: 10_000,
      })
    },
    true,
  )

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        void doLogout(MSG_LOGIN_REQUIRED)
      }
    })
  }, [supabase, doLogout])

  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      if (document.visibilityState !== 'visible') return
      if (redirectingRef.current) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        await doLogout(MSG_SESSION_EXPIRED)
        return
      }

      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
      if (expiresAt > 0 && expiresAt <= Date.now() + 60_000) {
        const { error } = await supabase.auth.refreshSession()
        if (error) {
          await doLogout(MSG_SESSION_EXPIRED)
          return
        }
      }

      const awayMs = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0
      if (awayMs >= REFETCH_AFTER_MS) {
        revalidateRiders().catch(() => {})
        revalidateSettlements().catch(() => {})
        revalidatePayments().catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [supabase, doLogout])

  return null
}
