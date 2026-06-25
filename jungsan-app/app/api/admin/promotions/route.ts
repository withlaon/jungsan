import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getDb(supabase: Awaited<ReturnType<typeof createClient>>) {
  try { return createAdminClient() } catch { return supabase }
}

/**
 * POST /api/admin/promotions
 * 프로모션 등록 (라이더별 또는 전체/미지정)
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body?.rows && !body?.row) {
      return NextResponse.json({ error: 'rows 또는 row가 필요합니다.' }, { status: 400 })
    }

    const db = getDb(supabase)

    if (body.rows && Array.isArray(body.rows)) {
      const rows = body.rows.map((r: Record<string, unknown>) => ({ ...r, user_id: user.id }))
      const { data, error } = await db.from('promotions').insert(rows).select()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data })
    } else {
      const row = { ...body.row, user_id: user.id }
      const { data, error } = await db.from('promotions').insert(row).select().single()
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      return NextResponse.json({ success: true, data })
    }
  } catch (err) {
    console.error('[promotions POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/promotions
 * 프로모션 그룹 수정 (ids 배열로 일괄 업데이트)
 */
export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body?.ids || !Array.isArray(body.ids) || !body.updates) {
      return NextResponse.json({ error: 'ids 배열과 updates 객체가 필요합니다.' }, { status: 400 })
    }

    const db = getDb(supabase)
    const { data, error } = await db
      .from('promotions')
      .update(body.updates)
      .in('id', body.ids)
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[promotions PATCH]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
