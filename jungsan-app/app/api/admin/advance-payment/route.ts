import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getDb(supabase: Awaited<ReturnType<typeof createClient>>) {
  try { return createAdminClient() } catch { return supabase }
}

/**
 * POST /api/admin/advance-payment
 * 선지급금 또는 회수 등록
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: '요청 본문이 없습니다.' }, { status: 400 })

    const { rider_id, amount, paid_date, memo, type } = body
    if (!rider_id || !amount || !paid_date || !type) {
      return NextResponse.json({ error: '라이더, 금액, 주간, 유형은 필수입니다.' }, { status: 400 })
    }
    const numAmount = typeof amount === 'number' ? amount : parseInt(String(amount).replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: '올바른 금액을 입력해주세요.' }, { status: 400 })
    }

    const db = getDb(supabase)
    const insertRow = {
      user_id: user.id,
      rider_id,
      amount: numAmount,
      paid_date,
      memo: memo || null,
      type,
    }

    const { data, error } = await db.from('advance_payments').insert(insertRow).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[advance-payment POST] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/advance-payment?id=<uuid>
 * 선지급금 또는 회수 수정
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })

    const body = await req.json().catch(() => null)
    if (!body) return NextResponse.json({ error: '요청 본문이 없습니다.' }, { status: 400 })

    const { rider_id, amount, paid_date, memo } = body
    const numAmount = typeof amount === 'number' ? amount : parseInt(String(amount).replace(/,/g, ''))
    if (isNaN(numAmount) || numAmount <= 0) {
      return NextResponse.json({ error: '올바른 금액을 입력해주세요.' }, { status: 400 })
    }

    const db = getDb(supabase)

    const { data: row } = await db
      .from('advance_payments').select('user_id').eq('id', id).maybeSingle()
    if (!row) return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })

    const { data: profile } = await db
      .from('profiles').select('username').eq('id', user.id).maybeSingle()
    const isGlobalAdmin = profile?.username?.toLowerCase() === 'admin'
    if (!isGlobalAdmin && row.user_id !== user.id) {
      return NextResponse.json({ error: '수정 권한이 없습니다.' }, { status: 403 })
    }

    const { data, error } = await db
      .from('advance_payments')
      .update({ rider_id, amount: numAmount, paid_date, memo: memo || null })
      .eq('id', id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[advance-payment PATCH] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/advance-payment?id=<uuid>
 */
export async function DELETE(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const id = req.nextUrl.searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'ID가 필요합니다.' }, { status: 400 })

    const db = getDb(supabase)
    const { data: profile } = await db
      .from('profiles').select('username').eq('id', user.id).maybeSingle()
    const isGlobalAdmin = profile?.username?.toLowerCase() === 'admin'

    const { data: row } = await db
      .from('advance_payments').select('id, user_id, rider_id').eq('id', id).maybeSingle()
    if (!row) return NextResponse.json({ error: '항목을 찾을 수 없습니다.' }, { status: 404 })

    if (!isGlobalAdmin) {
      if (row.user_id != null && row.user_id !== user.id) {
        return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
      }
      if (row.user_id == null && row.rider_id) {
        const { data: rider } = await db
          .from('riders').select('user_id').eq('id', row.rider_id).maybeSingle()
        if (rider?.user_id !== user.id) {
          return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
        }
      }
    }

    const { error } = await db.from('advance_payments').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[advance-payment DELETE] error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
