'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { raceWithTimeout } from '@/lib/fetch-utils'

const QUERY_TIMEOUT_MS = 25_000
import { useUser, getCachedUser } from '@/hooks/useUser'
import { AdvancePayment, Rider } from '@/types'

export type PaymentWithRider = AdvancePayment & { riders: Rider }

let _cache: PaymentWithRider[] | null = null
let _promise: Promise<PaymentWithRider[]> | null = null
let _lastFetched = 0
const _listeners = new Set<(data: PaymentWithRider[]) => void>()

const STALE_MS = 60_000   // 1분

function broadcast(data: PaymentWithRider[]) {
  _listeners.forEach(fn => fn(data))
}

async function loadPayments(
  userId: string | null,
  isAdmin: boolean,
  force = false,
): Promise<PaymentWithRider[]> {
  if (!userId && !isAdmin) return []
  // force: _cache는 null로 만들지 않음 → 탭 이동 시 기존 데이터 유지해 로딩 freeze 방지
  if (force) { _promise = null }
  if (_promise) return _promise

  _promise = (async () => {
    try {
      const supabase = createClient()
      let q = supabase
        .from('advance_payments')
        .select('*, riders(*)')
        .order('paid_date', { ascending: false })
      if (userId) q = q.eq('user_id', userId)

      const { data, error } = await raceWithTimeout(
        (async () => await q)(),
        QUERY_TIMEOUT_MS,
        'advance_payments_query_timeout'
      )
      if (error) throw error

      const result = (data ?? []) as PaymentWithRider[]
      _cache = result
      _lastFetched = Date.now()
      broadcast(result)
      return result
    } catch (e) {
      console.error('[useAdvancePayments] 로드 실패:', e)
      // 캐시가 있으면 캐시 유지, 없으면 빈 배열로 broadcast (로딩 영구 freeze 방지)
      const fallback = _cache ?? []
      broadcast(fallback)
      return fallback
    }
  })().finally(() => { _promise = null })

  return _promise
}

export async function revalidatePayments(): Promise<PaymentWithRider[]> {
  const cached = getCachedUser()
  return loadPayments(cached?.userId ?? null, cached?.isAdmin ?? false, true)
}

/**
 * 로그인 직후 userId를 이용해 advance payments를 백그라운드 프리페치합니다.
 * 이미 캐시나 진행 중인 요청이 있으면 무시합니다.
 */
export function prefetchPaymentsForUser(userId: string): void {
  if (_cache || _promise) return
  loadPayments(userId, false).catch(() => {})
}

export function applyOptimisticPayment(
  payment: PaymentWithRider,
  action: 'add' | 'remove',
) {
  if (!_cache) return
  if (action === 'add') {
    _cache = [payment, ..._cache]
  } else {
    _cache = _cache.filter(p => p.id !== payment.id)
  }
  _lastFetched = Date.now()
  broadcast(_cache)
}

export function useAdvancePayments() {
  const { userId, isAdmin, loading: userLoading } = useUser()
  const [payments, setPayments] = useState<PaymentWithRider[]>(_cache ?? [])
  // 캐시가 있으면 즉시 false (탭 이동 시 로딩 스켈레톤 방지)
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    _listeners.add(setPayments)
    return () => { _listeners.delete(setPayments) }
  }, [])

  useEffect(() => {
    if (userLoading) return
    // userId 미확정(로그인 직후 일시적 null) 상태에서는 빈 배열로 종료하지 않음
    if (!userId && !isAdmin) return

    if (_cache) {
      setPayments(_cache)
      setLoading(false)
      if (Date.now() - _lastFetched > STALE_MS) {
        loadPayments(userId, isAdmin)
      }
    } else {
      setLoading(true)
      loadPayments(userId, isAdmin)
        .then(() => setLoading(false))
        .catch(() => setLoading(false))
    }
  }, [userId, isAdmin, userLoading])

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    await revalidatePayments()
    if (!silent) setLoading(false)
  }, [])

  return { payments, loading, refresh }
}
