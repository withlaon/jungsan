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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { createClient } from '@/lib/supabase/client'
import {
  requestIssueBillingKey,
  SUBSCRIPTION_AMOUNT,
  normalizeKcpPhone,
  getKcpBillingCustomerGaps,
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
      'PG에서 요청 전문 길이 오류로 거절했습니다. 프로필 담당자명·이메일이 매우 길면 짧게 수정한 뒤 다시 시도해 주세요. ' +
      '동일하면 포트원 관리자 콘솔 [결제] → [빌링결제 내역 조회]와 빌링키 조회 API로 발급·결제 시도 여부를 확인해 주세요.'
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
  cancelled: {
    label: '해지됨',
    color: 'text-slate-400',
    bgColor: 'bg-slate-500/10 border-slate-500/30',
    badgeClass: 'border-slate-500 text-slate-400',
    icon: XCircle,
  },
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

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/billing/status')
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
      setStatusError('네트워크 오류로 구독 상태를 확인할 수 없습니다.')
      setSub(null)
      console.error('[subscription] 상태 조회 오류:', e)
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
    const init = async () => {
      setLoading(true)
      try {
        const supabase = createClient()
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          setUserId(user.id)

          const { data: profile } = await supabase
            .from('profiles')
            .select('manager_name, phone, email')
            .eq('id', user.id)
            .single()
          setUserName(profile?.manager_name ?? '')
          setUserPhone(profile?.phone ?? '')
          /** KCP customer.email: 로그인 이메일 우선, 없으면 프로필 email */
          setUserEmail((user.email ?? profile?.email ?? '').trim())
        }
        await Promise.all([fetchStatus(), fetchHistory()])
      } finally {
        setLoading(false)
      }
    }
    init()
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

      if (!normalizeKcpPhone(userPhone)) {
        toast.error(
          '카드 등록을 마무리하려면 프로필에 휴대폰 번호를 저장한 뒤 다시 시도해 주세요. (정보수정)',
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
  }, [loading, userId, userPhone, saveBillingKeyToServer])

  const handleRegisterCard = async () => {
    if (!userId) {
      toast.error('로그인 정보를 불러올 수 없습니다.')
      return
    }
    const kcpGaps = getKcpBillingCustomerGaps({
      customerId: userId,
      customerName: userName,
      customerEmail: userEmail,
      customerPhone: userPhone,
    })
    if (kcpGaps.includes('phone')) {
      toast.error(
        'KCP 카드 등록을 위해 프로필에 휴대폰 번호를 저장해 주세요. (사이드바 정보수정 — 01012345678 또는 010-0000-0000 형식)',
      )
      return
    }
    if (kcpGaps.includes('email')) {
      toast.error(
        'KCP 결제창 연동을 위해 이메일이 필요합니다. 로그인 계정 또는 프로필(정보수정)에 이메일을 입력해 주세요.',
      )
      return
    }
    if (kcpGaps.includes('realName')) {
      toast.error(
        '프로필에 담당자명(실명)을 입력해 주세요. 카드 명의와 다르면 KCP에서 거절될 수 있습니다.',
      )
      return
    }
    setIsRegistering(true)
    try {
      // ① 포트원 SDK: PG 결제창에서 카드 입력 → 빌링키 발급 (PortOne.requestIssueBillingKey)
      const result = await requestIssueBillingKey({
        customerId: userId,
        customerName: userName || '구독자',
        customerEmail: userEmail,
        customerPhone: userPhone,
      })

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

      // ② 수동 승인 채널 → 서버에서 confirm 후 저장
      if (result.needsServerConfirm && result.billingIssueToken) {
        await saveBillingKeyToServer({ billingIssueToken: result.billingIssueToken })
        return
      }

      if (!result.billingKey) {
        toast.error('빌링키를 받지 못했습니다. 잠시 후 다시 시도해 주세요.')
        return
      }

      // ③ 서버(DB)에 빌링키만 저장 — 월 구독 청구는 cron 등에서 chargeBillingKey로 수행
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
        toast.success('구독이 해지되었습니다.')
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

  const cfg = sub ? STATUS_CONFIG[sub.status] : STATUS_CONFIG.trial
  const StatusIcon = cfg.icon

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* 헤더 */}
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-blue-400" />
          구독 결제 관리
        </h1>
        <p className="text-slate-400 text-sm mt-1">정산타임 월 구독 및 결제 수단을 관리합니다.</p>
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

            {/* 결제 실패 */}
            {sub.status === 'past_due' && (
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
            {sub.status === 'cancelled' && (
              <div className="text-sm text-slate-400">
                <p>
                  해지일: <span className="text-slate-200">{formatDate(sub.cancelled_at)}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  재사용을 원하시면 카드를 다시 등록해주세요.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 결제 수단 카드 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-slate-400" />
            결제 수단
          </CardTitle>
          <CardDescription className="text-slate-400 text-xs">
            등록된 카드로 무료 체험 종료 후 자동 결제됩니다.
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
                onClick={handleRegisterCard}
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
                onClick={handleRegisterCard}
                disabled={isRegistering || sub?.status === 'cancelled'}
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

      {/* 구독 해지 */}
      {sub && sub.status !== 'cancelled' && sub.has_card && (
        <div className="pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCancelDialogOpen(true)}
            className="text-slate-500 hover:text-red-400 hover:bg-red-950/20 text-xs"
          >
            구독 해지
          </Button>
        </div>
      )}

      {/* 해지 확인 다이얼로그 */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
              구독을 해지하시겠습니까?
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-sm space-y-2 pt-2">
              <span className="block">
                해지 후에도 현재 결제 주기 종료일까지 서비스를 이용할 수 있습니다.
              </span>
              <span className="block">
                등록된 카드 정보(빌링키)가 즉시 삭제되며, 다음 결제일에 자동 청구되지 않습니다.
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
