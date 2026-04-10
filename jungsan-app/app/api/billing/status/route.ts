/**
 * GET /api/billing/status
 * 현재 사용자의 구독 상태를 반환합니다.
 * 빌링키는 클라이언트에 노출하지 않습니다.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { reconcileSubscriptionIfPortOnePaid } from '@/lib/portone/subscription-reconcile'

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

    // * : 마이그레이션 전후 컬럼 차이·알 수 없는 컬럼 조회 오류 방지
    // maybeSingle : 0행일 때 PostgREST 오류 없이 null
    let { data: subscription } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    // 기존 가입자 처리: 구독 레코드가 없으면 자동 생성
    if (!subscription) {
      const { data: profile } = await admin
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .maybeSingle()

      const profileCreatedAt = profile?.created_at ? new Date(profile.created_at) : new Date()
      const trialEndsAt = new Date(profileCreatedAt)
      trialEndsAt.setDate(trialEndsAt.getDate() + 30)

      const { error: insertError } = await admin.from('subscriptions').insert({
        user_id: user.id,
        trial_ends_at: trialEndsAt.toISOString(),
      })

      // 동시에 카드 저장 등으로 행이 생긴 경우(유니크 충돌) → 다시 조회
      if (insertError?.code === '23505') {
        const { data: again } = await admin
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()
        subscription = again
      } else if (insertError) {
        console.error('[billing/status] 구독 자동 생성 실패:', insertError.message)
        return NextResponse.json(
          { error: '구독 정보를 초기화하지 못했습니다. 잠시 후 다시 시도해 주세요.' },
          { status: 503 },
        )
      } else {
        const { data: newSub } = await admin
          .from('subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle()

        subscription = newSub
      }
    }

    if (!subscription) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    await reconcileSubscriptionIfPortOnePaid(admin, user.id, {
      status: subscription.status,
      failed_count: subscription.failed_count,
      billing_key: subscription.billing_key,
      last_payment_id: subscription.last_payment_id,
    })

    const { data: refreshed } = await admin
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (refreshed) {
      subscription = refreshed
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
