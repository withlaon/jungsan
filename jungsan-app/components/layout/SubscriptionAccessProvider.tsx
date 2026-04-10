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
import {
  merchantHasAppAccessFromBillingApiPayload,
  trialReminderDaysFromBillingApiPayload,
} from '@/lib/subscription/merchant-subscription-access'

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
  refetchSubscription: () => Promise<void>
}

const SubscriptionAccessContext = createContext<SubscriptionAccessContextValue | null>(null)

const DEFAULT_CTX: SubscriptionAccessContextValue = {
  subscriptionLocked: false,
  merchantGatePending: false,
  statusLoading: false,
  statusError: null,
  refetchSubscription: async () => {},
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

  const refetchSubscription = useCallback(async () => {
    if (!user || isAdmin) {
      setPayload(null)
      setStatusLoading(false)
      setStatusError(null)
      return
    }
    setStatusLoading(true)
    setStatusError(null)
    try {
      const res = await fetch('/api/billing/status', { credentials: 'include' })
      const data = (await res.json().catch(() => ({}))) as BillingStatusPayload & { error?: string }
      if (!res.ok) {
        setPayload(null)
        setStatusError(typeof data.error === 'string' ? data.error : ERR_FETCH)
        return
      }
      setPayload(data as BillingStatusPayload)
    } catch {
      setPayload(null)
      setStatusError(ERR_FETCH)
    } finally {
      setStatusLoading(false)
    }
  }, [user, isAdmin])

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
