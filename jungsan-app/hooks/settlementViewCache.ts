/**
 * 대시보드·정산결과 등에서 settlement_details 기반 조회 결과를
 * 탭 이동 시 재사용하기 위한 모듈 캐시.
 * weekly_settlements 목록이 강제 갱신(force)될 때 비웁니다.
 */

export type AggDetailRow = {
  settlement_id: string
  promotion_amount: number
  call_fee_deduction: number
  income_tax_deduction: number
  employment_insurance_addition: number
  accident_insurance_addition: number
}

let aggCacheKey = ''
let aggCacheData: AggDetailRow[] = []

function detailsKey(settlementId: string, variant: 'result' | 'dash') {
  return `${variant}:${settlementId}`
}

const detailsCache = new Map<string, unknown[]>()

export function readAggCache(idsSortedKey: string): AggDetailRow[] | null {
  if (!idsSortedKey || idsSortedKey !== aggCacheKey) return null
  return aggCacheData
}

export function writeAggCache(idsSortedKey: string, data: AggDetailRow[]) {
  aggCacheKey = idsSortedKey
  aggCacheData = data
}

export function readDetailsCache<T = unknown>(
  settlementId: string,
  variant: 'result' | 'dash',
): T[] | null {
  if (!settlementId) return null
  const hit = detailsCache.get(detailsKey(settlementId, variant))
  return (hit as T[] | undefined) ?? null
}

export function writeDetailsCache<T = unknown>(
  settlementId: string,
  variant: 'result' | 'dash',
  data: T[],
) {
  if (!settlementId) return
  detailsCache.set(detailsKey(settlementId, variant), data as unknown[])
}

export function deleteDetailsCacheEntry(settlementId: string) {
  detailsCache.delete(detailsKey(settlementId, 'result'))
  detailsCache.delete(detailsKey(settlementId, 'dash'))
}

/** 정산 목록이 바뀌면 집계·상세 캐시 전부 무효화 */
export function invalidateAllSettlementViewCaches() {
  aggCacheKey = ''
  aggCacheData = []
  detailsCache.clear()
}
