import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 라이더 목록 조회 API
 * - RLS 우회하여 등록된 라이더가 목록에 정상 표시되도록 함
 */
export async function GET() {
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

    const isAdmin = profile?.username?.toLowerCase() === 'admin'

    let data: unknown[] = []

    try {
      const admin = createAdminClient()
      if (isAdmin) {
        const { data: rows } = await admin.from('riders').select('*').order('name')
        data = rows ?? []
      } else {
        const { data: rows } = await admin
          .from('riders')
          .select('*')
          .or(`user_id.eq.${user.id},user_id.is.null`)
          .order('name')
        data = rows ?? []
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/SUPABASE_SERVICE_ROLE_KEY|설정되지 않았습니다/i.test(msg)) {
        let q = supabase.from('riders').select('*').order('name')
        if (!isAdmin) q = q.or(`user_id.eq.${user.id},user_id.is.null`)
        const { data: rows } = await q
        data = rows ?? []
      } else {
        throw e
      }
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('riders list error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
