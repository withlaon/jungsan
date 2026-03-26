/**
 * POST /api/billing/issue
 * 포트원에서 발급받은 빌링키를 서버에 저장합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getBillingKeyInfo, extractCardInfo } from '@/lib/portone/billing-server'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await req.json()
    const { billingKey } = body as { billingKey?: string }

    if (!billingKey) {
      return NextResponse.json({ error: 'billingKey가 필요합니다.' }, { status: 400 })
    }

    // 포트원에서 카드 정보 조회 (카드사, 마스킹 번호)
    let cardCompany = ''
    let cardNumberMasked = ''
    try {
      const info = await getBillingKeyInfo(billingKey)
      const extracted = extractCardInfo(info)
      cardCompany = extracted.cardCompany
      cardNumberMasked = extracted.cardNumberMasked
    } catch (e) {
      console.warn('[billing/issue] 카드 정보 조회 실패 (무시):', e)
    }

    const admin = createAdminClient()

    // 기존 구독 조회 (없으면 생성)
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('status, trial_ends_at')
      .eq('user_id', user.id)
      .single()

    const now = new Date()

    if (!subscription) {
      // 기존 가입자 - 프로필 created_at 기준 trial_ends_at 계산
      const { data: profile } = await admin
        .from('profiles')
        .select('created_at')
        .eq('id', user.id)
        .single()

      const profileCreatedAt = profile?.created_at ? new Date(profile.created_at) : now
      const trialEndsAt = new Date(profileCreatedAt)
      trialEndsAt.setDate(trialEndsAt.getDate() + 30)

      await admin.from('subscriptions').insert({
        user_id: user.id,
        status: now > trialEndsAt ? 'past_due' : 'trial',
        billing_key: billingKey,
        billing_key_issued_at: now.toISOString(),
        card_company: cardCompany,
        card_number_masked: cardNumberMasked,
        trial_ends_at: trialEndsAt.toISOString(),
        next_billing_at: now > trialEndsAt ? now.toISOString() : trialEndsAt.toISOString(),
      })
    } else {
      const trialEndsAt = new Date(subscription.trial_ends_at)
      const isTrialOver = now > trialEndsAt

      await admin
        .from('subscriptions')
        .update({
          billing_key: billingKey,
          billing_key_issued_at: now.toISOString(),
          card_company: cardCompany,
          card_number_masked: cardNumberMasked,
          // 체험 기간이 이미 지났으면 즉시 결제 필요 상태로
          ...(isTrialOver && subscription.status !== 'active'
            ? { status: 'past_due', next_billing_at: now.toISOString() }
            : {}),
          // 체험 중이면 체험 종료일에 첫 결제
          ...(!isTrialOver && !subscription.next_billing_at
            ? { next_billing_at: trialEndsAt.toISOString() }
            : {}),
        })
        .eq('user_id', user.id)
    }

    return NextResponse.json({ success: true, cardCompany, cardNumberMasked })
  } catch (err) {
    console.error('[billing/issue] error:', err)
    return NextResponse.json(
      { error: '카드 등록 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
