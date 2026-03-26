/**
 * 포트원 V2 빌링키 서버 사이드 유틸리티
 * 빌링키로 결제 청구, 빌링키 조회/삭제 등을 처리합니다.
 */

const PORTONE_API_BASE = 'https://api.portone.io'
const PORTONE_API_SECRET = process.env.PORTONE_API_SECRET ?? ''
const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? ''
const PORTONE_BILLING_CHANNEL_KEY =
  process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY ?? ''

function authHeader() {
  if (!PORTONE_API_SECRET) {
    throw new Error('PORTONE_API_SECRET 환경변수가 설정되지 않았습니다.')
  }
  return { Authorization: `PortOne ${PORTONE_API_SECRET}` }
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
    { headers: authHeader(), cache: 'no-store' }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? '빌링키 정보 조회 실패')
  return data as BillingKeyInfo
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
        channelKey: PORTONE_BILLING_CHANNEL_KEY || undefined,
        orderName: request.orderName,
        amount: { total: request.amount },
        currency: 'KRW',
        customer: {
          id: request.customerId,
          name: { full: request.customerName },
          email: request.customerEmail,
          phoneNumber: request.customerPhone,
        },
      }),
    }
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.message ?? '빌링키 결제 실패')
  return data as BillingChargeResponse
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
    throw new Error(data.message ?? '빌링키 삭제 실패')
  }
}
