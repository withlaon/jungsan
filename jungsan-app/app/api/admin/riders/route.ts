import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 라이더 목록 조회 API
 * - Bearer 토큰 헤더(우선) 또는 쿠키로 인증 (쿠키 만료 시 대비)
 * - RLS 우회하여 등록된 라이더가 목록에 정상 표시되도록 함
 * - 무료체험·구독 만료 후에도 본인 소속 라이더 목록 조회는 허용 (등록·수정·삭제는 다른 API에서 게이트)
 */
export async function GET(req: NextRequest) {
  try {
    const adminClient = createAdminClient()

    // 1) Bearer 토큰 우선 인증 (proxy.ts가 /api/를 토큰 갱신에서 제외하므로)
    let user = null
    const authHeader = req.headers.get('authorization') ?? ''
    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (token) {
      const { data: { user: u } } = await adminClient.auth.getUser(token)
      user = u
    }

    // 2) 쿠키 기반 인증 fallback
    if (!user) {
      const supabase = await createClient()
      const { data: { user: u } } = await supabase.auth.getUser()
      user = u
    }

    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const { data: profile } = await adminClient
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    const isAdmin = profile?.username?.toLowerCase() === 'admin'

    let data: unknown[] = []

    try {
      if (isAdmin) {
        const { data: rows } = await adminClient.from('riders').select('*').order('name')
        data = rows ?? []
      } else {
        const { data: rows } = await adminClient
          .from('riders')
          .select('*')
          .eq('user_id', user.id)
          .order('name')
        data = rows ?? []
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/SUPABASE_SERVICE_ROLE_KEY|설정되지 않았습니다/i.test(msg)) {
        const supabase = await createClient()
        let q = supabase.from('riders').select('*').order('name')
        if (!isAdmin) q = q.eq('user_id', user.id)
        const { data: rows } = await q
        data = rows ?? []
      } else {
        throw e
      }
    }

    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' },
    })
  } catch (err) {
    console.error('riders list error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
