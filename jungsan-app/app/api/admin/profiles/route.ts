import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function verifyAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '로그인이 필요합니다.', status: 401 as const }
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
  if (!profile || profile.username?.toLowerCase() !== 'admin') {
    return { error: '권한이 없습니다.', status: 403 as const }
  }
  return { user }
}

/**
 * site-admin 전용: 전체 회원(프로필) 목록 조회
 */
export async function GET() {
  try {
    const auth = await verifyAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const admin = createAdminClient()
    const { data, error } = await admin
      .from('profiles')
      .select('id, username, company_name, business_number, manager_name, phone, email')
      .order('username', { ascending: true, nullsFirst: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('admin profiles error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}

/**
 * site-admin 전용: 회원 프로필 수정
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await verifyAdmin()
    if ('error' in auth) return NextResponse.json({ error: auth.error }, { status: auth.status })

    const body = await request.json()
    const { id, username, company_name, business_number, manager_name, phone, email } = body as {
      id?: string
      username?: string
      company_name?: string
      business_number?: string
      manager_name?: string
      phone?: string
      email?: string
    }

    if (!id || typeof id !== 'string') {
      return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin.from('profiles').update({
      username: username != null ? (username === '' ? null : username) : undefined,
      company_name: company_name != null ? (company_name === '' ? null : company_name) : undefined,
      business_number: business_number != null ? (business_number === '' ? null : business_number) : undefined,
      manager_name: manager_name != null ? (manager_name === '' ? null : manager_name) : undefined,
      phone: phone != null ? (phone === '' ? null : phone) : undefined,
      email: email != null ? (email === '' ? null : email) : undefined,
    }).eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('admin profile update error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
