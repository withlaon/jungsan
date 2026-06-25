import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * username으로 email을 반환합니다 (로그인용)
 * Admin Client를 사용해 RLS 없이 profiles 테이블에서 직접 조회
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const username = typeof body?.username === 'string' ? body.username.trim() : ''

    if (!username) {
      return NextResponse.json({ error: '아이디를 입력해 주세요.' }, { status: 400 })
    }

    const admin = createAdminClient()

    const { data, error } = await admin
      .from('profiles')
      .select('email, id')
      .ilike('username', username)
      .maybeSingle()

    if (error) {
      console.error('[email-by-username] profiles query error:', error.message)
      return NextResponse.json({ error: '사용자 조회 중 오류가 발생했습니다.' }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: '존재하지 않는 아이디입니다.' }, { status: 404 })
    }

    let email: string | null = data.email ?? null

    // profiles.email 이 비어있을 경우 auth.users 에서 직접 조회
    if (!email && data.id) {
      const { data: authUser } = await admin.auth.admin.getUserById(data.id)
      email = authUser?.user?.email ?? null
    }

    if (!email) {
      return NextResponse.json({ error: '이메일 정보를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json({ email })
  } catch (err) {
    console.error('[email-by-username] unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
