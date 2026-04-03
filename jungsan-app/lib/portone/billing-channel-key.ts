function pickFirstChannelKey(candidates: (string | undefined)[]): string {
  for (const v of candidates) {
    const t = v?.trim()
    if (t) return t
  }
  return ''
}

/**
 * 서버 전용(API·cron·빌링 서버). `PORTONE_*`(비공개) env를 읽을 수 있음.
 *
 * 우선순위 — **맨 위가 가장 우선**(국내 정기·빌링키 채널만 넣을 것):
 * 1. PORTONE_BILLING_CHANNEL_KEY_DOMESTIC  ← Vercel Secrets 권장(해외 결제용 NEXT_PUBLIC과 분리)
 * 2. NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY_DOMESTIC
 * 3. PORTONE_BILLING_CHANNEL_KEY
 * 4. NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY
 */
export function getBillingChannelKeyServer(): string {
  return pickFirstChannelKey([
    process.env.PORTONE_BILLING_CHANNEL_KEY_DOMESTIC,
    process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY_DOMESTIC,
    process.env.PORTONE_BILLING_CHANNEL_KEY,
    process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY,
  ])
}

/**
 * 클라이언트 번들에는 비공개 PORTONE_* 가 없음. 폴백·테스트용만 사용.
 * 실제 빌링키 호출은 GET /api/billing/issue-config 가 서버 우선순위를 반환함.
 */
export function getBillingChannelKey(): string {
  return pickFirstChannelKey([
    process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY_DOMESTIC,
    process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY,
  ])
}
