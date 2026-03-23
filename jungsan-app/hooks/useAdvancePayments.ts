'use client'

import { useState, useEffect, useCallback } from 'react'
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

async function loadPayments(force = false): Promise<PaymentWithRider[]> {
  if (force) { _cache = null; _promise = null }
  if (_promise) return _promise

  _promise = (async () => {
    const { createClient } = await import('@/lib/supabase/client')
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
      .from('advance_payments')
      .select('*, riders(*)')
      .order('paid_date', { ascending: false })
    if (!isAdmin) q = q.eq('user_id', user.id)

    const { data } = await q
    const result = (data ?? []) as PaymentWithRider[]
    _cache = result
    _lastFetched = Date.now()
    broadcast(result)
    return result
  })().finally(() => { _promise = null })

  return _promise
}

export async function revalidatePayments(): Promise<PaymentWithRider[]> {
  return loadPayments(true)
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
  const [payments, setPayments] = useState<PaymentWithRider[]>(_cache ?? [])
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    _listeners.add(setPayments)

    if (_cache) {
      setPayments(_cache)
      setLoading(false)
      if (Date.now() - _lastFetched > STALE_MS) {
        loadPayments().then(() => setLoading(false))
      }
    } else {
      setLoading(true)
      loadPayments().then(() => setLoading(false))
    }

    return () => { _listeners.delete(setPayments) }
  }, [])

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    await revalidatePayments()
    if (!silent) setLoading(false)
  }, [])

  return { payments, loading, refresh }
}
