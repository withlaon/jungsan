/**
 * Link subscription payment IDs (sub-{uuid8}-...) to users and heal stale past_due rows.
 * Always trusts PortOne GET /payments/:id over local DB status (fixes FAILED/CANCELLED drift).
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PortOnePaymentResponse } from '@/lib/portone/server'
import { getPayment } from '@/lib/portone/server'
import { savePayment } from '@/lib/portone/db'
import { isPaidPortOneStatus } from '@/lib/portone/payment-normalize'
import { SUBSCRIPTION_CHARGE_AMOUNT } from '@/lib/portone/subscription-charge'

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

/**
 * If DB shows past_due with failures but PortOne has a successful sub-* charge, sync subscription.
 */
export async function reconcileSubscriptionIfPortOnePaid(
  admin: SupabaseClient,
  userId: string,
  subscription: SubscriptionRow,
): Promise<boolean> {
  if (subscription.status !== 'past_due') return false
  if ((subscription.failed_count ?? 0) < 1) return false
  if (!subscription.billing_key) return false

  const prefix = userId.replace(/-/g, '').slice(0, 8).toLowerCase()
  if (!prefix || prefix.length !== 8) return false

  const tried = new Set<string>()

  const tryPaymentId = async (pid: string): Promise<boolean> => {
    const p = pid.trim()
    if (!p || tried.has(p)) return false
    if (!p.toLowerCase().startsWith(`sub-${prefix}-`)) return false
    tried.add(p)

    try {
      const live = await getPayment(p)
      if (!isPaidPortOneStatus(live.status)) return false
      if (!paymentAmountMatches(live)) return false

      await healFromPaidPortOnePayment(admin, userId, live)
      return true
    } catch {
      return false
    }
  }

  const lastPid = subscription.last_payment_id?.trim()
  if (lastPid && (await tryPaymentId(lastPid))) return true

  const { data: candidates, error } = await admin
    .from('payments')
    .select('payment_id')
    .like('payment_id', `sub-${prefix}-%`)
    .order('paid_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(25)

  if (!error && candidates?.length) {
    for (const row of candidates) {
      const pid = String(row.payment_id ?? '')
      if (await tryPaymentId(pid)) return true
    }
  }

  return false
}
