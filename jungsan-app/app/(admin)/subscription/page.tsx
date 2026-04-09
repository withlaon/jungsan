'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CreditCard,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  RefreshCw,
  ShieldCheck,
  CalendarDays,
  Zap,
  BadgeCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import {
  loadBillingIssueConfig,
  requestIssueBillingKeyWithConfig,
  SUBSCRIPTION_AMOUNT,
  isValidKrMobileForBilling,
  type BillingIssueConfig,
} from '@/lib/portone/billing'
import {
  parseBillingIssueReturnFromSearchParams,
  stripBillingIssueQueryParams,
} from '@/lib/portone/billing-redirect'

interface SubscriptionStatus {
  status: 'trial' | 'active' | 'past_due' | 'cancelled'
  has_card: boolean
  is_trial_active: boolean
  trial_remaining_days: number
  trial_ends_at: string
  card_company?: string
  card_number_masked?: string
  next_billing_at?: string
  last_payment_at?: string
  current_period_start?: string
  current_period_end?: string
  failed_count?: number
  cancelled_at?: string
  access_until?: string
  grace_access_active?: boolean
}

interface PaymentHistory {
  id: string
  payment_id: string
  order_name: string
  amount: number
  status: string
  paid_at?: string
  is_test: boolean
  created_at: string
}

function formatDate(iso?: string | null): string {
  if (!iso) return '-'
  return new Date(iso).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function formatAmount(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원'
}

/** 해지 확인 다이얼로그용 — 남은 이용 종료일(대략) */
function previewSubscriptionAccessEndLabel(sub: SubscriptionStatus | null): string | null {
  if (!sub || sub.status === 'cancelled') return null
  const now = Date.now()
  if (sub.status === 'active' && sub.current_period_end) {
    const t = new Date(sub.current_period_end).getTime()
    if (t > now) return formatDate(sub.current_period_end)
  }
  if (sub.is_trial_active && sub.trial_ends_at) {
    return formatDate(sub.trial_ends_at)
  }
  if (sub.current_period_end) {
    const t = new Date(sub.current_period_end).getTime()
    if (t > now) return formatDate(sub.current_period_end)
  }
  return null
}

function isValidBillingEmail(value: string): boolean {
  const s = value.trim()
  if (s.length < 5) return false
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s)
}

/** 포트원/KCP [3192] 등 — 해외전용 채널에 국내 카드 시도 시 흔함 */
function billingRegisterErrorMessage(
  message?: string,
  code?: string,
  pgMessage?: string
): string {
  const blob = `${message ?? ''} ${code ?? ''} ${pgMessage ?? ''}`
  if (
    blob.includes('전문길이') ||
    blob.includes('잘못된_전문') ||
    blob.includes('잘못된 전문')
  ) {
    return (
      'PG 전문 길이 오류입니다. 카드 등록 요청은 storeId·channelKey·카드 수단만 보내도록 맞춰 두었습니다. ' +
      '그래도 동일하면 (1) PORTONE_BILLING_CHANNEL_KEY_DOMESTIC이 「KCP API 정기결제」등 빌링 전용 채널 키인지 ' +
      '(2) 콘솔에 배치(정기)결제 그룹아이디·KCP 파트너 자동결제 그룹이 일치하는지 ' +
      '(3) 일반 결제 채널 키를 쓰고 있지 않은지 확인해 주세요. ' +
      '도움말: https://help.portone.io/content/kcp_channel'
    )
  }
  if (
    blob.includes('UNAUTHORIZED') ||
    blob.includes('인증 실패') ||
    (message && /api\.portone\.io/i.test(message))
  ) {
    return (
      '포트원 서버 API 호출이 인증되지 않았습니다. Vercel/서버에 PORTONE_API_SECRET(V2)을 넣고 재배포하세요. ' +
      'REST 주소를 브라우저로 직접 여는 방법은 사용할 수 없습니다.'
    )
  }
  if (blob.includes('3192') || code === '3192') {
    return (
      '카드번호가 결제사에서 거절되었습니다. 프로필 휴대폰(숫자)·채널(수단=빌링·국내 정기)을 확인해 주세요. ' +
      '결제창이 「해외카드」 전용이면 국내 카드는 불가합니다. 그래도 동일하면 포트원/KCP로 문의해 주세요.'
    )
  }
  if (pgMessage && !message) return pgMessage
  return message ?? '카드 등록에 실패했습니다.'
}

const STATUS_CONFIG = {
  trial: {
    label: '무료 체험 중',
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10 border-blue-500/30',
    badgeClass: 'border-blue-500 text-blue-400',
    icon: Clock,
  },
  active: {
    label: '구독 중',
    color: 'text-green-400',
    bgColor: 'bg-green-500/10 border-green-500/30',
    badgeClass: 'border-green-500 text-green-400',
    icon: CheckCircle,
  },
  past_due: {
    label: '결제 실패',
    color: 'text-red-400',
    bgColor: 'bg-red-500/10 border-red-500/30',
    badgeClass: 'border-red-500 text-red-400',
    icon: AlertTriangle,
  },
  /** DB는 past_due이나 실패 이력 0·카드 있음 = 첫 청구 대기/스케줄 (크론·즉시결제 전) */
  past_due_pending: {
    label: '결제 예정',
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10 border-amber-500/30',
    badgeClass: 'border-amber-500 text-amber-400',
    icon: CalendarDays,
  },
  cancelled: {
    label: '해지됨',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10 border-slate-500/30',
    badgeClass: 'border-slate-500 text-slate-400',
    icon: XCircle,
  },
  cancelled_grace: {
    label: '이용 가능 (해지됨)',
    color: 'text-sky-400',
    bgColor: 'bg-sky-500/10 border-sky-500/30',
    badgeClass: 'border-sky-500 text-sky-400',
    icon: CalendarDays,
  },
}

function subscriptionCardUiConfig(sub: SubscriptionStatus | null) {
  if (!sub) return STATUS_CONFIG.trial
  if (sub.status === 'cancelled' && sub.grace_access_active) {
    return STATUS_CONFIG.cancelled_grace
  }
  if (
    sub.status === 'past_due' &&
    (sub.failed_count ?? 0) === 0 &&
    sub.has_card
  ) {
    return STATUS_CONFIG.past_due_pending
  }
  switch (sub.status) {
    case 'trial':
      return STATUS_CONFIG.trial
    case 'active':
      return STATUS_CONFIG.active
    case 'past_due':
      return STATUS_CONFIG.past_due
    case 'cancelled':
      return STATUS_CONFIG.cancelled
    default:
      return STATUS_CONFIG.trial
  }
}

export default function SubscriptionPage() {
  const [sub, setSub] = useState<SubscriptionStatus | null>(null)
  const [history, setHistory] = useState<PaymentHistory[]>([])
  const [statusError, setStatusError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [isRegistering, setIsRegistering] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [userId, setUserId] = useState<string>('')
  const [userName, setUserName] = useState<string>('')
  const [userEmail, setUserEmail] = useState<string>('')
  const [userPhone, setUserPhone] = useState<string>('')
  const billingRedirectHandledRef = useRef(false)

  const [registerCardOpen, setRegisterCardOpen] = useState(false)
  const [billingName, setBillingName] = useState('')
  const [billingPhone, setBillingPhone] = useState('')
  const [billingEmail, setBillingEmail] = useState('')
  const [billingFormErrors, setBillingFormErrors] = useState<{
    realName?: string
    phone?: string
    email?: string
  }>({})
  const [preparedBillingConfig, setPreparedBillingConfig] =
    useState<BillingIssueConfig | null>(null)
  const [billingConfigStatus, setBillingConfigStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle')
  const [billingConfigMessage, setBillingConfigMessage] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 20_000)
    try {
      const res = await fetch('/api/billing/status', { signal: controller.signal })
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (res.ok) {
        setSub(data as SubscriptionStatus)
        setStatusError(null)
      } else {
        const msg =
          typeof data.error === 'string'
            ? data.error
            : `구독 정보를 불러오지 못했습니다. (${res.status})`
        setStatusError(msg)
        setSub(null)
        console.error('[subscription] 상태 조회 실패:', data.error ?? res.status)
      }
    } catch (e) {
      const aborted =
        (e instanceof DOMException && e.name === 'AbortError') ||
        (e instanceof Error && e.name === 'AbortError')
      setStatusError(
        aborted
          ? '구독 정보 응답이 지연되고 있습니다. 네트워크를 확인한 뒤 다시 시도해 주세요.'
          : '네트워크 오류로 구독 상태를 확인할 수 없습니다.',
      )
      setSub(null)
      console.error('[subscription] 상태 조회 오류:', e)
    } finally {
      clearTimeout(timer)
    }
  }, [])

  const saveBillingKeyToServer = useCallback(
    async (payload: { billingKey?: string; billingIssueToken?: string }) => {
      const saveRes = await fetch('/api/billing/issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const saveData = (await saveRes.json().catch(() => ({}))) as { error?: string }
      if (!saveRes.ok) {
        toast.error(saveData.error ?? '카드 저장 중 오류가 발생했습니다.')
        return false
      }
      toast.success('카드가 등록되었습니다. 무료 체험 종료 후 자동 결제됩니다.')
      await fetchStatus()
      return true
    },
    [fetchStatus]
  )

  const fetchHistory = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data } = await supabase
        .from('payments')
        .select('id, payment_id, order_name, amount, status, paid_at, is_test, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setHistory(data as PaymentHistory[])
    } catch (e) {
      console.error('[subscription] 결제 내역 조회 오류:', e)
    }
  }, [])

  useEffect(() => {
    let alive = true
    const init = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user && alive) {
          setUserId(user.id)

          const { data: profile } = await supabase
            .from('profiles')
            .select('manager_name, phone, email')
            .eq('id', user.id)
            .maybeSingle()
          if (!alive) return
          setUserName(profile?.manager_name ?? '')
          setUserPhone(profile?.phone ?? '')
          /** KCP customer.email: 로그인 이메일 우선, 없으면 프로필 email */
          setUserEmail((user.email ?? profile?.email ?? '').trim())
        }
        // 결제 내역(Supabase)이 지연되어도 구독 화면은 먼저 표시
        if (alive) await fetchStatus()
      } finally {
        if (alive) setLoading(false)
      }
      if (alive) void fetchHistory()
    }
    void init()
    return () => {
      alive = false
    }
  }, [fetchStatus, fetchHistory])

  /** PG 리디렉션 복귀(모바일 KCP 등): URL 쿼리로 빌링키·오류 전달 */
  useEffect(() => {
    if (loading || !userId || billingRedirectHandledRef.current) return
    if (typeof window === 'undefined') return

    const url = new URL(window.location.href)
    const parsed = parseBillingIssueReturnFromSearchParams(url.searchParams)
    if (!parsed) return

    billingRedirectHandledRef.current = true

    const clearQuery = () => {
      const nextPath = stripBillingIssueQueryParams(url)
      window.history.replaceState({}, '', nextPath)
    }

    void (async () => {
      if (parsed.status === 'error') {
        toast.error(
          billingRegisterErrorMessage(parsed.message, parsed.code, parsed.pgMessage),
        )
        clearQuery()
        return
      }

      const body =
        parsed.billingKey === 'NEEDS_CONFIRMATION' && parsed.billingIssueToken
          ? { billingIssueToken: parsed.billingIssueToken }
          : { billingKey: parsed.billingKey }

      await saveBillingKeyToServer(body)
      clearQuery()
    })()
  }, [loading, userId, saveBillingKeyToServer])

  const loadBillingConfigForDialog = useCallback(async () => {
    setBillingConfigStatus('loading')
    setBillingConfigMessage(null)
    const r = await loadBillingIssueConfig()
    if (r.ok) {
      setPreparedBillingConfig(r.config)
      setBillingConfigStatus('ready')
    } else {
      setPreparedBillingConfig(null)
      setBillingConfigStatus('error')
      setBillingConfigMessage(r.error?.message ?? '설정을 불러오지 못했습니다.')
    }
  }, [])

  const openRegisterCardDialog = useCallback(() => {
    if (!userId) {
      toast.error('로그인 정보를 불러올 수 없습니다.')
      return
    }
    setBillingName(userName.trim())
    setBillingPhone(userPhone.trim())
    setBillingEmail(userEmail.trim())
    setBillingFormErrors({})
    setPreparedBillingConfig(null)
    setBillingConfigMessage(null)
    setBillingConfigStatus('loading')
    setRegisterCardOpen(true)
    void loadBillingConfigForDialog()
  }, [userId, userName, userPhone, userEmail, loadBillingConfigForDialog])

  const handleConfirmBillingRegister = async () => {
    if (!userId) {
      toast.error('로그인 정보를 불러올 수 없습니다.')
      return
    }

    const name = billingName.trim()
    const phone = billingPhone.trim()
    const email = billingEmail.trim()

    const nextErrors: typeof billingFormErrors = {}
    if (name.length < 2) {
      nextErrors.realName = '담당자 실명을 2자 이상 입력해 주세요. (카드 명의와 같으면 처리에 유리합니다)'
    }
    if (!isValidKrMobileForBilling(phone)) {
      nextErrors.phone =
        '휴대폰 번호를 확인해 주세요. 010 번호는 11자리(예: 01012345678)여야 합니다.'
    }
    if (!isValidBillingEmail(email)) {
      nextErrors.email = '유효한 이메일 주소를 입력해 주세요.'
    }
    if (Object.keys(nextErrors).length > 0) {
      setBillingFormErrors(nextErrors)
      return
    }
    setBillingFormErrors({})

    if (billingConfigStatus !== 'ready' || !preparedBillingConfig) {
      toast.error(
        billingConfigMessage ??
          '결제 연동 설정을 불러오는 중입니다. 잠시 후 다시 시도해 주세요.',
      )
      return
    }

    const cfg = preparedBillingConfig
    const billingPayload = {
      customerId: userId,
      customerName: name,
      customerEmail: email,
      customerPhone: phone,
    }

    setRegisterCardOpen(false)
    setIsRegistering(true)

    toast.info('결제 창이 열립니다. 팝업·새 창 차단을 해제해 주세요.')

    const supabase = createClient()
    const profilePromise = supabase
      .from('profiles')
      .update({
        manager_name: name,
        phone,
        email,
      })
      .eq('id', userId)

    const billingPromise = requestIssueBillingKeyWithConfig(cfg, billingPayload)

    try {
      const [profileRes, result] = await Promise.all([profilePromise, billingPromise])

      if (profileRes.error) {
        console.error('[subscription] profile update:', profileRes.error)
        toast.error(
          `프로필 저장 실패: ${profileRes.error.message}. 결제는 진행되었을 수 있으니 결과를 확인해 주세요.`,
        )
      } else {
        setUserName(name)
        setUserPhone(phone)
        setUserEmail(email)
      }

      if (!result.success) {
        toast.error(
          billingRegisterErrorMessage(
            result.error?.message,
            result.error?.code,
            result.error?.pgMessage,
          ),
        )
        return
      }

      if (result.needsServerConfirm && result.billingIssueToken) {
        await saveBillingKeyToServer({ billingIssueToken: result.billingIssueToken })
        return
      }

      if (!result.billingKey) {
        toast.error('빌링키를 받지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }

      await saveBillingKeyToServer({ billingKey: result.billingKey })
    } finally {
      setIsRegistering(false)
    }
  }

  const handleCancel = async () => {
    setIsCancelling(true)
    try {
      const res = await fetch('/api/billing/cancel', { method: 'DELETE' })
      const data = await res.json()
      if (res.ok) {
        const payload = data as { access_until?: string }
        const until =
          typeof payload.access_until === 'string'
            ? formatDate(payload.access_until)
            : null
        toast.success(
          until
            ? `구독이 해지되었습니다. ${until}까지 서비스를 이용할 수 있습니다.`
            : '구독이 해지되었습니다.',
        )
        setCancelDialogOpen(false)
        await fetchStatus()
      } else {
        toast.error(data.error ?? '구독 해지 중 오류가 발생했습니다.')
      }
    } finally {
      setIsCancelling(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="h-6 w-6 text-slate-400 animate-spin" />
      </div>
    )
  }

  const cfg = subscriptionCardUiConfig(sub)
  const StatusIcon = cfg.icon

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 pb-16">
      {/* 헤더 */}
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold text-white flex flex-wrap items-center gap-2">
            <CreditCard className="h-7 w-7 text-blue-400 shrink-0" />
            구독 · 자동결제
          </h1>
          <p className="text-slate-400 text-sm mt-2 max-w-xl">
            결제가 필요한 시점에는 카드 등록 직후 바로 청구되고, 이후 매월 동일 금액이 자동으로
            결제됩니다.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Badge variant="outline" className="border-blue-500/40 text-blue-300 text-xs">
              PortOne V2
            </Badge>
            <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 text-xs">
              NHN KCP · 빌링키
            </Badge>
            <Badge variant="outline" className="border-amber-500/40 text-amber-200 text-xs">
              {formatAmount(SUBSCRIPTION_AMOUNT)} /월 (VAT 포함)
            </Badge>
          </div>
        </div>
      </div>

      {statusError && (
        <div
          className="flex gap-3 p-4 rounded-lg border border-amber-700/50 bg-amber-950/30 text-amber-200 text-sm"
          role="alert"
        >
          <AlertTriangle className="h-5 w-5 shrink-0 text-amber-400" />
          <div className="space-y-2">
            <p className="font-medium text-amber-100">{statusError}</p>
            <p className="text-amber-200/80 text-xs">
              잠시 후 다시 시도하거나, 문제가 계속되면 관리자에게 문의해 주세요. (서비스 환경 설정·DB 연동을 확인해야 할 수 있습니다.)
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-amber-600 text-amber-100 hover:bg-amber-900/40"
              onClick={async () => {
                setLoading(true)
                try {
                  await fetchStatus()
                } finally {
                  setLoading(false)
                }
              }}
            >
              다시 시도
            </Button>
          </div>
        </div>
      )}

      {/* 현재 상태 카드 */}
      {sub && (
        <Card className={`border ${cfg.bgColor} bg-slate-900/50`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-white flex items-center gap-2 text-lg">
                <StatusIcon className={`h-5 w-5 ${cfg.color}`} />
                현재 구독 상태
              </CardTitle>
              <Badge variant="outline" className={`${cfg.badgeClass} text-xs font-medium`}>
                {cfg.label}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* 무료 체험 중 */}
            {sub.status === 'trial' && sub.is_trial_active && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">남은 무료 체험 기간</span>
                  <span className="text-blue-300 font-semibold">
                    {sub.trial_remaining_days}일
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">무료 체험 종료일</span>
                  <span className="text-slate-200">{formatDate(sub.trial_ends_at)}</span>
                </div>
                {/* 프로그레스 바 */}
                <div className="w-full bg-slate-700 rounded-full h-1.5 mt-2">
                  <div
                    className="bg-blue-500 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${Math.max(0, 100 - (sub.trial_remaining_days / 30) * 100)}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  체험 기간 30일 중 {30 - sub.trial_remaining_days}일 경과
                </p>
              </div>
            )}

            {/* 체험 기간 종료 후 카드 미등록 */}
            {sub.status === 'trial' && !sub.is_trial_active && !sub.has_card && (
              <div className="p-3 bg-amber-950/30 border border-amber-700/40 rounded-lg">
                <p className="text-amber-400 text-sm font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  무료 체험이 종료되었습니다
                </p>
                <p className="text-amber-300/70 text-xs mt-1">
                  카드를 등록하면 서비스를 계속 이용할 수 있습니다.
                </p>
              </div>
            )}

            {/* past_due: 실제 거절/오류만 실패 안내 (실패 0회·카드 있음은 청구 대기) */}
            {sub.status === 'past_due' && sub.has_card && (sub.failed_count ?? 0) === 0 && (
              <div className="p-3 bg-amber-950/30 border border-amber-700/40 rounded-lg space-y-1.5">
                <p className="text-amber-400 text-sm font-medium flex items-center gap-1.5">
                  <CalendarDays className="h-4 w-4" />
                  첫 구독 결제 처리 중이거나 예정입니다
                </p>
                {sub.next_billing_at && (
                  <p className="text-amber-200/80 text-xs">
                    다음 자동 청구·스케줄 기준일: {formatDate(sub.next_billing_at)}
                  </p>
                )}
                <p className="text-amber-300/70 text-xs">
                  무료 체험이 끝나기 전에는 요금이 청구되지 않습니다. 첫 결제는 보통 위 날짜가
                  되는 시점(매일 새벽 자동 청구 배치)에 진행되며, 그 전날까지는 결제가 나가지
                  않을 수 있습니다. 체험이 이미 끝난 뒤 카드를 등록했다면 등록 직후 바로 결제가
                  시도됩니다.
                </p>
                <p className="text-amber-300/70 text-xs">
                  카드는 정상 등록된 상태입니다. 결제가 끝나면 상태가「구독 중」으로 바뀝니다.
                </p>
              </div>
            )}
            {sub.status === 'past_due' && sub.has_card && (sub.failed_count ?? 0) > 0 && (
              <div className="p-3 bg-red-950/30 border border-red-700/40 rounded-lg">
                <p className="text-red-400 text-sm font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  결제에 실패했습니다 ({sub.failed_count ?? 0}회)
                </p>
                <p className="text-red-300/70 text-xs mt-1">
                  카드를 다시 등록하거나 결제 수단을 확인해주세요. 자동으로 재시도됩니다.
                </p>
              </div>
            )}
            {sub.status === 'past_due' && !sub.has_card && (
              <div className="p-3 bg-amber-950/30 border border-amber-700/40 rounded-lg">
                <p className="text-amber-400 text-sm font-medium flex items-center gap-1.5">
                  <AlertTriangle className="h-4 w-4" />
                  구독 결제를 위해 카드가 필요합니다
                </p>
                <p className="text-amber-300/70 text-xs mt-1">
                  아래에서 결제 수단을 등록해 주세요.
                </p>
              </div>
            )}

            {/* 구독 중 */}
            {sub.status === 'active' && (
              <div className="space-y-2">
                {sub.next_billing_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      다음 결제일
                    </span>
                    <span className="text-slate-200">{formatDate(sub.next_billing_at)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">결제 금액</span>
                  <span className="text-slate-200 font-medium">{formatAmount(SUBSCRIPTION_AMOUNT)}/월</span>
                </div>
                {sub.last_payment_at && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-400">마지막 결제</span>
                    <span className="text-slate-200">{formatDate(sub.last_payment_at)}</span>
                  </div>
                )}
              </div>
            )}

            {/* 해지됨 */}
            {sub.status === 'cancelled' && sub.grace_access_active && sub.access_until && (
              <div className="p-3 bg-sky-950/30 border border-sky-700/40 rounded-lg text-sm space-y-1.5">
                <p className="text-sky-300 font-medium">구독·자동결제는 해지되었습니다</p>
                <p className="text-slate-300">
                  등록된 카드(빌링키)는 삭제되었으며 추가 결제되지 않습니다. 서비스는{' '}
                  <span className="text-white font-medium">
                    {formatDate(sub.access_until)}
                  </span>
                  까지 이용할 수 있습니다.
                </p>
                <p className="text-slate-500 text-xs">
                  해지 요청일: {formatDate(sub.cancelled_at)}
                </p>
              </div>
            )}
            {sub.status === 'cancelled' && !sub.grace_access_active && (
              <div className="text-sm text-slate-400">
                <p>
                  해지일: <span className="text-slate-200">{formatDate(sub.cancelled_at)}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  재사용을 원하시면 아래에서 카드를 다시 등록해 주세요.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 결제 수단 카드 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="space-y-0">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <CardTitle className="text-white text-base flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-slate-400" />
              결제 수단 · 구독 관리
            </CardTitle>
            {sub &&
              sub.status !== 'cancelled' &&
              (sub.has_card || sub.status === 'active') && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="border-red-500/40 text-red-400 hover:bg-red-950/30 shrink-0"
                  onClick={() => setCancelDialogOpen(true)}
                >
                  구독 취소
                </Button>
              )}
          </div>
          <CardDescription className="text-slate-400 text-xs pt-2">
            무료 체험 중에는 결제일이 오지 않으며, 체험 종료 후(또는 이미 결제일이 지난 경우)에는 카드
            등록 직후 즉시 첫 결제가 진행됩니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sub?.has_card ? (
            <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center">
                  <CreditCard className="h-4 w-4 text-slate-300" />
                </div>
                <div>
                  <p className="text-slate-200 text-sm font-medium">
                    {sub.card_company || '카드'}
                    {sub.card_number_masked && (
                      <span className="text-slate-400 ml-2 font-normal">
                        {sub.card_number_masked}
                      </span>
                    )}
                  </p>
                  <p className="text-slate-500 text-xs flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3" />
                    포트원 보안 등록
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={openRegisterCardDialog}
                disabled={isRegistering}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
              >
                {isRegistering ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  '카드 변경'
                )}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 border border-dashed border-slate-600 rounded-lg text-center">
                <CreditCard className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">등록된 카드가 없습니다</p>
                <p className="text-slate-500 text-xs mt-1">
                  카드 등록 후 무료 체험 종료 시 자동 결제됩니다
                </p>
              </div>
              <Button
                onClick={openRegisterCardDialog}
                disabled={isRegistering}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isRegistering ? (
                  <span className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    카드 등록 중...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    카드 등록하기 (NHN KCP 안전 결제)
                  </span>
                )}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 플랜 정보 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-400" />
            정산타임 구독 플랜
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 mb-4">
            <span className="text-3xl font-bold text-white">20,000</span>
            <span className="text-slate-400 mb-1">원 / 월 (VAT 포함)</span>
          </div>
          <ul className="space-y-2">
            {[
              '엑셀 파일 자동 정산 처리',
              '프로모션·보험료·원천세 자동 계산',
              '선지급금 자동 공제',
              '지사 순이익 대시보드 (12주)',
              '라이더 개인 정산서 URL 발행',
              '멀티 플랫폼 데이터 통합',
            ].map((feature) => (
              <li key={feature} className="flex items-center gap-2 text-sm text-slate-300">
                <BadgeCheck className="h-4 w-4 text-blue-400 shrink-0" />
                {feature}
              </li>
            ))}
          </ul>
          <div className="mt-4 pt-4 border-t border-slate-700 flex items-center gap-2 text-xs text-slate-500">
            <ShieldCheck className="h-3.5 w-3.5" />
            신규 가입 후 30일 무료 체험 · 언제든지 해지 가능
          </div>
        </CardContent>
      </Card>

      {/* 결제 내역 */}
      {history.length > 0 && (
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white text-base">결제 내역</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {history.map((payment) => (
                <div
                  key={payment.id}
                  className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg"
                >
                  <div>
                    <p className="text-slate-200 text-sm">{payment.order_name}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {formatDate(payment.paid_at ?? payment.created_at)}
                      {payment.is_test && (
                        <span className="ml-2 px-1 py-0.5 bg-amber-900/40 text-amber-400 rounded text-[10px]">
                          테스트
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-200 text-sm font-medium">
                      {formatAmount(payment.amount)}
                    </p>
                    <Badge
                      variant="outline"
                      className={`text-[10px] mt-0.5 ${
                        payment.status === 'PAID'
                          ? 'border-green-500/50 text-green-400'
                          : payment.status === 'CANCELLED'
                          ? 'border-slate-500/50 text-slate-400'
                          : 'border-red-500/50 text-red-400'
                      }`}
                    >
                      {payment.status === 'PAID'
                        ? '결제완료'
                        : payment.status === 'CANCELLED'
                        ? '취소'
                        : '실패'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 카드 등록 — 정기결제용 고객 정보 입력 후 PG 창 */}
      <Dialog open={registerCardOpen} onOpenChange={setRegisterCardOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-blue-400" />
              정기 구독 카드 등록
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm text-left space-y-2 pt-1">
              <span className="block">
                NHN KCP 정기·빌링 등록 시 카드사에 전달되는 정보입니다. 빈 칸이 없도록 입력해 주세요.
              </span>
              <span className="block text-slate-500 text-xs">
                이 정보는 프로필(담당자/연락처/이메일)에도 저장되어 이후 자동 결제 시에 사용됩니다.
              </span>
            </DialogDescription>
          </DialogHeader>

          {billingConfigStatus === 'loading' && (
            <div className="flex items-center gap-2 rounded-md border border-slate-600 bg-slate-800/60 px-3 py-2 text-sm text-slate-300">
              <RefreshCw className="h-4 w-4 animate-spin shrink-0 text-blue-400" />
              결제 연동 정보를 불러오는 중입니다…
            </div>
          )}
          {billingConfigStatus === 'error' && billingConfigMessage && (
            <div
              className="rounded-md border border-amber-600/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-200 space-y-2"
              role="alert"
            >
              <p>{billingConfigMessage}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-amber-700 text-amber-100 hover:bg-amber-900/40"
                onClick={() => void loadBillingConfigForDialog()}
              >
                다시 불러오기
              </Button>
            </div>
          )}

          <div className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="billing-name" className="text-slate-200">
                담당자 실명 <span className="text-red-400">*</span>
              </Label>
              <Input
                id="billing-name"
                value={billingName}
                onChange={(e) => setBillingName(e.target.value)}
                placeholder="신분증과 동일한 이름 권장"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                autoComplete="name"
              />
              {billingFormErrors.realName && (
                <p className="text-xs text-red-400">{billingFormErrors.realName}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-phone" className="text-slate-200">
                휴대폰 번호 <span className="text-red-400">*</span>
              </Label>
              <Input
                id="billing-phone"
                value={billingPhone}
                onChange={(e) => setBillingPhone(e.target.value)}
                placeholder="01012345678 또는 010-1234-5678"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                autoComplete="tel"
                inputMode="tel"
              />
              {billingFormErrors.phone && (
                <p className="text-xs text-red-400">{billingFormErrors.phone}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="billing-email" className="text-slate-200">
                이메일 <span className="text-red-400">*</span>
              </Label>
              <Input
                id="billing-email"
                type="email"
                value={billingEmail}
                onChange={(e) => setBillingEmail(e.target.value)}
                placeholder="연락 가능한 이메일"
                className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                autoComplete="email"
              />
              {billingFormErrors.email && (
                <p className="text-xs text-red-400">{billingFormErrors.email}</p>
              )}
            </div>
          </div>
          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => setRegisterCardOpen(false)}
            >
              취소
            </Button>
            <Button
              type="button"
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              onClick={() => void handleConfirmBillingRegister()}
              disabled={billingConfigStatus !== 'ready'}
            >
              다음: 카드 입력 화면
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* 해지 확인 다이얼로그 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              구독을 해지하시겠습니까?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm space-y-2 pt-2">
              {previewSubscriptionAccessEndLabel(sub) ? (
                <span className="block text-slate-300">
                  해지 후에도{' '}
                  <strong className="text-white">
                    {previewSubscriptionAccessEndLabel(sub)}
                  </strong>
                  까지 서비스를 이용할 수 있습니다. (유료 구독 중이면 현재 결제 주기 종료일,
                  무료 체험 중이면 체험 종료일 기준)
                </span>
              ) : (
                <span className="block">
                  남은 무료 체험·결제 주기가 없으면 해지 직후부터 이용이 제한될 수 있습니다.
                </span>
              )}
              <span className="block">
                등록된 카드(빌링키)는 즉시 삭제되며, 이후 자동 결제는 이루어지지 않습니다.
              </span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 border-slate-600 text-slate-300 hover:bg-slate-800"
              onClick={() => setCancelDialogOpen(false)}
              disabled={isCancelling}
            >
              취소
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              onClick={handleCancel}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                '해지 확인'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
