'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser, getCachedUser } from '@/hooks/useUser'
import { AdvancePayment, Rider } from '@/types'

export type PaymentWithRider = AdvancePayment & { riders: Rider }

let _cache: PaymentWithRider[] | null = null
let _promise: Promise<PaymentWithRider[]> | null = null
let _lastFetched = 0
const _listeners = new Set<(data: PaymentWithRider[]) => void>()

const STALE_MS = 30_000

function broadcast(data: PaymentWithRider[]) {
  _listeners.forEach(fn => fn(data))
}

async function loadPayments(
  userId: string | null,
  isAdmin: boolean,
  force = false,
): Promise<PaymentWithRider[]> {
  if (!userId && !isAdmin) return []
  if (force) { _cache = null; _promise = null }
  if (_promise) return _promise

  _promise = (async () => {
    try {
      const supabase = createClient()
      let q = supabase
        .from('advance_payments')
        .select('*, riders(*)')
        .order('paid_date', { ascending: false })
      if (!isAdmin && userId) q = q.eq('user_id', userId)

      const { data, error } = await q
      if (error) throw error

      const result = (data ?? []) as PaymentWithRider[]
      _cache = result
      _lastFetched = Date.now()
      broadcast(result)
      return result
    } catch (e) {
      console.error('[useAdvancePayments] 로드 실패:', e)
      if (_cache) broadcast(_cache)
      return _cache ?? []
    }
  })().finally(() => { _promise = null })

  return _promise
}

export async function revalidatePayments(): Promise<PaymentWithRider[]> {
  const cached = getCachedUser()
  return loadPayments(cached?.userId ?? null, cached?.isAdmin ?? false, true)
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    _listeners.add(setPayments)
    return () => { _listeners.delete(setPayments) }
  }, [])

  useEffect(() => {
    if (userLoading) return

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
