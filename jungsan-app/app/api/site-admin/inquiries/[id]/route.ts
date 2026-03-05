import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// 전체관리자: 특정 문의 상세 + 메시지 스레드
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    if (profile?.username?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const { data: inquiry, error: iErr } = await admin
      .from('inquiries')
      .select('id, title, content, status, created_at, updated_at, user_id')
      .eq('id', id)
      .single()
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 404 })

    // 작성자 프로필
    const { data: authorProfile } = await admin
      .from('profiles')
      .select('username, company_name')
      .eq('id', inquiry.user_id)
      .single()

    const { data: messages, error: mErr } = await admin
      .from('inquiry_messages')
      .select('id, sender_type, content, created_at')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: true })
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    return NextResponse.json({ inquiry: { ...inquiry, profile: authorProfile }, messages })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// 전체관리자: 답변 등록
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    if (profile?.username?.toLowerCase() !== 'admin') {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })

    const { error: mErr } = await admin
      .from('inquiry_messages')
      .insert({ inquiry_id: id, sender_type: 'admin', content: content.trim() })
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    // 상태를 answered로 변경
    await admin.from('inquiries').update({ status: 'answered', updated_at: new Date().toISOString() }).eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
