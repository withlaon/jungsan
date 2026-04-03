/**
 * 빌링키 발급·정기 청구에 쓰는 포트원 채널 키.
 *
 * - NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY_DOMESTIC: **국내 카드** 정기결제(빌링키) 채널 — 있으면 항상 우선
 * - NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY: 위가 없을 때만 사용
 *
 * 포트원에서 채널 이름이나 결제창에「해외카드」만 보이는 채널은 국내 발급 카드가 [3192] 등으로 거절될 수 있습니다.
 * (해외 전용: VISA, MASTER, JCB, DINERS)
 */
export function getBillingChannelKey(): string {
  const domestic = process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY_DOMESTIC?.trim()
  if (domestic) return domestic
  return process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY?.trim() ?? ''
}
