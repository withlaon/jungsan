import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return user
}

/**
 * DELETE /api/admin/settlement?id=<settlement_id>
 * settlement_details ??advance_payments 참조 ?�제 ??weekly_settlements ?�서�???��
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const user = await verifyUser(supabase)
    if (!user) return NextResponse.json({ error: '로그?�이 ?�요?�니??' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: '?�산 ID가 ?�요?�니??' }, { status: 400 })

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


    const { data: wsRow } = await db
      .from('weekly_settlements')
      .select('user_id, week_start, week_end')
      .eq('id', id)
      .maybeSingle()
    if (!wsRow) {
      return NextResponse.json({ error: '?�산??찾을 ???�습?�다.' }, { status: 404 })
    }
    if (!isSiteAdmin && wsRow.user_id !== user.id) {
      return NextResponse.json({ error: '??�� 권한???�습?�다.' }, { status: 403 })
    }

    // 1. ???�산???�결???��?급금 deducted_settlement_id 초기??
    const { error: advErr } = await db
      .from('advance_payments')
      .update({ deducted_settlement_id: null })
      .eq('deducted_settlement_id', id)
    if (advErr) {
      console.warn('advance_payments 초기???�패:', advErr.message)
    }

    // 2. settlement_details ??��
    const { error: detailErr } = await db
      .from('settlement_details')
      .delete()
      .eq('settlement_id', id)
    if (detailErr) {
      return NextResponse.json({ error: '?�산 ?�세 ??�� ?�패: ' + detailErr.message }, { status: 500 })
    }

    // 3. weekly_settlements ??��
    const { error: settlementErr } = await db
      .from('weekly_settlements')
      .delete()
      .eq('id', id)
    if (settlementErr) {
      return NextResponse.json({ error: '?�산 ??�� ?�패: ' + settlementErr.message }, { status: 500 })
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
