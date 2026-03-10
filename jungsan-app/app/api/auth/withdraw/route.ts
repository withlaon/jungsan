import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 회원 본인 탈퇴 API
 * - Authorization 헤더의 Bearer 토큰으로 본인 인증 (쿠키 만료 문제 방지)
 * - 로그인된 사용자의 모든 데이터를 FK 순서에 맞춰 삭제
 * - auth.users에서도 완전 삭제
 */
export async function POST(req: NextRequest) {
  try {
    const admin = createAdminClient()

    // 클라이언트가 전달한 Bearer 토큰으로 사용자 인증
    // (proxy.ts가 /api/ 경로를 토큰 갱신에서 제외하므로 쿠키 대신 헤더 사용)
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()

    if (!token) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await admin.auth.getUser(token)

    if (authError || !user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const userId = user.id

    // 1. settlement_details (weekly_settlements FK 참조)
    const { data: settlements } = await admin
      .from('weekly_settlements')
      .select('id')
      .eq('user_id', userId)

    const settlementIds = (settlements ?? []).map((s: { id: string }) => s.id)
    if (settlementIds.length > 0) {
      await admin.from('settlement_details').delete().in('settlement_id', settlementIds)
    }

    // 2. advance_payments
    await admin.from('advance_payments').delete().eq('user_id', userId)

    // 3. promotions
    await admin.from('promotions').delete().eq('user_id', userId)

    // 4. management_fees
    await admin.from('management_fees').delete().eq('user_id', userId)

    // 5. insurance_fees
    await admin.from('insurance_fees').delete().eq('user_id', userId)

    // 6. weekly_settlements
    await admin.from('weekly_settlements').delete().eq('user_id', userId)

    // 7. riders
    await admin.from('riders').delete().eq('user_id', userId)

    // 8. member_features
    await admin.from('member_features').delete().eq('user_id', userId)

    // 9. profiles
    await admin.from('profiles').delete().eq('id', userId)

    // 10. auth.users (완전 삭제)
    const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(userId)
    if (deleteAuthErr) {
      console.warn('auth.deleteUser warning:', deleteAuthErr.message)
    }

    // 11. site-admin 실시간 갱신 트리거
    // (await 필수: Vercel 서버리스에서 return 후 fetch는 즉시 종료됨)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

    // A) DB INSERT 방식 (마이그레이션 적용 후 postgres_changes로 전달)
    try {
      await admin.from('member_change_notifications').insert({ event_type: 'withdraw' })
    } catch { /* 테이블 미생성 시 무시 */ }

    // B) Broadcast 방식 (마이그레이션 전/후 모두 작동, 즉시 전달)
    try {
      await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
        body: JSON.stringify({
          messages: [{ topic: 'realtime:member-changes', event: 'member_change', payload: {} }],
        }),
      })
    } catch { /* ignore */ }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('withdraw error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '탈퇴 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
