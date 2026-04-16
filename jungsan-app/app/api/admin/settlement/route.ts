import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { merchantSubscriptionAccessDenied } from '@/lib/subscription/merchant-subscription-access'

async function verifyUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user
}

/**
 * DELETE /api/admin/settlement?id=<settlement_id>
 * settlement_details → advance_payments 참조 해제 → weekly_settlements 순서로 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await verifyUser(supabase)
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: '정산 ID가 필요합니다.' }, { status: 400 })

    let db: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>
    try {
      db = createAdminClient()
    } catch {
      db = supabase
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    const isSiteAdmin = profile?.username?.toLowerCase() === 'admin'

    if (!isSiteAdmin) {
      try {
        const adminForGate = createAdminClient()
        const denied = await merchantSubscriptionAccessDenied(
          adminForGate,
          user.id,
          profile?.username
        )
        if (denied) return denied
      } catch (gateErr) {
        // admin client 설정 오류 등 인프라 문제 발생 시에도 구독 중인 사용자를 차단하지 않음
        console.error('[settlement] subscription gate error:', gateErr)
      }
    }

    const { data: wsRow } = await db
      .from('weekly_settlements')
      .select('user_id, week_start, week_end')
      .eq('id', id)
      .maybeSingle()
    if (!wsRow) {
      return NextResponse.json({ error: '정산을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (!isSiteAdmin && wsRow.user_id !== user.id) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
    }

    // 1. 이 정산에 연결된 선지급금 deducted_settlement_id 초기화
    const { error: advErr } = await db
      .from('advance_payments')
      .update({ deducted_settlement_id: null })
      .eq('deducted_settlement_id', id)
    if (advErr) {
      console.warn('advance_payments 초기화 실패:', advErr.message)
    }

    // 2. settlement_details 삭제
    const { error: detailErr } = await db
      .from('settlement_details')
      .delete()
      .eq('settlement_id', id)
    if (detailErr) {
      return NextResponse.json({ error: '정산 상세 삭제 실패: ' + detailErr.message }, { status: 500 })
    }

    // 3. weekly_settlements 삭제
    const { error: settlementErr } = await db
      .from('weekly_settlements')
      .delete()
      .eq('id', id)
    if (settlementErr) {
      return NextResponse.json({ error: '정산 삭제 실패: ' + settlementErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('settlement delete error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
