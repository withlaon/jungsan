/**
 * GET /api/billing/status
 * 현재 사용자의 구독 상태를 반환합니다.
 * 빌링키는 클라이언트에 노출하지 않습니다.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const admin = createAdminClient()

    let { data: subscription } = await admin
      .from('subscriptions')
      .select(
        'status, billing_key, card_company, card_number_masked, trial_ends_at, next_billing_at, current_period_start, current_period_end, last_payment_id, last_payment_at, failed_count, cancelled_at, access_until, created_at'
      )
      .eq('user_id', user.id)
      .single()

    // 기존 가입자 처리: 구독 레코드가 없으면 자동 생성
    if (!subscription) {
      const { data: profile } = await admin
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single()

      const profileCreatedAt = profile?.created_at ? new Date(profile.created_at) : new Date()
      const trialEndsAt = new Date(profileCreatedAt)
      trialEndsAt.setDate(trialEndsAt.getDate() + 30)

      await admin.from('subscriptions').insert({
        user_id: user.id,
        trial_ends_at: trialEndsAt.toISOString(),
      })

      const { data: newSub } = await admin
        .from('subscriptions')
        .select(
          'status, billing_key, card_company, card_number_masked, trial_ends_at, next_billing_at, current_period_start, current_period_end, last_payment_id, last_payment_at, failed_count, cancelled_at, access_until, created_at'
        )
        .eq('user_id', user.id)
        .single()

      subscription = newSub
    }

    if (!subscription) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    const now = new Date()
    const trialEndsAt = new Date(subscription.trial_ends_at)
    const isTrialActive = now <= trialEndsAt
    const hasCard = !!subscription.billing_key
    const trialRemainingDays = isTrialActive
      ? Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : 0

    // billing_key는 클라이언트에 절대 노출하지 않음
    const { billing_key, ...safeSubscription } = subscription

    const accessUntil = subscription.access_until
      ? new Date(subscription.access_until as string)
      : null
    const graceAccessActive =
      subscription.status === 'cancelled' &&
      accessUntil !== null &&
      now.getTime() <= accessUntil.getTime()

    return NextResponse.json({
      ...safeSubscription,
      has_card: hasCard,
      is_trial_active: isTrialActive,
      trial_remaining_days: trialRemainingDays,
      grace_access_active: graceAccessActive,
    })
  } catch (err) {
    console.error('[billing/status] error:', err)
    return NextResponse.json(
      { error: '구독 상태 조회 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
