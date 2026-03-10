import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 신규 가입 완료 후 호출되는 알림 엔드포인트.
 * A) member_change_notifications INSERT → postgres_changes 구독으로 즉시 전달
 * B) Realtime Broadcast → broadcast 구독으로 즉시 전달
 * 두 방식을 모두 사용해 신뢰성 확보.
 */
export async function POST() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY!

  // A) DB INSERT (마이그레이션 적용 후 postgres_changes로 전달)
  try {
    const admin = createAdminClient()
    await admin.from('member_change_notifications').insert({ event_type: 'signup' })
  } catch { /* 테이블 미생성 시 무시 */ }

  // B) Broadcast (마이그레이션 전/후 모두 즉시 전달)
  try {
    await fetch(`${supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceKey,
        'Authorization': `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({
        messages: [{ topic: 'realtime:member-changes', event: 'member_change', payload: {} }],
      }),
    })
  } catch { /* ignore */ }

  return NextResponse.json({ ok: true })
}
