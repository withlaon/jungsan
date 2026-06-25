import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

/**
 * username으로 email을 반환합니다 (로그인용)
 *
 * 3단계 조회 전략:
 * 1. Service Role Key(admin) 있으면 → Admin Client로 profiles 조회 (RLS 무시)
 * 2. Admin Client 실패 → Anon Client로 profiles 직접 조회 (RLS가 없는 경우 작동)
 * 3. 위 두 방법 모두 실패 → auth.users email 기반 추론 불가 → 404
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const username = typeof body?.username === 'string' ? body.username.trim() : ''

    if (!username) {
      return NextResponse.json({ error: '아이디를 입력해 주세요.' }, { status: 400 })
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!url || !anonKey) {
      return NextResponse.json({ error: 'Supabase 환경 변수가 설정되지 않았습니다.' }, { status: 500 })
    }

    // --- 전략 1: Admin Client (Service Role Key 있을 때) ---
    if (serviceKey) {
      try {
        const admin = createClient(url, serviceKey, {
          auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        })

        const { data, error } = await admin
          .from('profiles')
          .select('email, id')
          .ilike('username', username)
          .maybeSingle()

        if (!error && data) {
          let email: string | null = data.email ?? null

          // profiles.email이 비어있으면 auth.users에서 조회
          if (!email && data.id) {
            const { data: authUser } = await admin.auth.admin.getUserById(data.id)
            email = authUser?.user?.email ?? null
          }

          if (email) return NextResponse.json({ email })
        }
      } catch (e) {
        console.warn('[email-by-username] admin client failed, trying anon:', e)
      }
    }

    // --- 전략 2: Anon Client (RLS 비활성화 또는 SELECT anon 허용 시) ---
    try {
      const anon = createClient(url, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      })

      const { data, error } = await anon
        .from('profiles')
        .select('email')
        .ilike('username', username)
        .maybeSingle()

      if (!error && data?.email) {
        return NextResponse.json({ email: data.email })
      }

      // RPC fallback (get_email_by_username DB 함수가 있는 경우)
      const { data: rpcData, error: rpcError } = await anon
        .rpc('get_email_by_username', { p_username: username })

      if (!rpcError && typeof rpcData === 'string' && rpcData) {
        return NextResponse.json({ email: rpcData })
      }
    } catch (e) {
      console.warn('[email-by-username] anon client failed:', e)
    }

    return NextResponse.json({ error: '존재하지 않는 아이디입니다.' }, { status: 404 })
  } catch (err) {
    console.error('[email-by-username] unexpected error:', err)
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 })
  }
}
