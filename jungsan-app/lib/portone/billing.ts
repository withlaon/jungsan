'use client'

/**
 * 포트원 V2 — 결제창 빌링키 발급 (`PortOne.requestIssueBillingKey`)
 *
 * @see https://developers.portone.io/opi/ko/integration/start/v2/billing/issue?v=v2
 * 공식 예시는 **storeId · channelKey · billingKeyMethod** 만 전달합니다.
 * 추가 필드(고객 정보·issueId·금액 등)가 일부 KCP 빌링 채널에서 PG 전문 길이 오류를 유발할 수 있어
 * PC/데스크톱에서는 이 3가지만 보냅니다.
 *
 * 모바일(리디렉션)은 포트원·KCP 요구에 따라 `windowType`·`redirectUrl`·`offerPeriod` 만 덧붙입니다.
 *
 * [이후 단계] POST /api/billing/issue → chargeBillingKey(월 청구)
 */

import PortOne, { BillingKeyMethod, WindowType } from '@portone/browser-sdk/v2'

export const SUBSCRIPTION_AMOUNT = 20_000
export const TRIAL_DAYS = 30

/** @deprecated 빌링키 발급 요청에 더 이상 사용하지 않음(문서 최소 스펙). 프로필 검증용으로만 유지 가능 */
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

/** 프로필 정리용(선택). PG로 전달하지 않습니다. */
export function normalizeKcpPhone(phone?: string): string | undefined {
  const trimmed = phone?.trim()
  if (!trimmed) return undefined
  const digits = trimmed.replace(/\D/g, '')
  if (digits.length < 10 || digits.length > 15) return undefined
  return digits
}

/** 프로필 가이드용 — 카드 등록 버튼을 막지 않습니다. */
export function getKcpBillingCustomerGaps(request: IssueBillingKeyRequest): Array<
  'realName' | 'phone' | 'email'
> {
  const gaps: Array<'realName' | 'phone' | 'email'> = []
  if (!request.customerName?.trim()) gaps.push('realName')
  if (!normalizeKcpPhone(request.customerPhone)) gaps.push('phone')
  if (!request.customerEmail?.trim()) gaps.push('email')
  return gaps
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

/**
 * 포트원 문서와 동일한 최소 호출 + 모바일 시 리디렉션·정기구간만 추가
 * @see https://developers.portone.io/opi/ko/integration/start/v2/billing/issue?v=v2
 */
export async function requestIssueBillingKey(): Promise<IssueBillingKeyResult> {
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

  const base = {
    storeId,
    channelKey,
    billingKeyMethod: BillingKeyMethod.CARD,
  } as const

  const mobileOnly =
    mobile && redirectUrl
      ? {
          windowType: {
            pc: WindowType.IFRAME,
            mobile: WindowType.REDIRECTION,
          },
          redirectUrl,
          /** 모바일 빌링키 발급: 문서상 offerPeriod 필수 */
          offerPeriod: { interval: '1m' as const },
        }
      : {}

  try {
    const response = await PortOne.requestIssueBillingKey({
      ...base,
      ...mobileOnly,
    })

    if (!response || 'code' in response) {
      const errResp = response as {
        code?: string
        message?: string
        pgMessage?: string
      } | null
      return {
        success: false,
        error: {
          code: errResp?.code,
          message: errResp?.message ?? '카드 등록에 실패했습니다.',
          pgMessage: errResp?.pgMessage,
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
