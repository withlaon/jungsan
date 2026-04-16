import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { merchantSubscriptionAccessDenied } from '@/lib/subscription/merchant-subscription-access'

/**
 * DELETE /api/admin/advance-payment?id=<uuid>
 * 선지급금·회수(advance_payments) 행 삭제 — 공제완료(deducted_settlement_id 설정) 행 포함
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })
    }

    let db: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>
    try {
      db = createAdminClient()
    } catch {
      db = supabase
    }

    const { data: profile } = await db
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    const isGlobalAdmin = profile?.username?.toLowerCase() === 'admin'

    if (!isGlobalAdmin) {
      try {
        const adminForGate = createAdminClient()
        const denied = await merchantSubscriptionAccessDenied(adminForGate, user.id, profile?.username)
        if (denied) return denied
      } catch (gateErr) {
        // admin client 설정 오류 등 인프라 문제 발생 시에도 구독 중인 사용자를 차단하지 않음
        console.error('[advance-payment] subscription gate error:', gateErr)
      }
    }

    const { data: row, error: selErr } = await db
      .from('advance_payments')
      .select('id, user_id, rider_id')
      .eq('id', id)
      .maybeSingle()

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (!isGlobalAdmin) {
      if (row.user_id != null && row.user_id !== user.id) {
        return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
      }
      if (row.user_id == null && row.rider_id) {
        const { data: rider } = await db
          .from('riders')
          .select('user_id')
          .eq('id', row.rider_id)
          .maybeSingle()
        if (rider?.user_id !== user.id) {
          return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
        }
      }
    }

    const { error: delErr } = await db.from('advance_payments').delete().eq('id', id)
    if (delErr) {
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('advance-payment delete error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}
