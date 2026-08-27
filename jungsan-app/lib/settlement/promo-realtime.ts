/**
 * promotions 테이블 데이터로 콜/일반 프로모션 금액을 실시간 계산
 * settlement_details의 call_promotion_amount / general_promotion_amount 컬럼에
 * 데이터가 없거나 구버전 데이터인 경우에도 올바른 값을 반환
 */

export type PromoRow = {
  id: string
  type: 'global' | 'individual'
  promo_kind: 'fixed' | 'range' | 'per_count'
  rider_id: string | null
  amount: number
  ranges: { min_count: number; max_count: number | null; amount: number }[] | null
  per_count_min: number | null
  date_mode: 'week' | 'deadline' | 'none'
  week_start: string | null
  deadline_date: string | null
  is_call_promo: boolean
}

export const PROMO_SELECT =
  'id, type, promo_kind, rider_id, amount, ranges, per_count_min, date_mode, week_start, deadline_date, is_call_promo'

function calcOnePromo(p: PromoRow, deliveryCount: number): number {
  if (p.promo_kind === 'fixed') return p.amount
  if (p.promo_kind === 'per_count' && p.per_count_min !== null)
    return Math.max(0, deliveryCount - p.per_count_min) * p.amount
  if (p.promo_kind === 'range' && p.ranges) {
    const r = p.ranges.find(
      (r) =>
        deliveryCount >= r.min_count &&
        (r.max_count === null || deliveryCount <= r.max_count),
    )
    return r?.amount ?? 0
  }
  return 0
}

/**
 * 특정 라이더에 대해 프로모션 목록에서 콜/일반 금액을 계산
 * @param promoList   promotions 테이블 전체 (settlement_id IS NULL 필터 후)
 * @param riderId     계산 대상 라이더 ID
 * @param deliveryCount 배달 건수
 * @param weekStart   해당 주차 시작일 (YYYY-MM-DD)
 */
export function calcPromoSplit(
  promoList: PromoRow[],
  riderId: string | null | undefined,
  deliveryCount: number,
  weekStart: string,
): { call: number; gen: number } {
  if (!promoList.length) return { call: 0, gen: 0 }

  let call = 0,
    gen = 0
  for (const p of promoList) {
    if (p.date_mode === 'week' && p.week_start !== weekStart) continue
    if (
      p.date_mode === 'deadline' &&
      p.deadline_date &&
      p.deadline_date < weekStart
    )
      continue

    const applies =
      (p.type === 'global' &&
        (p.rider_id === null || p.rider_id === riderId)) ||
      (p.type === 'individual' && p.rider_id === riderId)
    if (!applies) continue

    const amt = calcOnePromo(p, deliveryCount)
    if (p.is_call_promo) call += amt
    else gen += amt
  }
  return { call, gen }
}
