/**
 * 구독 해지 시 남은 서비스 이용 종료 시각 계산
 */
export function computeSubscriptionAccessUntilIso(
  now: Date,
  status: string,
  trialEndsAtIso: string,
  currentPeriodEndIso: string | null | undefined
): string {
  const trialEnd = new Date(trialEndsAtIso)
  const periodEnd = currentPeriodEndIso ? new Date(currentPeriodEndIso) : null

  if (status === 'active' && periodEnd && periodEnd.getTime() > now.getTime()) {
    return periodEnd.toISOString()
  }

  if (trialEnd.getTime() > now.getTime()) {
    return trialEnd.toISOString()
  }

  if (periodEnd && periodEnd.getTime() > now.getTime()) {
    return periodEnd.toISOString()
  }

  return now.toISOString()
}
