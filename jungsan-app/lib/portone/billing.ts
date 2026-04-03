'use client'

/**
 * 포트원 V2 빌링키 발급 (클라이언트 전용)
 *
 * 사전 준비:
 * 1. 포트원 관리자콘솔 > [연동 관리] > [채널 관리] > [테스트 채널 추가]
 *    → PG사: NHN KCP, 결제 유형: "빌링키" 또는 "KCP 결제창 정기결제"에 맞는 사이트코드 선택 후 저장
 * 2. 생성된 채널 키를 .env.local 의 NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY 에 입력
 *
 * KCP 연동 시 buyer 연락처는 숫자만 허용됩니다. 하이픈 포함(010-0000-0000)이면 PG가 검증 단계에서
 * 비정상 동작·[3192] 등 카드번호 오류 메시지로 표시되는 사례가 있어 아래에서 정규화합니다.
 */

import PortOne, {
  BillingKeyMethod,
  Currency,
  type Customer,
} from '@portone/browser-sdk/v2'

export const PORTONE_STORE_ID = process.env.NEXT_PUBLIC_PORTONE_STORE_ID ?? ''
export const PORTONE_BILLING_CHANNEL_KEY =
  process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY ?? ''

export const SUBSCRIPTION_AMOUNT = 20_000  // 월 구독료 (원)
export const TRIAL_DAYS = 30               // 무료 체험 기간

export interface IssueBillingKeyRequest {
  customerId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
}

export interface IssueBillingKeyResult {
  success: boolean
  billingKey?: string
  error?: { code?: string; message?: string }
}

/** KCP/PG: phoneNumber는 숫자만 (포트원 개발자 문서 권장) */
function normalizeKcpPhone(phone?: string): string | undefined {
  const trimmed = phone?.trim()
  if (!trimmed) return undefined
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return undefined
  return digits
}

function buildBillingCustomer(request: IssueBillingKeyRequest): Customer {
  const customer: Customer = {
    customerId: request.customerId,
    fullName: request.customerName,
  }
  const email = request.customerEmail?.trim()
  if (email) customer.email = email
  const phoneNumber = normalizeKcpPhone(request.customerPhone)
  if (phoneNumber) customer.phoneNumber = phoneNumber
  return customer
}

function newBillingIssueId(customerId: string): string {
  const suffix =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '')
      : `${Date.now()}_${Math.random().toString(16).slice(2)}`
  const raw = `bk_${customerId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24)}_${suffix}`
  return raw.length > 64 ? raw.slice(0, 64) : raw
}

/**
 * 포트원 V2 NHN KCP 빌링키 발급 요청
 * 사용자가 카드 정보를 입력하면 PortOne이 빌링키를 발급해 반환합니다.
 */
export async function requestIssueBillingKey(
  request: IssueBillingKeyRequest
): Promise<IssueBillingKeyResult> {
  if (!PORTONE_STORE_ID) {
    return {
      success: false,
      error: { message: 'NEXT_PUBLIC_PORTONE_STORE_ID 가 설정되지 않았습니다.' },
    }
  }
  if (!PORTONE_BILLING_CHANNEL_KEY) {
    return {
      success: false,
      error: {
        message:
          'NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY 가 설정되지 않았습니다. ' +
          '포트원 콘솔에서 NHN KCP 빌링 채널을 추가하고 환경변수를 설정해주세요.',
      },
    }
  }

  try {
    const response = await PortOne.requestIssueBillingKey({
      storeId: PORTONE_STORE_ID,
      channelKey: PORTONE_BILLING_CHANNEL_KEY,
      billingKeyMethod: BillingKeyMethod.CARD,
      issueName: '정산타임 구독 카드 등록',
      issueId: newBillingIssueId(request.customerId),
      displayAmount: SUBSCRIPTION_AMOUNT,
      currency: Currency.KRW,
      customer: buildBillingCustomer(request),
      // NHN KCP 빌링키 PC는 POPUP 미지원 → windowType 미지정 시 PG 기본(IFRAME 등) 사용
    })

    if (!response || 'code' in response) {
      const errResp = response as { code?: string; message?: string } | null
      return {
        success: false,
        error: {
          code: errResp?.code,
          message: errResp?.message ?? '카드 등록에 실패했습니다.',
        },
      }
    }

    return {
      success: true,
      billingKey: (response as { billingKey?: string }).billingKey,
    }
  } catch (error) {
    const err = error as Error
    return {
      success: false,
      error: { message: err.message ?? '카드 등록 처리 중 오류가 발생했습니다.' },
    }
  }
}
