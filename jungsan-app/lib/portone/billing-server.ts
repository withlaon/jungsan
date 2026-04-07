/**
 * 포트원 V2 빌링키 서버 사이드 유틸리티
 * 빌링키로 결제 청구, 빌링키 조회/삭제 등을 처리합니다.
 */

import { getBillingChannelKeyServer } from '@/lib/portone/billing-channel-key'
import { requirePortOneApiSecret } from '@/lib/portone/api-secret'

const PORTONE_API_BASE = 'https://api.portone.io'
const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() ?? ''

function authHeader() {
  return { Authorization: `PortOne ${requirePortOneApiSecret()}` }
}

function formatPortOneFailure(data: unknown, status: number): string {
  if (data && typeof data === 'object') {
    const o = data as Record<string, unknown>
    if (o.type === 'UNAUTHORIZED' || status === 401) {
      return (
        '포트원 API 인증 실패(UNAUTHORIZED). 서버에 PORTONE_API_SECRET(V2 API Secret)을 설정했는지 확인하세요. ' +
        '주소창에서 api.portone.io를 직접 열면 인증 없이 동일 응답이 나오는 것은 정상입니다.'
      )
    }
    if (typeof o.message === 'string' && o.message) return o.message
  }
  return `포트원 API 오류 (HTTP ${status})`
}

function unwrapBillingKeyResponse(
  data: unknown,
  pathBillingKey: string,
): BillingKeyInfo {
  const root = data && typeof data === 'object' ? (data as Record<string, unknown>) : {}
  const inner =
    root.billingKeyInfo && typeof root.billingKeyInfo === 'object'
      ? (root.billingKeyInfo as Record<string, unknown>)
      : root
  const bk = (inner.billingKey ?? root.billingKey ?? pathBillingKey) as string
  const status = (inner.status ?? root.status ?? 'UNKNOWN') as string
  const methods = (inner.methods ?? root.methods) as BillingKeyInfo['methods']
  return { billingKey: bk, status, methods }
}

function normalizePhoneDigits(phone?: string): string | undefined {
  const digits = phone?.replace(/\D/g, '') ?? ''
  if (digits.length < 10 || digits.length > 15) return undefined
  return digits
}

function truncateUtf8Bytes(str: string, maxBytes: number): string {
  if (!str || maxBytes <= 0) return ''
  const enc = new TextEncoder()
  let used = 0
  let out = ''
  for (const ch of str) {
    const b = enc.encode(ch)
    if (used + b.length > maxBytes) break
    used += b.length
    out += ch
  }
  return out.trim()
}

function truncateKcpOrderName(s: string): string {
  const t = truncateUtf8Bytes(s.trim(), 40)
  return t || 'Order'
}

function truncateKcpPersonName(s: string): string {
  const t = truncateUtf8Bytes(s.trim(), 20)
  return t || 'Subscriber'
}

function truncateKcpEmail(s: string): string {
  return truncateUtf8Bytes(s.trim(), 40)
}

/** 포트원 customer.id — UUID 무하이픈 상한 */
function truncateKcpId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-]/g, '').replace(/-/g, '').slice(0, 32)
}

// ──────────────────────────────────────────────────────────────────────────────
// 빌링키 정보 조회
// ──────────────────────────────────────────────────────────────────────────────

export interface BillingKeyInfo {
  billingKey: string
  status: string
  methods?: Array<{
    type: string
    card?: {
      publisher?: { name?: string }
      issuer?: { name?: string }
      brand?: string
      number?: string
    }
  }>
}

export async function getBillingKeyInfo(billingKey: string): Promise<BillingKeyInfo> {
  const res = await fetch(
    `${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`,
    { headers: authHeader(), cache: 'no-store' },
  )
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(formatPortOneFailure(data, res.status))
  return unwrapBillingKeyResponse(data, billingKey)
}

/** 빌링키에서 카드사 및 마스킹 번호 추출 */
export function extractCardInfo(info: BillingKeyInfo): {
  cardCompany: string
  cardNumberMasked: string
} {
  const method = info.methods?.[0]
  const card = method?.card
  const cardCompany =
    card?.issuer?.name ?? card?.publisher?.name ?? card?.brand ?? '카드'
  const cardNumberMasked = card?.number ?? ''
  return { cardCompany, cardNumberMasked }
}

// ──────────────────────────────────────────────────────────────────────────────
// 빌링키로 결제 청구
// ──────────────────────────────────────────────────────────────────────────────

export interface BillingChargeRequest {
  paymentId: string
  billingKey: string
  orderName: string
  amount: number
  customerId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
}

export interface BillingChargeResponse {
  id: string
  status: string
  txId?: string
  amount: { total: number; currency: string }
  paidAt?: string
  failedAt?: string
  failReason?: string
}

export async function chargeBillingKey(
  request: BillingChargeRequest
): Promise<BillingChargeResponse> {
  const res = await fetch(
    `${PORTONE_API_BASE}/payments/${encodeURIComponent(request.paymentId)}/billing-key`,
    {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        storeId: PORTONE_STORE_ID,
        billingKey: request.billingKey,
        channelKey: getBillingChannelKeyServer() || undefined,
        orderName: truncateKcpOrderName(request.orderName),
        amount: { total: request.amount },
        currency: 'KRW',
        customer: {
          id: truncateKcpId(request.customerId),
          name: { full: truncateKcpPersonName(request.customerName) },
          ...(request.customerEmail
            ? { email: truncateKcpEmail(request.customerEmail) }
            : {}),
          phoneNumber: normalizePhoneDigits(request.customerPhone),
        },
      }),
    },
  )
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown> & {
    message?: string
    pgMessage?: string
    failure?: { message?: string }
    type?: string
    payment?: {
      id?: string
      status?: string
      transactionId?: string
      amount?: { total?: number; currency?: string }
      paidAt?: string
      failedAt?: string
    }
  }
  if (!res.ok) {
    const msg =
      (data.type === 'UNAUTHORIZED' ? formatPortOneFailure(data, res.status) : null) ??
      data.message ??
      data.pgMessage ??
      data.failure?.message ??
      `빌링키 결제 실패 (HTTP ${res.status})`
    throw new Error(msg)
  }

  // V2 PayWithBillingKey 성공 응답: { payment: PaidPayment } (최상위에 status 없음)
  const payment =
    data.payment && typeof data.payment === 'object'
      ? data.payment
      : null

  if (!payment) {
    throw new Error(
      '빌링키 결제 응답에 payment 객체가 없습니다. 포트원 V2 API 응답 형식을 확인하세요.',
    )
  }

  const amt = payment.amount
  return {
    id: String(payment.id ?? request.paymentId),
    status: String(payment.status ?? ''),
    txId:
      payment.transactionId !== undefined && payment.transactionId !== null
        ? String(payment.transactionId)
        : undefined,
    amount: {
      total: typeof amt?.total === 'number' ? amt.total : request.amount,
      currency: typeof amt?.currency === 'string' ? amt.currency : 'KRW',
    },
    paidAt:
      payment.paidAt !== undefined && payment.paidAt !== null
        ? String(payment.paidAt)
        : undefined,
    failedAt:
      payment.failedAt !== undefined && payment.failedAt !== null
        ? String(payment.failedAt)
        : undefined,
  } as BillingChargeResponse
}

// ──────────────────────────────────────────────────────────────────────────────
// 빌링키 삭제 (구독 해지 시)
// ──────────────────────────────────────────────────────────────────────────────

export async function deleteBillingKey(billingKey: string): Promise<void> {
  const res = await fetch(
    `${PORTONE_API_BASE}/billing-keys/${encodeURIComponent(billingKey)}`,
    { method: 'DELETE', headers: authHeader() }
  )
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error(formatPortOneFailure(data, res.status))
  }
}

/**
 * 콘솔에서 「빌링키 발급 수동 승인」 사용 시 SDK 응답 billingIssueToken 으로 실제 빌링키 확정
 * @see https://developers.portone.io/api/rest-v2/payment.billingKey
 */
export async function confirmBillingKeyIssue(billingIssueToken: string): Promise<string> {
  const token = billingIssueToken.trim()
  if (!token) throw new Error('billingIssueToken이 비어 있습니다.')

  const res = await fetch(`${PORTONE_API_BASE}/billing-keys/confirm`, {
    method: 'POST',
    headers: { ...authHeader(), 'Content-Type': 'application/json' },
    body: JSON.stringify({
      storeId: PORTONE_STORE_ID,
      billingIssueToken: token,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    message?: string
    billingKey?: string
    billingKeyInfo?: { billingKey?: string }
  }

  if (!res.ok) {
    throw new Error(formatPortOneFailure(data, res.status))
  }

  const billingKey =
    data.billingKey ?? data.billingKeyInfo?.billingKey ?? ''
  if (!billingKey || billingKey === 'NEEDS_CONFIRMATION') {
    throw new Error('빌링키 승인 응답에 유효한 billingKey가 없습니다.')
  }

  return billingKey
}
