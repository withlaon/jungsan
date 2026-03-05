import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type Params = { params: Promise<{ id: string }> }

// 문의 상세 + 메시지 스레드 조회
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const admin = createAdminClient()

    const { data: inquiry, error: iErr } = await admin
      .from('inquiries')
      .select('id, title, content, status, created_at, updated_at')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (iErr) return NextResponse.json({ error: iErr.message }, { status: 404 })

    const { data: messages, error: mErr } = await admin
      .from('inquiry_messages')
      .select('id, sender_type, content, created_at')
      .eq('inquiry_id', id)
      .order('created_at', { ascending: true })
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    return NextResponse.json({ inquiry, messages })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// 회원: 재문의(추가 메시지) 등록
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '인증 필요' }, { status: 401 })

    const { content } = await request.json()
    if (!content?.trim()) return NextResponse.json({ error: '내용을 입력해주세요.' }, { status: 400 })

    const admin = createAdminClient()

    // 본인 문의인지 확인
    const { data: inquiry, error: checkErr } = await admin
      .from('inquiries')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()
    if (checkErr || !inquiry) return NextResponse.json({ error: '문의를 찾을 수 없습니다.' }, { status: 404 })

    const { error: mErr } = await admin
      .from('inquiry_messages')
      .insert({ inquiry_id: id, sender_type: 'member', content: content.trim() })
    if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 })

    // 상태를 pending으로 변경 (재문의)
    await admin.from('inquiries').update({ status: 'pending', updated_at: new Date().toISOString() }).eq('id', id)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
