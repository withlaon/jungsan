/**
 * NHN KCP / 포트원 정기·빌링 — 전문 길이·특수문자 제한 (고객지원 가이드 반영)
 * @see https://help.portone.io/content/kcp_channel
 */

export function truncateUtf8Bytes(str: string, maxBytes: number): string {
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

/** buyer_name: 한글·영문·공백만 (숫자·특수문자 제거) */
export function sanitizeKcpPersonName(name: string, maxBytes: number): string {
  const cleaned = name
    .replace(/\d/g, '')
    .replace(/[^\uAC00-\uD7A3a-zA-Z\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  const t = truncateUtf8Bytes(cleaned || 'User', maxBytes)
  return t || 'User'
}

export function sanitizeKcpEmail(email: string, maxBytes: number): string {
  return truncateUtf8Bytes(email.trim(), maxBytes)
}

/** 빌링키 발급 issueName — ASCII 최소 (상품명 전문 길이) */
export function kcpBillingIssueDisplayName(): string {
  return 'SUB'
}

/** 빌링키 발급 issueId (주문번호 유사) — 숫자만, 12자 이내 */
export function kcpBillingIssueMerchantUid(): string {
  const tail = String(Date.now()).replace(/\D/g, '').slice(-10)
  const r = String(Math.floor(Math.random() * 1000)).padStart(3, '0')
  return (tail + r).slice(0, 12)
}

/** 빌링키 결제 주문명 */
export function truncateKcpChargeOrderName(orderName: string, maxBytes = 20): string {
  return truncateUtf8Bytes(orderName.trim(), maxBytes) || 'Sub'
}
