'use client'

/**
 * 포트원 V2 — 구독형 정기결제용 빌링키 (결제창 방식)
 *
 * [빌링키란] 카드 원번호를 저장하지 않고 PG가 발급한 빌링키만 보관한 뒤, 원하는 시점에 그 키로 결제 요청.
 *
 * [구현 단계]
 * 1) 빌링키 발급 (본 모듈) — PG 결제창에서 고객이 카드 입력 → PortOne.requestIssueBillingKey()
 * 2) 발급된 billingKey 저장 — POST /api/billing/issue
 * 3) 월 청구 등 결제 요청 — lib/portone/billing-server.ts 의 chargeBillingKey() · Vercel cron /api/cron/billing
 *
 * 다른 방식(API로 카드번호 직접 전달 등)은 사용하지 않습니다.
 *
 * 사전 준비:
 * 1. 포트원 관리자콘솔 > [연동 관리] > [채널 관리] > [테스트 채널 추가]
 *    → PG사: NHN KCP, 결제 유형: "빌링키" 또는 "KCP 결제창 정기결제"에 맞는 사이트코드 선택 후 저장
 * 2. 채널 키 (발급·청구 공통, 서버 우선순위는 lib/portone/billing-channel-key.ts 참고)
 *    - 권장: PORTONE_BILLING_CHANNEL_KEY_DOMESTIC (서버/Vercel Secrets) = 포트원「국내 정기·빌링키」채널만
 *    - GET /api/billing/issue-config 가 클라이언트에 storeId·channelKey 전달
 *    - 일반 결제·해외 전용 채널 키를 그대로 쓰면 국내 카드 [3192]가 계속됩니다.
 *
 * KCP 연동 시 buyer 연락처는 숫자만 허용됩니다. 하이픈 포함(010-0000-0000)이면 PG가 검증 단계에서
 * 비정상 동작·[3192] 등 카드번호 오류 메시지로 표시되는 사례가 있어 아래에서 정규화합니다.
 */

import PortOne, {
  BillingKeyMethod,
  Currency,
  ProductType,
  type Customer,
} from '@portone/browser-sdk/v2'

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
export function normalizeKcpPhone(phone?: string): string | undefined {
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
  let storeId = ''
  let channelKey = ''
  try {
    const cfgRes = await fetch('/api/billing/issue-config', {
      credentials: 'include',
      cache: 'no-store',
    })
    const cfgJson = (await cfgRes.json().catch(() => ({}))) as {
      storeId?: string
      channelKey?: string
      error?: string
    }

    if (!cfgRes.ok) {
      return {
        success: false,
        error: {
          message:
            typeof cfgJson.error === 'string'
              ? cfgJson.error
              : `빌링 설정을 불러오지 못했습니다. (${cfgRes.status})`,
        },
      }
    }

    storeId = cfgJson.storeId?.trim() ?? ''
    channelKey = cfgJson.channelKey?.trim() ?? ''
    if (!storeId || !channelKey) {
      return {
        success: false,
        error: { message: '포트원 상점 또는 빌링 채널 정보가 비어 있습니다.' },
      }
    }
  } catch {
    return {
      success: false,
      error: {
        message: '빌링 채널 설정 조회 중 네트워크 오류가 발생했습니다.',
      },
    }
  }

  try {
    const response = await PortOne.requestIssueBillingKey({
      storeId,
      channelKey,
      billingKeyMethod: BillingKeyMethod.CARD,
      issueName: '정산타임 구독 카드 등록',
      issueId: newBillingIssueId(request.customerId),
      displayAmount: SUBSCRIPTION_AMOUNT,
      currency: Currency.KRW,
      productType: ProductType.DIGITAL,
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
