import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 전체관리자: 모든 문의 목록 조회 (20개씩 페이징)
export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    // admin 계정 확인
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    if (profile?.username?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    // inquiries + 작성자 프로필 조인
    const { data, error, count } = await admin
      .from('inquiries')
      .select(`
        id, title, status, created_at, updated_at,
        profiles!inquiries_user_id_fkey(username, company_name)
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) {
      // profiles join 실패 시 별도 조회
      const { data: data2, error: err2, count: count2 } = await admin
        .from('inquiries')
        .select('id, title, status, created_at, updated_at, user_id', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
      if (err2) return NextResponse.json({ error: err2.message }, { status: 500 })

      // user_id → profile 매핑
      const userIds = [...new Set((data2 ?? []).map((d: { user_id: string }) => d.user_id))]
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, username, company_name')
        .in('id', userIds)
      const profileMap = Object.fromEntries((profiles ?? []).map((p: { id: string; username: string; company_name: string }) => [p.id, p]))

      const enriched = (data2 ?? []).map((d: { user_id: string }) => ({
        ...d,
        profiles: profileMap[d.user_id] ?? null,
      }))
      return NextResponse.json({ data: enriched, count: count2, page, pageSize })
    }

    return NextResponse.json({ data, count, page, pageSize })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
