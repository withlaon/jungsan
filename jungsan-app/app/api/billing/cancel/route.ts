/**
 * DELETE /api/billing/cancel
 * 구독을 해지합니다. 빌링키를 포트원에서 삭제하고 DB 상태를 cancelled로 변경합니다.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { deleteBillingKey } from '@/lib/portone/billing-server'

export async function DELETE() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: subscription } = await admin
      .from('subscriptions')
      .select('billing_key, status')
      .eq('user_id', user.id)
      .single()

    if (!subscription) {
      return NextResponse.json({ error: '구독 정보를 찾을 수 없습니다.' }, { status: 404 })
    }
    if (subscription.status === 'cancelled') {
      return NextResponse.json({ error: '이미 해지된 구독입니다.' }, { status: 400 })
    }

    // 포트원에서 빌링키 삭제 (카드 정보 제거)
    if (subscription.billing_key) {
      try {
        await deleteBillingKey(subscription.billing_key)
      } catch (e) {
        console.warn('[billing/cancel] 빌링키 삭제 실패 (무시):', e)
      }
    }

    await admin
      .from('subscriptions')
      .update({
        status: 'cancelled',
        billing_key: null,
        card_company: null,
        card_number_masked: null,
        cancelled_at: new Date().toISOString(),
        next_billing_at: null,
      })
      .eq('user_id', user.id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[billing/cancel] error:', err)
    return NextResponse.json(
      { error: '구독 해지 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
