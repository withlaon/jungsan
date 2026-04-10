/**
 * Link subscription payment IDs (sub-{uuid8}-...) to users and heal stale past_due rows.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getPayment } from '@/lib/portone/server'
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

type SubscriptionRow = {
  status: string
  failed_count: number | null
  billing_key: string | null
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

  const { data: candidates, error } = await admin
    .from('payments')
    .select('payment_id, status, amount, paid_at')
    .like('payment_id', `sub-${prefix}-%`)
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(15)

  if (error || !candidates?.length) return false

  for (const row of candidates) {
    const pid = row.payment_id as string
    const paidAt = row.paid_at as string | null
    if (!paidAt) continue
    const rowStatus = String(row.status ?? '').toUpperCase()
    if (rowStatus !== 'PAID') continue

    const amt = Number(row.amount)
    if (amt !== SUBSCRIPTION_CHARGE_AMOUNT) continue

    try {
      const live = await getPayment(pid)
      if (!isPaidPortOneStatus(live.status)) continue
      if (live.amount?.total !== SUBSCRIPTION_CHARGE_AMOUNT) continue

      const periodStart = live.paidAt ?? paidAt
      const periodEnd = addOneMonth(periodStart)
      const nextBill = addOneMonth(periodStart)

      await admin
        .from('subscriptions')
        .update({
          status: 'active',
          failed_count: 0,
          last_payment_id: pid,
          last_payment_at: periodStart,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          next_billing_at: nextBill,
        })
        .eq('user_id', userId)

      return true
    } catch {
      continue
    }
  }

  return false
}
