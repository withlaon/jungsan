/**
 * 포트원 V2 — requestIssueBillingKey 리디렉션 복귀 시 URL 쿼리 파싱
 * (모바일 등에서 redirectUrl로 돌아올 때 Promise 대신 쿼리로 결과가 전달됨)
 */

export type BillingIssueReturn =
  | { status: 'success'; billingKey: string; billingIssueToken?: string }
  | {
      status: 'error'
      code?: string
      message?: string
      pgCode?: string
      pgMessage?: string
    }

/** 구독 페이지 등에서 PortOne이 붙인 빌링키 발급 관련 쿼리만 추려 파싱 */
export function parseBillingIssueReturnFromSearchParams(
  sp: URLSearchParams
): BillingIssueReturn | null {
  const billingIssueFlag = sp.get('billing_issue') === '1'

  const billingKey =
    sp.get('billing_key')?.trim() ||
    sp.get('billingKey')?.trim() ||
    ''

  const billingIssueToken =
    sp.get('billing_issue_token')?.trim() ||
    sp.get('billingIssueToken')?.trim() ||
    ''

  const code =
    sp.get('code')?.trim() ||
    sp.get('error_code')?.trim() ||
    ''

  const message =
    sp.get('message')?.trim() ||
    sp.get('error_msg')?.trim() ||
    ''

  const pgCode = sp.get('pg_code')?.trim() || sp.get('pgCode')?.trim() || ''

  const pgMessage =
    sp.get('pg_message')?.trim() || sp.get('pgMessage')?.trim() || ''

  const txType = sp.get('transaction_type')?.trim() || sp.get('transactionType')?.trim() || ''

  const looksLikeBillingReturn =
    billingIssueFlag ||
    billingKey !== '' ||
    billingIssueToken !== '' ||
    txType === 'ISSUE_BILLING_KEY'

  if (!looksLikeBillingReturn) return null

  if (code) {
    return {
      status: 'error',
      code: code || undefined,
      message: message || undefined,
      pgCode: pgCode || undefined,
      pgMessage: pgMessage || undefined,
    }
  }

  if (billingKey === 'NEEDS_CONFIRMATION') {
    if (billingIssueToken) {
      return {
        status: 'success',
        billingKey: 'NEEDS_CONFIRMATION',
        billingIssueToken,
      }
    }
    return {
      status: 'error',
      message:
        '빌링키 수동 승인이 필요하지만 토큰이 없습니다. 포트원 콘솔에서 수동 승인 설정을 확인해 주세요.',
    }
  }

  if (billingKey) {
    return { status: 'success', billingKey }
  }

  if (billingIssueToken) {
    return {
      status: 'success',
      billingKey: 'NEEDS_CONFIRMATION',
      billingIssueToken,
    }
  }

  return null
}

export function stripBillingIssueQueryParams(url: URL): string {
  const keys = [
    'billing_issue',
    'billing_key',
    'billingKey',
    'billing_issue_token',
    'billingIssueToken',
    'transaction_type',
    'transactionType',
    'issue_id',
    'issueId',
    'code',
    'error_code',
    'message',
    'error_msg',
    'pg_code',
    'pgCode',
    'pg_message',
    'pgMessage',
  ]
  const sp = url.searchParams
  for (const k of keys) {
    sp.delete(k)
  }
  const q = sp.toString()
  return q ? `${url.pathname}?${q}` : url.pathname
}
