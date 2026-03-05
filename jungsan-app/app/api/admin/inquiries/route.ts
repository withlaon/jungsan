import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// 회원: 자신의 문의 목록 조회 (20개씩 페이징)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') ?? '1', 10)
    const pageSize = 20
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const admin = createAdminClient()
    const { data, error, count } = await admin
      .from('inquiries')
      .select('id, title, status, created_at, updated_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data, count, page, pageSize })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// 회원: 새 문의 등록
export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { title, content } = await request.json()
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: '제목과 내용을 입력해주세요.' }, { status: 400 })
    }

    const admin = createAdminClient()

    // 문의 등록
    const { data: inquiry, error: iErr } = await admin
      .from('inquiries')
      .insert({ user_id: user.id, title: title.trim(), content: content.trim() })
      .select('id')
      .single()
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 500 })

    // 첫 메시지(본문)도 messages에 저장
    const { error: mErr } = await admin
      .from('inquiry_messages')
      .insert({ inquiry_id: inquiry.id, sender_type: 'member', content: content.trim() })
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    return NextResponse.json({ id: inquiry.id })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
