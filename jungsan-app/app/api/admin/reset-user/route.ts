import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * site-admin 전용: 특정 사용자(windcall)의 모든 데이터 삭제 및 초기화
 * - admin 권한 확인 후 해당 사용자의 모든 데이터 삭제
 * - auth.users에서 사용자 삭제
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    if (!profile || profile.username?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const username = (body?.username ?? 'windcall').toString().trim().toLowerCase()
    if (!username) {
      return NextResponse.json({ error: 'username이 필요합니다.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 1. windcall 사용자 ID 조회
    const { data: targetProfile, error: profileErr } = await admin
      .from('profiles')
      .select('id')
      .ilike('username', username)
      .maybeSingle()

    if (profileErr || !targetProfile) {
      return NextResponse.json({ error: `사용자 '${username}'을(를) 찾을 수 없습니다.` }, { status: 404 })
    }

    const targetUserId = targetProfile.id

    // 2. 삭제 순서 (FK 제약 고려)
    // settlement_details -> weekly_settlements 참조
    const { data: settlements } = await admin
      .from('weekly_settlements')
      .select('id')
      .eq('user_id', targetUserId)

    const settlementIds = (settlements ?? []).map((s) => s.id)

    if (settlementIds.length > 0) {
      await admin.from('settlement_details').delete().in('settlement_id', settlementIds)
    }

    // advance_payments (rider_id 참조 - riders 삭제 전에 먼저)
    await admin.from('advance_payments').delete().eq('user_id', targetUserId)

    // promotions
    await admin.from('promotions').delete().eq('user_id', targetUserId)

    // management_fees
    await admin.from('management_fees').delete().eq('user_id', targetUserId)

    // insurance_fees
    await admin.from('insurance_fees').delete().eq('user_id', targetUserId)

    // weekly_settlements
    await admin.from('weekly_settlements').delete().eq('user_id', targetUserId)

    // riders
    await admin.from('riders').delete().eq('user_id', targetUserId)

    // member_features
    await admin.from('member_features').delete().eq('user_id', targetUserId)

    // profiles
    await admin.from('profiles').delete().eq('id', targetUserId)

    // auth.users
    const { error: authErr } = await admin.auth.admin.deleteUser(targetUserId)
    if (authErr) {
      console.warn('auth deleteUser:', authErr.message)
      // profiles는 이미 삭제됨, auth 실패해도 데이터는 삭제된 상태
    }

    return NextResponse.json({
      success: true,
      message: `'${username}' 사용자의 모든 데이터가 삭제되었습니다.`,
    })
  } catch (err) {
    console.error('reset-user error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
