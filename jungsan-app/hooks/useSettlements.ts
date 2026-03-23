'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { WeeklySettlement } from '@/types'

// ─── 정산 목록 캐시 ───────────────────────────────────────────────────────
let _listCache: WeeklySettlement[] | null = null
let _listPromise: Promise<WeeklySettlement[]> | null = null
let _listLastFetched = 0
const _listListeners = new Set<(data: WeeklySettlement[]) => void>()

// ─── 정산 상세 캐시 (settlement_id → 상세 배열) ───────────────────────────
const _detailCache = new Map<string, unknown[]>()
const _detailPromises = new Map<string, Promise<unknown[]>>()

const LIST_STALE_MS = 30_000  // 30초 이상 지나면 백그라운드 재검증
const DETAIL_STALE_MS = 60_000
const _detailFetched = new Map<string, number>()

function broadcastList(data: WeeklySettlement[]) {
  _listListeners.forEach(fn => fn(data))
}

async function loadSettlements(force = false): Promise<WeeklySettlement[]> {
  if (force) { _listCache = null; _listPromise = null }
  if (_listPromise) return _listPromise

  _listPromise = (async () => {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    const isAdmin = profile?.username?.toLowerCase() === 'admin'

    let q = supabase
      .from('weekly_settlements')
      .select('*')
      .order('week_start', { ascending: false })
    if (!isAdmin) q = q.eq('user_id', user.id)

    const { data } = await q
    const result = data ?? []
    _listCache = result
    _listLastFetched = Date.now()
    broadcastList(result)
    return result
  })().finally(() => { _listPromise = null })

  return _listPromise
}

async function loadSettlementDetails<T>(
  settlementId: string,
  queryFn: (supabase: ReturnType<typeof createClient>) => Promise<T[]>,
  force = false,
): Promise<T[]> {
  if (force) {
    _detailCache.delete(settlementId)
    _detailPromises.delete(settlementId)
    _detailFetched.delete(settlementId)
  }

  const cached = _detailCache.get(settlementId)
  if (cached && !force) return cached as T[]

  const existing = _detailPromises.get(settlementId)
  if (existing) return existing as Promise<T[]>

  const supabase = createClient()
  const promise = queryFn(supabase).then(result => {
    _detailCache.set(settlementId, result as unknown[])
    _detailFetched.set(settlementId, Date.now())
    _detailPromises.delete(settlementId)
    return result
  })
  _detailPromises.set(settlementId, promise as Promise<unknown[]>)
  return promise
}

/** 정산 목록 강제 갱신 */
export async function revalidateSettlements(): Promise<WeeklySettlement[]> {
  return loadSettlements(true)
}

/** 특정 정산 상세 캐시 무효화 */
export function invalidateSettlementDetail(settlementId: string) {
  _detailCache.delete(settlementId)
  _detailPromises.delete(settlementId)
  _detailFetched.delete(settlementId)
}

/** 모든 상세 캐시 무효화 */
export function invalidateAllSettlementDetails() {
  _detailCache.clear()
  _detailPromises.clear()
  _detailFetched.clear()
}

/** 정산 목록 캐시 직접 업데이트 (삭제/확정 후 낙관적 업데이트) */
export function applyOptimisticSettlement(
  settlement: WeeklySettlement,
  action: 'update' | 'remove',
) {
  if (!_listCache) return
  if (action === 'update') {
    _listCache = _listCache.map(s => s.id === settlement.id ? settlement : s)
  } else {
    _listCache = _listCache.filter(s => s.id !== settlement.id)
  }
  _listLastFetched = Date.now()
  broadcastList(_listCache)
}

export function useSettlements() {
  const [settlements, setSettlements] = useState<WeeklySettlement[]>(_listCache ?? [])
  const [loading, setLoading] = useState(!_listCache)

  useEffect(() => {
    _listListeners.add(setSettlements)

    if (_listCache) {
      setSettlements(_listCache)
      setLoading(false)
      if (Date.now() - _listLastFetched > LIST_STALE_MS) {
        loadSettlements().then(() => setLoading(false))
      }
    } else {
      setLoading(true)
      loadSettlements().then(() => setLoading(false))
    }

    return () => { _listListeners.delete(setSettlements) }
  }, [])

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    await revalidateSettlements()
    if (!silent) setLoading(false)
  }, [])

  return { settlements, loading, refresh }
}

/** 정산 상세 데이터를 캐시하며 가져오는 훅 */
export function useSettlementDetails<T>(
  settlementId: string | null,
  queryFn: (supabase: ReturnType<typeof createClient>) => Promise<T[]>,
) {
  const [details, setDetails] = useState<T[]>(() => {
    if (settlementId) return (_detailCache.get(settlementId) as T[] | undefined) ?? []
    return []
  })
  const [loading, setLoading] = useState(
    !!settlementId && !_detailCache.has(settlementId ?? '')
  )

  useEffect(() => {
    if (!settlementId) { setDetails([]); setLoading(false); return }

    const cached = _detailCache.get(settlementId) as T[] | undefined
    const fetchedAt = _detailFetched.get(settlementId) ?? 0

    if (cached) {
      setDetails(cached)
      setLoading(false)
      if (Date.now() - fetchedAt > DETAIL_STALE_MS) {
        loadSettlementDetails(settlementId, queryFn, true).then(data => setDetails(data as T[]))
      }
    } else {
      setLoading(true)
      loadSettlementDetails(settlementId, queryFn).then(data => {
        setDetails(data as T[])
        setLoading(false)
      })
    }
  // queryFn은 안정적인 함수 참조를 넘겨야 함 (useCallback 또는 컴포넌트 외부에서 정의)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementId])

  const refresh = useCallback(async () => {
    if (!settlementId) return
    setLoading(true)
    const data = await loadSettlementDetails(settlementId, queryFn, true)
    setDetails(data as T[])
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settlementId])

  return { details, loading, refresh }
}
