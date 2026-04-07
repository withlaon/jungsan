'use client'

/**
 * 포트원 V2 브라우저 SDK — 빌링키 발급
 *
 * 올바른 함수명은 **`PortOne.requestIssueBillingKey`** 입니다.
 * (`requestBillingKey` 는 @portone/browser-sdk/v2 에 존재하지 않습니다.)
 *
 * @see https://developers.portone.io/opi/ko/integration/start/v2/billing/issue?v=v2
 * @see IssueBillingKeyRequestBase — storeId, channelKey?, billingKeyMethod, issueName?, issueId?, customer?, …
 *
 * NHN KCP 정기·빌링 채널: env의 channelKey는 일반 결제가 아닌 정기용이어야 합니다.
 * @see https://help.portone.io/content/kcp_channel
 *
 * storeId / channelKey → `/api/billing/issue-config` (NEXT_PUBLIC_PORTONE_STORE_ID + getBillingChannelKeyServer)
 */

import PortOne, {
  BillingKeyMethod,
  WindowType,
  type Customer,
} from '@portone/browser-sdk/v2'

export const SUBSCRIPTION_AMOUNT = 20_000
export const TRIAL_DAYS = 30

export interface IssueBillingKeyRequest {
  customerId: string
  customerName: string
  customerEmail?: string
  customerPhone?: string
}

export interface IssueBillingKeyResult {
  success: boolean
  billingIssueToken?: string
  needsServerConfirm?: boolean
  billingKey?: string
  error?: { code?: string; message?: string; pgMessage?: string }
}

/** KCP·포트원 권장: 휴대폰은 숫자만 */
export function normalizeKcpPhone(phone?: string): string | undefined {
  const trimmed = phone?.trim()
  if (!trimmed) return undefined
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return undefined
  return digits
}

export function getKcpBillingCustomerGaps(request: IssueBillingKeyRequest): Array<
  'realName' | 'phone' | 'email'
> {
  const gaps: Array<'realName' | 'phone' | 'email'> = []
  if (!request.customerName?.trim()) gaps.push('realName')
  if (!normalizeKcpPhone(request.customerPhone)) gaps.push('phone')
  if (!request.customerEmail?.trim()) gaps.push('email')
  return gaps
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

/** 포트원: issueId는 ASCII 출력 가능 문자만 */
function shortAsciiIssueId(): string {
  const raw = `${ Date.now() }${ Math.floor(Math.random() * 1_000) }`
  return raw.replace(/\D/g, '').slice(-12).padStart(12, '0')
}

/** customerId: UUID 등 → PG 안전한 영숫자 위주 */
function sdkCustomerId(internalId: string): string {
  const s = internalId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 64)
  return s.length >= 8 ? s : `u${internalId.replace(/\W/g, '').slice(0, 20)}`
}

function buildSdkCustomer(req: IssueBillingKeyRequest): Customer {
  const fullName = truncateUtf8Bytes(req.customerName?.trim() || '구독자', 30)
  const customer: Customer = {
    customerId: sdkCustomerId(req.customerId.trim()),
    fullName: fullName || '구독자',
  }
  const phone = normalizeKcpPhone(req.customerPhone)
  if (phone) customer.phoneNumber = phone
  const em = req.customerEmail?.trim()
  if (em) customer.email = truncateUtf8Bytes(em, 50)
  return customer
}

function isMobileBillingEnvironment(): boolean {
  if (typeof window === 'undefined') return false
  if (/Android|iPhone|iPad|iPod|Mobile|IEMobile|BlackBerry/i.test(navigator.userAgent)) {
    return true
  }
  try {
    return window.matchMedia('(max-width: 767px)').matches
  } catch {
    return false
  }
}

function sdkIssueName(): string {
  const name = truncateUtf8Bytes('정산타임 정기 구독 카드 등록', 40)
  return name || 'Card registration'
}

/**
 * V2 규격: `PortOne.requestIssueBillingKey` + IssueBillingKeyRequest 타입과 동일한 필드만 사용합니다.
 */
export async function requestIssueBillingKey(
  request: IssueBillingKeyRequest,
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
      apiSecretConfigured?: boolean
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
    if (cfgJson.apiSecretConfigured === false) {
      return {
        success: false,
        error: {
          message:
            '서버에 PORTONE_API_SECRET(V2 API Secret)이 없어 카드 등록 후 처리가 불완전할 수 있습니다. ' +
            'Vercel/서버 환경변수를 설정한 뒤 다시 시도해 주세요.',
        },
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

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const redirectUrl = origin ? `${origin}/bk` : undefined
  const mobile = isMobileBillingEnvironment()

  const mobileOnly =
    mobile && redirectUrl
      ? {
          windowType: {
            pc: WindowType.IFRAME,
            mobile: WindowType.REDIRECTION,
          },
          redirectUrl,
          offerPeriod: { interval: '1m' as const },
        }
      : {}

  try {
    // PC(iframe) KCP: 전문 길이 제한에 대비해 storeId·channelKey·수단만 전달.
    // 모바일(리디렉션): issueName·issueId·customer·offerPeriod 유지.
    const response = await PortOne.requestIssueBillingKey({
      storeId,
      channelKey,
      billingKeyMethod: BillingKeyMethod.CARD,
      ...(mobile
        ? {
            issueName: sdkIssueName(),
            issueId: shortAsciiIssueId(),
            customer: buildSdkCustomer(request),
          }
        : {}),
      ...mobileOnly,
    })

    if (!response) {
      return {
        success: false,
        error: {
          message:
            '카드 등록 응답이 없습니다. 모바일은 결제 창 종료 후 이 페이지로 돌아오는지 확인해 주세요.',
        },
      }
    }

    const failCode =
      typeof (response as { code?: unknown }).code === 'string'
        ? (response as { code: string }).code.trim()
        : ''
    if (failCode) {
      const errResp = response as {
        code?: string
        message?: string
        pgMessage?: string
      }
      return {
        success: false,
        error: {
          code: errResp.code,
          message: errResp.message ?? '카드 등록에 실패했습니다.',
          pgMessage: errResp.pgMessage,
        },
      }
    }

    const billingKeyVal = (response as { billingKey?: string }).billingKey
    if (!billingKeyVal) {
      const errResp = response as { message?: string }
      return {
        success: false,
        error: {
          message: errResp.message ?? '빌링키를 받지 못했습니다.',
        },
      }
    }

    const raw = response as {
      billingKey?: string
      billingIssueToken?: string
    }

    if (raw.billingKey === 'NEEDS_CONFIRMATION' && raw.billingIssueToken) {
      return {
        success: true,
        needsServerConfirm: true,
        billingIssueToken: raw.billingIssueToken,
        billingKey: raw.billingKey,
      }
    }

    return {
      success: true,
      billingKey: raw.billingKey,
    }
  } catch (error) {
    const err = error as Error
    return {
      success: false,
      error: { message: err.message ?? '카드 등록 처리 중 오류가 발생했습니다.' },
    }
  }
}
