import { NextResponse } from 'next/server'

/**
 * site-admin 회원 목록 실시간 갱신을 위한 브로드캐스트 엔드포인트.
 * 신규 가입 또는 회원 탈퇴 직후 이 endpoint를 POST 호출하면
 * Supabase Realtime Broadcast를 통해 site-admin 페이지가 즉시 목록을 재조회합니다.
 */
export async function POST() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

    const res = await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [
          {
            topic: 'realtime:member-changes',
            event: 'member_change',
            payload: {},
            private: false,
          },
        ],
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error('Realtime broadcast error:', res.status, text)
      return NextResponse.json({ ok: false }, { status: 502 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('notify member-change error:', err)
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
