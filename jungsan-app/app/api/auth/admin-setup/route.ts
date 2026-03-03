import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * admin 로그인 준비: 사용자 생성/이메일 확인
 * - admin 사용자가 없으면 생성 (email_confirm: true)
 * - 있으면 이메일 확인 처리
 * - profiles에 admin 행 추가
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { username, password } = body as { username?: string; password?: string }

    if (!username || String(username).trim().toLowerCase() !== 'admin') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@jungsan.local'
    const trimmedPassword = String(password || '').trim()

    if (!trimmedPassword || trimmedPassword.length < 6) {
      return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // 기존 사용자 조회
    const { data: listData } = await supabase.auth.admin.listUsers({ perPage: 1000 })
    const existing = listData?.users?.find((u) => u.email === adminEmail)

    if (existing) {
      // 이메일 확인 처리 (미확인 시)
      if (!existing.email_confirmed_at) {
        await supabase.auth.admin.updateUserById(existing.id, {
          email_confirm: true,
        })
      }
      // profiles에 username=admin 확인 (사이트관리자 접근용)
      const { data: profile } = await supabase.from('profiles').select('id').eq('id', existing.id).maybeSingle()
      if (!profile) {
        await supabase.from('profiles').insert({
          id: existing.id,
          username: 'admin',
          email: adminEmail,
          company_name: '',
          business_number: '',
          manager_name: '',
          phone: '',
        }).then(({ error }) => { if (error) console.warn('profiles insert:', error.message) })
      } else {
        await supabase.from('profiles').update({ username: 'admin', email: adminEmail }).eq('id', existing.id).then(({ error }) => { if (error) console.warn('profiles update:', error.message) })
      }
    } else {
      // 새 admin 사용자 생성
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: adminEmail,
        password: trimmedPassword,
        email_confirm: true,
      })

      if (createError) {
        console.error('admin createUser error:', createError)
        return NextResponse.json({ error: createError.message }, { status: 500 })
      }

      // profiles에 admin 행 추가
      if (newUser?.user?.id) {
        await supabase.from('profiles').upsert(
          {
            id: newUser.user.id,
            username: 'admin',
            email: adminEmail,
            company_name: '',
            business_number: '',
            manager_name: '',
            phone: '',
          },
          { onConflict: 'id' }
        ).then(({ error }) => {
          if (error) console.warn('profiles upsert:', error.message)
        })
      }
    }

    return NextResponse.json({ success: true, email: adminEmail })
  } catch (err) {
    console.error('admin-setup error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
