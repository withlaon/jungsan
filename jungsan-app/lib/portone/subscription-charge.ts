/**
 * 월 구독 1건 청구 (크론·카드 등록 직후 즉시 결제 공통)
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { chargeBillingKey } from '@/lib/portone/billing-server'
import { savePayment } from '@/lib/portone/db'

export const SUBSCRIPTION_CHARGE_AMOUNT = 20_000
const MAX_FAIL_COUNT = 3

export function generateSubscriptionPaymentId(userId: string): string {
  const uid = userId.replace(/-/g, '').slice(0, 8)
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 4)
  return `sub-${uid}-${ts}${rand}`.slice(0, 36)
}

function addOneMonth(date: Date): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next
}

export type SubscriptionChargeAdmin = SupabaseClient

export async function attemptSubscriptionCharge(
  admin: SubscriptionChargeAdmin,
  userId: string,
  now: Date = new Date()
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const { data: sub, error } = await admin
    .from('subscriptions')
    .select('user_id, billing_key, failed_count')
    .eq('user_id', userId)
    .single()

  if (error || !sub?.billing_key) {
    return { ok: false, reason: error?.message ?? '빌링키 없음' }
  }

  const paymentId = generateSubscriptionPaymentId(userId)

  const { data: profile } = await admin
    .from('profiles')
    .select('manager_name, email, phone')
    .eq('id', userId)
    .single()

  try {
    const chargeResult = await chargeBillingKey({
      paymentId,
      billingKey: sub.billing_key,
      orderName: '정산타임 월 구독료',
      amount: SUBSCRIPTION_CHARGE_AMOUNT,
      customerId: userId,
      customerName: profile?.manager_name ?? '구독자',
      customerEmail: profile?.email,
      customerPhone: profile?.phone ?? undefined,
    })

    if (chargeResult.status === 'PAID') {
      const periodStart = now
      const periodEnd = addOneMonth(now)
      const nextBillingAt = addOneMonth(now)

      await admin
        .from('subscriptions')
        .update({
          status: 'active',
          failed_count: 0,
          last_payment_id: paymentId,
          last_payment_at: now.toISOString(),
          current_period_start: periodStart.toISOString(),
          current_period_end: periodEnd.toISOString(),
          next_billing_at: nextBillingAt.toISOString(),
        })
        .eq('user_id', userId)

      await savePayment(
        {
          id: paymentId,
          txId: chargeResult.txId,
          transactionType: 'PAYMENT',
          status: 'PAID',
          orderName: '정산타임 월 구독료',
          amount: { total: SUBSCRIPTION_CHARGE_AMOUNT, currency: 'KRW' },
          paidAt: chargeResult.paidAt,
        },
        { userId, isTest: process.env.NODE_ENV !== 'production' }
      )

      return { ok: true }
    }
    throw new Error(`결제 상태 이상: ${chargeResult.status}`)
  } catch (chargeErr) {
    const newFailCount = (sub.failed_count ?? 0) + 1
    const isCritical = newFailCount >= MAX_FAIL_COUNT

    await admin
      .from('subscriptions')
      .update({
        status: 'past_due',
        failed_count: newFailCount,
        next_billing_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .eq('user_id', userId)

    const reason = chargeErr instanceof Error ? chargeErr.message : '알 수 없는 오류'
    console.error(
      `[subscription-charge] 실패 (${newFailCount}/${MAX_FAIL_COUNT}) userId=${userId} ${reason}`,
      isCritical ? '⚠️ 반복 실패' : ''
    )
    return { ok: false, reason }
  }
}
