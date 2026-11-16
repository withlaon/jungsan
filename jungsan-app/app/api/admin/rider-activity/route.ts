import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { mergeRiderActivity } from '@/lib/riders/activity-store'

export const dynamic = 'force-dynamic'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: weeks, error } = await admin
    .from('weekly_settlements')
    .select('id, week_end')
    .eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const weekEnd = new Map((weeks ?? []).map((row) => [row.id as string, String(row.week_end ?? '').slice(0, 10)]))
  const updates: Record<string, string> = {}
  const ids = [...weekEnd.keys()]
  for (let offset = 0; offset < ids.length; offset += 50) {
    const chunk = ids.slice(offset, offset + 50)
    const { data, error: detailError } = await admin
      .from('settlement_details')
      .select('rider_id, settlement_id')
      .in('settlement_id', chunk)
    if (detailError) return NextResponse.json({ error: detailError.message }, { status: 500 })
    for (const row of data ?? []) {
      const riderId = row.rider_id as string | null
      const end = weekEnd.get(row.settlement_id as string)
      if (!riderId || !end || !/^\d{4}-\d{2}-\d{2}$/.test(end)) continue
      if (!updates[riderId] || updates[riderId] < end) updates[riderId] = end
    }
  }

  try {
    const lastSeen = await mergeRiderActivity(user.id, updates)
    return NextResponse.json({ lastSeen }, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return NextResponse.json({ lastSeen: updates }, { headers: { 'Cache-Control': 'no-store' } })
  }
}
