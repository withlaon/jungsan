/**
 * Heal subscriptions: trust PortOne GET /payments/:id over local DB rows.
 * Covers: wrong payments.status, missing payments rows, last_payment_id mismatch.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PortOnePaymentResponse } from '@/lib/portone/server'
import { getPayment } from '@/lib/portone/server'
import { savePayment } from '@/lib/portone/db'
import { isPaidPortOneStatus } from '@/lib/portone/payment-normalize'
import {
  SUBSCRIPTION_CHARGE_AMOUNT,
  SUBSCRIPTION_ORDER_NAME,
} from '@/lib/portone/subscription-charge'
import { listRecentPaymentIds } from '@/lib/portone/payments-list'

export function subscriptionPaymentIdUserPrefix(paymentId: string): string | null {
  const m = paymentId.match(/^sub-([0-9a-f]{8})-/i)
  return m ? m[1].toLowerCase() : null
}

export async function resolveUserIdBySubscriptionPaymentPrefix(
  admin: SupabaseClient,
  paymentId: string,
): Promise<string | null> {
  const prefix = subscriptionPaymentIdUserPrefix(paymentId)
  if (!prefix) return null

  const { data: rpcData, error: rpcError } = await admin.rpc('profile_id_for_sub_merchant_uid', {
    payment_id: paymentId,
  })
  if (!rpcError && rpcData) {
    return String(rpcData)
  }

  const { data, error } = await admin
    .from('profiles')
    .select('id')
    .like('id', `${prefix}-%`)
    .limit(2)

  if (error || !data?.length) return null
  if (data.length !== 1) return null
  return String(data[0].id)
}

function addOneMonth(isoStart: string): string {
  const d = new Date(isoStart)
  d.setMonth(d.getMonth() + 1)
  return d.toISOString()
}

function paymentAmountMatches(payment: PortOnePaymentResponse): boolean {
  const total = payment.amount?.total
  if (typeof total === 'number' && total === SUBSCRIPTION_CHARGE_AMOUNT) return true
  return false
}

function orderLooksLikeSubscription(payment: PortOnePaymentResponse): boolean {
  const name = payment.orderName ?? ''
  return name === SUBSCRIPTION_ORDER_NAME || name.includes('정산타임')
}

type SubscriptionRow = {
  status: string
  failed_count: number | null
  billing_key: string | null
  last_payment_id?: string | null
}

async function healFromPaidPortOnePayment(
  admin: SupabaseClient,
  userId: string,
  live: PortOnePaymentResponse,
): Promise<void> {
  const periodStartIso = live.paidAt ?? new Date().toISOString()
  const periodStart = new Date(periodStartIso)
  const nextBillingAt = new Date(periodStart)
  nextBillingAt.setMonth(nextBillingAt.getMonth() + 1)
  const periodEnd = new Date(periodStart)
  periodEnd.setMonth(periodEnd.getMonth() + 1)

  await admin
    .from('subscriptions')
    .update({
      status: 'active',
      failed_count: 0,
      last_payment_id: live.id,
      last_payment_at: periodStartIso,
      current_period_start: periodStart.toISOString(),
      current_period_end: periodEnd.toISOString(),
      next_billing_at: nextBillingAt.toISOString(),
    })
    .eq('user_id', userId)

  const isTest = process.env.NODE_ENV !== 'production'
  await savePayment(live, { userId, isTest })
}

function liveQualifiesForHeal(live: PortOnePaymentResponse): boolean {
  if (!isPaidPortOneStatus(live.status)) return false
  const total = Number(live.amount?.total)
  if (total !== SUBSCRIPTION_CHARGE_AMOUNT) return false
  return paymentAmountMatches(live) || orderLooksLikeSubscription(live)
}

/**
 * If DB shows past_due but PortOne has a paid subscription charge, sync to active.
 */
export async function reconcileSubscriptionIfPortOnePaid(
  admin: SupabaseClient,
  userId: string,
  subscription: SubscriptionRow,
): Promise<boolean> {
  if (subscription.status !== 'past_due') return false
  if (!subscription.billing_key) return false

  const prefix = userId.replace(/-/g, '').slice(0, 8).toLowerCase()
  if (!prefix || prefix.length !== 8) return false

  const tried = new Set<string>()

  const tryPaymentId = async (pid: string, mode: 'strict' | 'trusted'): Promise<boolean> => {
    const p = pid.trim()
    if (!p || tried.has(p)) return false
    if (mode === 'strict' && !p.toLowerCase().startsWith(`sub-${prefix}-`)) return false
    tried.add(p)

    try {
      const live = await getPayment(p)
      if (!liveQualifiesForHeal(live)) return false

      await healFromPaidPortOnePayment(admin, userId, live)
      return true
    } catch {
      return false
    }
  }

  const lastPid = subscription.last_payment_id?.trim()
  if (lastPid && (await tryPaymentId(lastPid, 'trusted'))) return true

  const { data: byUser } = await admin
    .from('payments')
    .select('payment_id')
    .eq('user_id', userId)
    .eq('amount', SUBSCRIPTION_CHARGE_AMOUNT)
    .order('created_at', { ascending: false })
    .limit(25)

  if (byUser?.length) {
    for (const row of byUser) {
      const pid = String(row.payment_id ?? '')
      if (await tryPaymentId(pid, 'trusted')) return true
    }
  }

  const { data: byPrefix } = await admin
    .from('payments')
    .select('payment_id')
    .like('payment_id', `sub-${prefix}-%`)
    .order('paid_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(25)

  if (byPrefix?.length) {
    for (const row of byPrefix) {
      const pid = String(row.payment_id ?? '')
      if (await tryPaymentId(pid, 'strict')) return true
    }
  }

  const listed = await listRecentPaymentIds({
    billingKey: subscription.billing_key,
    daysBack: 120,
    pageSize: 100,
  })

  for (const pid of listed) {
    const pl = pid.toLowerCase()
    if (pl.startsWith(`sub-${prefix}-`)) {
      if (await tryPaymentId(pid, 'strict')) return true
    }
  }

  return false
}
