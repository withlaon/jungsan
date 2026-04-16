'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useUser } from '@/hooks/useUser'
import { revalidateRiders } from '@/hooks/useRiders'
import { revalidateSettlements } from '@/hooks/useSettlements'
import { revalidatePayments } from '@/hooks/useAdvancePayments'
import {
  merchantHasAppAccessFromBillingApiPayload,
  trialReminderDaysFromBillingApiPayload,
} from '@/lib/subscription/merchant-subscription-access'

const BILLING_STATUS_FETCH_MS = 22_000

async function refreshMerchantDataCaches() {
  await Promise.all([
    revalidateRiders().catch(() => []),
    revalidateSettlements().catch(() => []),
    revalidatePayments().catch(() => []),
  ])
}

type BillingStatusPayload = {
  is_trial_active: boolean
  trial_remaining_days: number
  grace_access_active?: boolean
  status: string
  has_card: boolean
  failed_count?: number
}

type SubscriptionAccessContextValue = {
  subscriptionLocked: boolean
  merchantGatePending: boolean
  statusLoading: boolean
  statusError: string | null
  refetchSubscription: (opts?: { silent?: boolean }) => Promise<void>
}

const SubscriptionAccessContext = createContext<SubscriptionAccessContextValue | null>(null)

const DEFAULT_CTX: SubscriptionAccessContextValue = {
  subscriptionLocked: false,
  merchantGatePending: false,
  statusLoading: false,
  statusError: null,
  refetchSubscription: async () => {
    /* default no-op */
  },
}

export function useSubscriptionAccess(): SubscriptionAccessContextValue {
  return useContext(SubscriptionAccessContext) ?? DEFAULT_CTX
}

const ERR_FETCH =
  '\uAD6C\uB3C5 \uC0C1\uD0DC\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4.'

export function SubscriptionAccessProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAdmin, loading: userLoading } = useUser()

  const [statusLoading, setStatusLoading] = useState(true)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [payload, setPayload] = useState<BillingStatusPayload | null>(null)
  const trialDialogDismissedRef = useRef(false)
  const [trialDialogOpen, setTrialDialogOpen] = useState(false)
  const [trialDays, setTrialDays] = useState<number | null>(null)

  const refetchSubscription = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = Boolean(opts?.silent)
      if (!user || isAdmin) {
        setPayload(null)
        if (!silent) setStatusLoading(false)
        setStatusError(null)
        return
      }
      if (!silent) setStatusLoading(true)
      setStatusError(null)
      const ac = new AbortController()
      const abortTimer = setTimeout(() => ac.abort(), BILLING_STATUS_FETCH_MS)
      try {
        const res = await fetch('/api/billing/status', {
          credentials: 'include',
          signal: ac.signal,
        })
        const data = (await res.json().catch(() => ({}))) as BillingStatusPayload & { error?: string }
        if (!res.ok) {
          if (!silent) setPayload(null)
          setStatusError(typeof data.error === 'string' ? data.error : ERR_FETCH)
          return
        }
        setPayload(data as BillingStatusPayload)
        setStatusError(null)
      } catch {
        if (!silent) setPayload(null)
        setStatusError(ERR_FETCH)
      } finally {
        clearTimeout(abortTimer)
        if (!silent) setStatusLoading(false)
      }
    },
    [user, isAdmin]
  )

  useEffect(() => {
    if (userLoading) return
    if (!user || isAdmin) {
      setStatusLoading(false)
      setPayload(null)
      setStatusError(null)
      return
    }
    void refetchSubscription()
  }, [user, userLoading, isAdmin, refetchSubscription])

  /** Sidebar route change: force-refresh module caches (fixes blank UI after long idle). */
  useEffect(() => {
    if (!user || isAdmin || userLoading || !pathname) return
    let cancelled = false
    const id = window.setTimeout(() => {
      if (cancelled) return
      void refreshMerchantDataCaches()
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(id)
    }
  }, [pathname, user?.id, isAdmin, userLoading])

  /** Browser tab visible again: refresh billing + lists. */
  useEffect(() => {
    if (!user || isAdmin) return
    let debounce: ReturnType<typeof setTimeout> | undefined
    const onVis = () => {
      if (document.visibilityState !== 'visible') return
      if (debounce) clearTimeout(debounce)
      debounce = setTimeout(() => {
        void refetchSubscription({ silent: true })
        void refreshMerchantDataCaches()
      }, 250)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (debounce) clearTimeout(debounce)
    }
  }, [user, isAdmin, refetchSubscription])

  useEffect(() => {
    trialDialogDismissedRef.current = false
    setTrialDialogOpen(false)
    setTrialDays(null)
  }, [user?.id])

  const hasAccess = useMemo(() => {
    if (!user || isAdmin) return true
    if (!payload) return false
    return merchantHasAppAccessFromBillingApiPayload(payload)
  }, [user, isAdmin, payload])

  const subscriptionLocked = Boolean(user && !isAdmin && !statusLoading && !hasAccess)
  const merchantGatePending = Boolean(user && !isAdmin && statusLoading)

  useEffect(() => {
    if (!user || isAdmin || statusLoading) return
    if (hasAccess) return
    if (pathname === '/subscription') return
    // 구독(무료체험) 만료 후에도 라이더 관리 화면 접근 허용(목록·데이터 확인용)
    if (pathname === '/riders') return
    router.replace('/subscription')
  }, [user, isAdmin, statusLoading, hasAccess, pathname, router])

  useEffect(() => {
    if (!user || isAdmin || statusLoading || !payload || trialDialogDismissedRef.current) return
    if (!hasAccess) return
    const days = trialReminderDaysFromBillingApiPayload(payload)
    if (days == null) return
    setTrialDays(days)
    setTrialDialogOpen(true)
  }, [user, isAdmin, statusLoading, payload, hasAccess])

  const value = useMemo<SubscriptionAccessContextValue>(
    () => ({
      subscriptionLocked,
      merchantGatePending,
      statusLoading: Boolean(user && !isAdmin && statusLoading),
      statusError,
      refetchSubscription,
    }),
    [subscriptionLocked, merchantGatePending, user, isAdmin, statusLoading, statusError, refetchSubscription]
  )

  const trialTitle =
    '\uBB34\uB8CC \uCCB4\uD5D8 \uAE30\uAC04 \uC548\uB0B4'
  const trialBody = (d: number) =>
    `\uBB34\uB8CC \uCCB4\uD5D8 \uAE30\uAC04\uC774 ${d}\uC77C \uB0A8\uC558\uC2B5\uB2C8\uB2E4. \uAE30\uAC04 \uC885\uB8CC \uC804\uC5D0 \uAD6C\uB3C5\u00B7\uC790\uB3D9\uACB0\uC81C\uB97C \uB4F1\uB85D\uD574 \uC8FC\uC138\uC694.`

  return (
    <SubscriptionAccessContext.Provider value={value}>
      {children}
      <Dialog
        open={trialDialogOpen}
        onOpenChange={(open) => {
          if (!open) trialDialogDismissedRef.current = true
          setTrialDialogOpen(open)
        }}
      >
        <DialogContent className="bg-slate-900 border-slate-700 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">{trialTitle}</DialogTitle>
            <DialogDescription className="text-slate-300">
              {trialDays != null ? trialBody(trialDays) : ''}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => {
                trialDialogDismissedRef.current = true
                setTrialDialogOpen(false)
              }}
            >
              확인
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SubscriptionAccessContext.Provider>
  )
}
