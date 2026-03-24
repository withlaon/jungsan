'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser, getCachedUser } from '@/hooks/useUser'
import { WeeklySettlement } from '@/types'

// ─── 정산 목록 모듈 캐시 ──────────────────────────────────────────────────
let _listCache: WeeklySettlement[] | null = null
let _listPromise: Promise<WeeklySettlement[]> | null = null
let _listLastFetched = 0
const _listListeners = new Set<(data: WeeklySettlement[]) => void>()

const LIST_STALE_MS = 30_000

function broadcastList(data: WeeklySettlement[]) {
  _listListeners.forEach(fn => fn(data))
}

/**
 * userId/isAdmin을 인자로 받아 settlements를 로드합니다.
 * getCachedUser()를 먼저 시도해 불필요한 네트워크 호출을 방지합니다.
 */
async function loadSettlements(
  userId: string | null,
  isAdmin: boolean,
  force = false,
): Promise<WeeklySettlement[]> {
  if (!userId && !isAdmin) return []
  if (force) { _listCache = null; _listPromise = null }
  if (_listPromise) return _listPromise

  _listPromise = (async () => {
    try {
      const supabase = createClient()
      let q = supabase
        .from('weekly_settlements')
        .select('*')
        .order('week_start', { ascending: false })
      if (!isAdmin && userId) q = q.eq('user_id', userId)

      const { data, error } = await q
      if (error) throw error

      const result = data ?? []
      _listCache = result
      _listLastFetched = Date.now()
      broadcastList(result)
      return result
    } catch (e) {
      console.error('[useSettlements] 로드 실패:', e)
      // 기존 캐시가 있으면 유지, 없으면 빈 배열
      if (_listCache) broadcastList(_listCache)
      return _listCache ?? []
    }
  })().finally(() => { _listPromise = null })

  return _listPromise
}

/** CRUD 후 목록 강제 갱신 */
export async function revalidateSettlements(): Promise<WeeklySettlement[]> {
  const cached = getCachedUser()
  return loadSettlements(cached?.userId ?? null, cached?.isAdmin ?? false, true)
}

/** 특정 정산 ID를 목록에서 제거 (삭제 직후 낙관적 UI) */
export function removeSettlementFromCache(id: string) {
  if (!_listCache) return
  _listCache = _listCache.filter(s => s.id !== id)
  _listLastFetched = Date.now()
  broadcastList(_listCache)
}

/** 정산 상태 업데이트 (확정 등 낙관적 UI) */
export function updateSettlementInCache(updated: WeeklySettlement) {
  if (!_listCache) return
  _listCache = _listCache.map(s => s.id === updated.id ? updated : s)
  _listLastFetched = Date.now()
  broadcastList(_listCache)
}

export function useSettlements() {
  // useUser를 통해 인증 완료 시점을 파악
  const { userId, isAdmin, loading: userLoading } = useUser()
  const [settlements, setSettlements] = useState<WeeklySettlement[]>(_listCache ?? [])
  // 캐시가 있으면 즉시 false (탭 이동 시 로딩 스켈레톤 방지)
  const [loading, setLoading] = useState(!_listCache)

  useEffect(() => {
    _listListeners.add(setSettlements)
    return () => { _listListeners.delete(setSettlements) }
  }, [])

  useEffect(() => {
    // 유저 정보 로드 완료 후 실행
    if (userLoading) return

    if (_listCache) {
      setSettlements(_listCache)
      setLoading(false)
      // 오래된 캐시면 백그라운드 갱신
      if (Date.now() - _listLastFetched > LIST_STALE_MS) {
        loadSettlements(userId, isAdmin)
      }
    } else {
      setLoading(true)
      loadSettlements(userId, isAdmin)
        .then(() => setLoading(false))
        .catch(() => setLoading(false))  // 에러 시에도 반드시 loading 해제
    }
  }, [userId, isAdmin, userLoading])

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    await revalidateSettlements()
    if (!silent) setLoading(false)
  }, [])

  return { settlements, loading, refresh }
}
