/**
 * POST /api/cron/billing
 * Vercel Cron이 매일 새벽 2시에 호출하는 월 구독료 자동 청구 엔드포인트.
 *
 * 보안: CRON_SECRET 환경변수로 무단 호출 방지
 *
 * 처리 흐름:
 * 1. next_billing_at <= 현재시각 인 active/past_due 구독 조회
 * 2. 빌링키로 포트원 결제 요청 (20,000원)
 * 3. 성공 → active, next_billing_at += 1개월
 * 4. 실패 → failed_count++, 3회 이상 실패 시 past_due 유지 (관리자 알림 필요)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { chargeBillingKey } from '@/lib/portone/billing-server'
import { savePayment } from '@/lib/portone/db'

const SUBSCRIPTION_AMOUNT = 20_000
const MAX_FAIL_COUNT = 3
const CRON_SECRET = process.env.CRON_SECRET ?? ''

function generatePaymentId(userId: string): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).substring(2, 6)
  const uid = userId.substring(0, 8)
  return `sub-${uid}-${ts}-${rand}`
}

function addOneMonth(date: Date): Date {
  const next = new Date(date)
  next.setMonth(next.getMonth() + 1)
  return next
}

export async function POST(req: NextRequest) {
  // 보안 검증
  const authHeader = req.headers.get('authorization')
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  const results: { userId: string; success: boolean; reason?: string }[] = []

  try {
    // 결제가 필요한 구독 목록 조회 (trial 포함: 체험 종료 후 카드 등록한 경우)
    const { data: subscriptions, error } = await admin
      .from('subscriptions')
      .select('user_id, billing_key, status, next_billing_at, failed_count, card_company, card_number_masked')
      .not('billing_key', 'is', null)
      .lte('next_billing_at', now.toISOString())
      .in('status', ['active', 'past_due', 'trial'])

    if (error) {
      console.error('[cron/billing] 구독 조회 실패:', error.message)
      return NextResponse.json({ error: '구독 조회 실패' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ success: true, processed: 0, results: [] })
    }

    console.log(`[cron/billing] 청구 대상 ${subscriptions.length}건 처리 시작`)

    for (const sub of subscriptions) {
      const paymentId = generatePaymentId(sub.user_id)

      // 프로필 정보 조회 (고객명, 이메일)
      const { data: profile } = await admin
        .from('profiles')
        .select('manager_name, email, phone')
        .eq('id', sub.user_id)
        .single()

      try {
        const chargeResult = await chargeBillingKey({
          paymentId,
          billingKey: sub.billing_key,
          orderName: '정산타임 월 구독료',
          amount: SUBSCRIPTION_AMOUNT,
          customerId: sub.user_id,
          customerName: profile?.manager_name ?? '구독자',
          customerEmail: profile?.email,
          customerPhone: profile?.phone ?? undefined,
        })

        if (chargeResult.status === 'PAID') {
          const periodStart = now
          const periodEnd = addOneMonth(now)
          const nextBillingAt = addOneMonth(now)

          await admin.from('subscriptions').update({
            status: 'active',
            failed_count: 0,
            last_payment_id: paymentId,
            last_payment_at: now.toISOString(),
            current_period_start: periodStart.toISOString(),
            current_period_end: periodEnd.toISOString(),
            next_billing_at: nextBillingAt.toISOString(),
          }).eq('user_id', sub.user_id)

          // payments 테이블에 기록
          await savePayment(
            {
              id: paymentId,
              txId: chargeResult.txId,
              transactionType: 'PAYMENT',
              status: 'PAID',
              orderName: '정산타임 월 구독료',
              amount: { total: SUBSCRIPTION_AMOUNT, currency: 'KRW' },
              paidAt: chargeResult.paidAt,
            },
            { userId: sub.user_id, isTest: process.env.NODE_ENV !== 'production' }
          )

          results.push({ userId: sub.user_id, success: true })
          console.log(`[cron/billing] ✅ 청구 성공 - userId: ${sub.user_id}`)
        } else {
          throw new Error(`결제 상태 이상: ${chargeResult.status}`)
        }
      } catch (chargeErr) {
        const newFailCount = (sub.failed_count ?? 0) + 1
        const isCritical = newFailCount >= MAX_FAIL_COUNT

        await admin.from('subscriptions').update({
          status: 'past_due',
          failed_count: newFailCount,
          // 재시도: 3일 후
          next_billing_at: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        }).eq('user_id', sub.user_id)

        const reason = chargeErr instanceof Error ? chargeErr.message : '알 수 없는 오류'
        results.push({ userId: sub.user_id, success: false, reason })
        console.error(
          `[cron/billing] ❌ 청구 실패 (${newFailCount}/${MAX_FAIL_COUNT}) - userId: ${sub.user_id}, 사유: ${reason}`,
          isCritical ? '⚠️ 반복 실패 - 관리자 확인 필요' : ''
        )
      }
    }

    const successCount = results.filter((r) => r.success).length
    const failCount = results.filter((r) => !r.success).length

    return NextResponse.json({
      success: true,
      processed: subscriptions.length,
      succeeded: successCount,
      failed: failCount,
      results,
    })
  } catch (err) {
    console.error('[cron/billing] 처리 오류:', err)
    return NextResponse.json({ error: '청구 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
