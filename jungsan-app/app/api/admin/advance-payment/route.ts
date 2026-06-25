import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * DELETE /api/admin/advance-payment?id=<uuid>
 * ?��?급금·?�수(advance_payments) ????�� ??공제?�료(deducted_settlement_id ?�정) ???�함
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그?�이 ?�요?�니??' }, { status: 401 })
    }

    const id = req.nextUrl.searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'ID가 ?�요?�니??' }, { status: 400 })
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


    const { data: row, error: selErr } = await db
      .from('advance_payments')
      .select('id, user_id, rider_id')
      .eq('id', id)
      .maybeSingle()

    if (selErr) {
      return NextResponse.json({ error: selErr.message }, { status: 500 })
    }
    if (!row) {
      return NextResponse.json({ error: '??��??찾을 ???�습?�다.' }, { status: 404 })
    }

    if (!isGlobalAdmin) {
      if (row.user_id != null && row.user_id !== user.id) {
        return NextResponse.json({ error: '??�� 권한???�습?�다.' }, { status: 403 })
      }
      if (row.user_id == null && row.rider_id) {
        const { data: rider } = await db
          .from('riders')
          .select('user_id')
          .eq('id', row.rider_id)
          .maybeSingle()
        if (rider?.user_id !== user.id) {
          return NextResponse.json({ error: '??�� 권한???�습?�다.' }, { status: 403 })
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
