'use client'

/**
 * 포트원 V2 브라우저 SDK — 빌링키 발급
 *
 * 올바른 함수명은 **`PortOne.requestIssueBillingKey`** 입니다.
 * (`requestBillingKey` 는 @portone/browser-sdk/v2 에 존재하지 않습니다.)
 *
 * **팝업/결제창**: 클릭 후 `await fetch` 등으로 마이크로태스크가 끊기면 user activation이 만료되어
 * 결제창이 안 열리고 무한 대기처럼 보일 수 있습니다. 구독 UI에서는 `loadBillingIssueConfig`로
 * 설정을 미리 받은 뒤 `requestIssueBillingKeyWithConfig`를 클릭 핸들러에서 곧바로 호출하세요.
 *
 * @see https://developers.portone.io/opi/ko/integration/start/v2/billing/issue?v=v2
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

/** `/api/billing/issue-config` 성공 시 그대로 사용 */
export type BillingIssueConfig = {
  storeId: string
  channelKey: string
  apiSecretConfigured: boolean
}

export type LoadBillingIssueConfigResult =
  | { ok: true; config: BillingIssueConfig }
  | { ok: false; error: NonNullable<IssueBillingKeyResult['error']> }

/** 결제창 열기 전에 미리 호출 (다이얼로그 오픈 시 등) */
export async function loadBillingIssueConfig(): Promise<LoadBillingIssueConfigResult> {
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
        ok: false,
        error: {
          message:
            typeof cfgJson.error === 'string'
              ? cfgJson.error
              : `빌링 설정을 불러오지 못했습니다. (${cfgRes.status})`,
        },
      }
    }

    const storeId = cfgJson.storeId?.trim() ?? ''
    const channelKey = cfgJson.channelKey?.trim() ?? ''
    if (!storeId || !channelKey) {
      return {
        ok: false,
        error: { message: '포트원 상점 또는 빌링 채널 정보가 비어 있습니다.' },
      }
    }
    if (cfgJson.apiSecretConfigured === false) {
      return {
        ok: false,
        error: {
          message:
            '서버에 PORTONE_API_SECRET(V2 API Secret)이 없어 카드 등록 후 처리가 불완전할 수 있습니다. ' +
            'Vercel/서버 환경변수를 설정한 뒤 다시 시도해 주세요.',
        },
      }
    }

    return {
      ok: true,
      config: {
        storeId,
        channelKey,
        apiSecretConfigured: true,
      },
    }
  } catch {
    return {
      ok: false,
      error: { message: '빌링 채널 설정 조회 중 네트워크 오류가 발생했습니다.' },
    }
  }
}

/** KCP·포트원 권장: 휴대폰은 숫자만 */
export function normalizeKcpPhone(phone?: string): string | undefined {
  const trimmed = phone?.trim()
  if (!trimmed) return undefined
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return undefined
  return digits
}

/**
 * 국내 휴대폰(010 등) — KCP 정기결제에 맞게 자리수 검사
 * 010으로 시작하면 11자리여야 합니다.
 */
export function isValidKrMobileForBilling(phone: string): boolean {
  const d = normalizeKcpPhone(phone)
  if (!d) return false
  if (d.startsWith('010')) return d.length === 11
  if (d.startsWith('01')) return d.length >= 10 && d.length <= 11
  return d.length >= 10 && d.length <= 15
}

export function getKcpBillingCustomerGaps(request: IssueBillingKeyRequest): Array<
  'realName' | 'phone' | 'email'
> {
  const gaps: Array<'realName' | 'phone' | 'email'> = []
  if (!request.customerName?.trim()) gaps.push('realName')
  if (!isValidKrMobileForBilling(request.customerPhone ?? '')) gaps.push('phone')
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

function shortAsciiIssueId(): string {
  const raw = `${Date.now()}${Math.floor(Math.random() * 1_000)}`
  return raw.replace(/\D/g, '').slice(-12).padStart(12, '0')
}

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
  const name = truncateUtf8Bytes('정산타임 구독 카드', 28)
  return name || 'Card registration'
}

function interpretIssueBillingKeySdkResponse(
  response:
    | {
        billingKey?: string
        billingIssueToken?: string
        code?: string
        message?: string
        pgMessage?: string
      }
    | null
    | undefined,
): IssueBillingKeyResult {
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
    typeof response.code === 'string' ? response.code.trim() : ''
  if (failCode) {
    return {
      success: false,
      error: {
        code: response.code,
        message: response.message ?? '카드 등록에 실패했습니다.',
        pgMessage: response.pgMessage,
      },
    }
  }

  const billingKeyVal = response.billingKey
  if (!billingKeyVal) {
    return {
      success: false,
      error: {
        message: response.message ?? '빌링키를 받지 못했습니다.',
      },
    }
  }

  if (billingKeyVal === 'NEEDS_CONFIRMATION' && response.billingIssueToken) {
    return {
      success: true,
      needsServerConfirm: true,
      billingIssueToken: response.billingIssueToken,
      billingKey: billingKeyVal,
    }
  }

  return {
    success: true,
    billingKey: billingKeyVal,
  }
}

/**
 * 이미 로드한 설정으로 빌링키 발급만 수행.
 * **클릭 이벤트에서 `await fetch` 없이 곧바로 호출**할 수 있게 하려고 분리했습니다.
 */
export async function requestIssueBillingKeyWithConfig(
  config: BillingIssueConfig,
  request: IssueBillingKeyRequest,
): Promise<IssueBillingKeyResult> {
  if (!config.storeId?.trim() || !config.channelKey?.trim()) {
    return {
      success: false,
      error: { message: '포트원 상점 또는 빌링 채널 정보가 비어 있습니다.' },
    }
  }
  if (config.apiSecretConfigured === false) {
    return {
      success: false,
      error: {
        message:
          '서버에 PORTONE_API_SECRET(V2 API Secret)이 없어 카드 등록 후 처리가 불완전할 수 있습니다.',
      },
    }
  }

  const storeId = config.storeId.trim()
  const channelKey = config.channelKey.trim()
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
    const response = await PortOne.requestIssueBillingKey({
      storeId,
      channelKey,
      billingKeyMethod: BillingKeyMethod.CARD,
      issueName: sdkIssueName(),
      issueId: shortAsciiIssueId(),
      customer: buildSdkCustomer(request),
      ...mobileOnly,
    })
    return interpretIssueBillingKeySdkResponse(
      response as {
        billingKey?: string
        billingIssueToken?: string
        code?: string
        message?: string
        pgMessage?: string
      },
    )
  } catch (error) {
    const err = error as Error
    return {
      success: false,
      error: { message: err.message ?? '카드 등록 처리 중 오류가 발생했습니다.' },
    }
  }
}

export async function requestIssueBillingKey(
  request: IssueBillingKeyRequest,
): Promise<IssueBillingKeyResult> {
  const loaded = await loadBillingIssueConfig()
  if (!loaded.ok) {
    return { success: false, error: loaded.error }
  }
  return requestIssueBillingKeyWithConfig(loaded.config, request)
}
