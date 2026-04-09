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
import { attemptSubscriptionCharge } from '@/lib/portone/subscription-charge'

const CRON_SECRET = process.env.CRON_SECRET ?? ''

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
      const chargeResult = await attemptSubscriptionCharge(admin, sub.user_id, now)
      if (chargeResult.ok) {
        results.push({ userId: sub.user_id, success: true })
        console.log(`[cron/billing] ✅ 청구 성공 - userId: ${sub.user_id}`)
      } else {
        results.push({ userId: sub.user_id, success: false, reason: chargeResult.reason })
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
