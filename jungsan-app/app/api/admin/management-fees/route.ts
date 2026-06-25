import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

function getDb(supabase: Awaited<ReturnType<typeof createClient>>) {
  try { return createAdminClient() } catch { return supabase }
}

/**
 * POST /api/admin/management-fees
 * 관리비(일반/콜) 등록
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const body = await req.json().catch(() => null)
    if (!body?.rows || !Array.isArray(body.rows)) {
      return NextResponse.json({ error: 'rows 배열이 필요합니다.' }, { status: 400 })
    }

    const rows = body.rows.map((r: Record<string, unknown>) => ({ ...r, user_id: user.id }))
    const db = getDb(supabase)
    const { data, error } = await db.from('management_fees').insert(rows).select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[management-fees POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/**
 * PATCH /api/admin/management-fees
 * 관리비 그룹 수정 (ids 배열로 일괄 업데이트)
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
      .from('management_fees')
      .update(body.updates)
      .in('id', body.ids)
      .select()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, data })
  } catch (err) {
    console.error('[management-fees PATCH]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
