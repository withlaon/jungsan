/**
 * POST /api/billing/issue
 * 포트원에서 발급받은 빌링키를 서버에 저장합니다.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  getBillingKeyInfo,
  extractCardInfo,
  confirmBillingKeyIssue,
} from '@/lib/portone/billing-server'
import { getPortOneApiSecret } from '@/lib/portone/api-secret'
import { attemptSubscriptionCharge } from '@/lib/portone/subscription-charge'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    if (!getPortOneApiSecret()) {
      return NextResponse.json(
        {
          error:
            '서버에 PORTONE_API_SECRET(포트원 V2 API Secret)이 없습니다. ' +
            '관리자 콘솔 연동 정보에서 발급받아 Vercel/서버 환경변수에 설정한 뒤 다시 시도해 주세요.',
        },
        { status: 503 },
      )
    }

    const body = await req.json()
    const { billingKey: bodyKey, billingIssueToken } = body as {
      billingKey?: string
      billingIssueToken?: string
    }

    let billingKey = typeof bodyKey === 'string' ? bodyKey.trim() : ''

    if (
      (!billingKey || billingKey === 'NEEDS_CONFIRMATION') &&
      typeof billingIssueToken === 'string' &&
      billingIssueToken.trim()
    ) {
      try {
        billingKey = await confirmBillingKeyIssue(billingIssueToken.trim())
      } catch (e) {
        const msg = e instanceof Error ? e.message : '빌링키 승인 확인 실패'
        console.error('[billing/issue] confirm:', e)
        return NextResponse.json({ error: msg }, { status: 502 })
      }
    }

    if (!billingKey) {
      return NextResponse.json(
        { error: 'billingKey 또는 billingIssueToken이 필요합니다.' },
        { status: 400 },
      )
    }

    // 포트원에서 카드 정보 조회 (카드사, 마스킹 번호) — API Secret 오류 시 사용자에게 바로 알림
    let cardCompany = ''
    let cardNumberMasked = ''
    try {
      const info = await getBillingKeyInfo(billingKey)
      const extracted = extractCardInfo(info)
      cardCompany = extracted.cardCompany
      cardNumberMasked = extracted.cardNumberMasked
    } catch (e) {
      const msg = e instanceof Error ? e.message : '빌링키 정보 조회 실패'
      console.error('[billing/issue] getBillingKeyInfo:', e)
      if (msg.includes('인증 실패') || msg.includes('UNAUTHORIZED')) {
        return NextResponse.json({ error: msg }, { status: 502 })
      }
    }

    const admin = createAdminClient()

    // 기존 구독 조회 (없으면 생성)
    const { data: subscription } = await admin
      .from('subscriptions')
      .select('status, trial_ends_at, next_billing_at')
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
      const insertedAsPastDue = now > trialEndsAt

      await admin.from('subscriptions').insert({
        user_id: user.id,
        status: insertedAsPastDue ? 'past_due' : 'trial',
        billing_key: billingKey,
        billing_key_issued_at: now.toISOString(),
        card_company: cardCompany,
        card_number_masked: cardNumberMasked,
        trial_ends_at: trialEndsAt.toISOString(),
        failed_count: 0,
        next_billing_at: insertedAsPastDue ? now.toISOString() : trialEndsAt.toISOString(),
      })
    } else {
      const trialEndsAt = new Date(subscription.trial_ends_at)
      const isTrialOver = now > trialEndsAt

      const clears = {
        cancelled_at: null,
        access_until: null,
      } as const

      if (subscription.status === 'cancelled') {
        await admin
          .from('subscriptions')
          .update({
            billing_key: billingKey,
            billing_key_issued_at: now.toISOString(),
            card_company: cardCompany,
            card_number_masked: cardNumberMasked,
            failed_count: 0,
            ...clears,
            status: isTrialOver ? 'past_due' : 'trial',
            next_billing_at: isTrialOver ? now.toISOString() : trialEndsAt.toISOString(),
          })
          .eq('user_id', user.id)
      } else {
        await admin
          .from('subscriptions')
          .update({
            billing_key: billingKey,
            billing_key_issued_at: now.toISOString(),
            card_company: cardCompany,
            card_number_masked: cardNumberMasked,
            failed_count: 0,
            ...clears,
            ...(isTrialOver && subscription.status !== 'active'
              ? { status: 'past_due', next_billing_at: now.toISOString() }
              : {}),
            ...(!isTrialOver && !subscription.next_billing_at
              ? { next_billing_at: trialEndsAt.toISOString() }
              : {}),
          })
          .eq('user_id', user.id)
      }
    }

    const { data: subAfter } = await admin
      .from('subscriptions')
      .select('next_billing_at')
      .eq('user_id', user.id)
      .maybeSingle()

    const nextAt = subAfter?.next_billing_at ? new Date(subAfter.next_billing_at) : null
    const shouldTryImmediateCharge = Boolean(
      nextAt && nextAt.getTime() <= now.getTime()
    )

    if (shouldTryImmediateCharge) {
      const chargeResult = await attemptSubscriptionCharge(admin, user.id, now)
      if (!chargeResult.ok) {
        console.error('[billing/issue] 체험 종료 후 즉시 청구 실패:', chargeResult.reason)
      }
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
