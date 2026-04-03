/**
 * 빌링키 발급·정기 청구에 쓰는 포트원 채널 키.
 *
 * 권장: `NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY_DOMESTIC` 만 설정(국내 카드 정기·빌링 전용 채널 키).
 * 레거시: `NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY` 는 DOMESTIC 이 비어 있을 때만 사용.
 *
 * 해외카드 전용 채널을 넣으면 국내 카드가 [3192] 등으로 거절될 수 있습니다.
 * Vercel 등 배포 환경에도 DOMESTIC 을 동일 이름으로 넣어야 합니다(.env.local 은 커밋되지 않음).
 */
export function getBillingChannelKey(): string {
  const domestic = process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY_DOMESTIC?.trim()
  if (domestic) return domestic
  return process.env.NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY?.trim() ?? ''
}
