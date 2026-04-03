import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

type WeeklyJoin = {
  id?: string
  week_start?: string
  week_end?: string
  created_at?: string
} | null

type DetailRow = {
  settlement_id?: string
  rider_id?: string
  weekly_settlements?: WeeklyJoin
  [key: string]: unknown
}

type AdvanceRow = {
  id: string
  amount: number
  memo: string | null
  type: string
  deducted_settlement_id: string | null
}

function weekRank(d: DetailRow): number {
  const t = d.weekly_settlements?.created_at
  return t ? new Date(t).getTime() : 0
}

/** 동일 주차(week_start~week_end) 중복 시 최신 정산만 유지. 삭제된 weekly_settlements 조인 제거. */
function normalizeRiderSettlementDetails(raw: DetailRow[]): DetailRow[] {
  const valid = raw.filter((d) => d.weekly_settlements?.id)
  const byWeek = new Map<string, DetailRow>()
  for (const d of valid) {
    const w = d.weekly_settlements
    if (!w?.week_start || !w?.week_end) continue
    const key = `${w.week_start}\0${w.week_end}`
    const prev = byWeek.get(key)
    if (!prev || weekRank(d) > weekRank(prev)) {
      byWeek.set(key, d)
    } else if (prev && weekRank(d) === weekRank(prev)) {
      const sid = String(d.settlement_id ?? '')
      const psid = String(prev.settlement_id ?? '')
      if (sid > psid) byWeek.set(key, d)
    }
  }
  return Array.from(byWeek.values()).sort((a, b) =>
    String(b.weekly_settlements?.week_start ?? '').localeCompare(
      String(a.weekly_settlements?.week_start ?? ''),
    ),
  )
}

/**
 * GET /api/rider/settlements?rider_id=<uuid>
 * 라이더 포털(비인증)에서 정산 내역 + 선지급금/회수 내역 일괄 조회
 * - RLS 우회를 위해 admin client 사용 → 모바일 포함 모든 환경에서 동일하게 동작
 */
export async function GET(req: NextRequest) {
  try {
    const riderId = req.nextUrl.searchParams.get('rider_id')
    if (!riderId) {
      return NextResponse.json({ error: 'rider_id가 필요합니다.' }, { status: 400 })
    }

    let db: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>
    try {
      db = createAdminClient()
    } catch {
      db = await createClient()
    }

    const [detailsRes, advanceRes] = await Promise.all([
      db
        .from('settlement_details')
        .select('*, weekly_settlements(*)')
        .eq('rider_id', riderId),
      db
        .from('advance_payments')
        .select('id, amount, memo, type, deducted_settlement_id')
        .eq('rider_id', riderId)
        .not('deducted_settlement_id', 'is', null),
    ])

    const rawDetails = (detailsRes.data ?? []) as DetailRow[]
    const details = normalizeRiderSettlementDetails(rawDetails)

    const settlementIds = new Set(details.map((d) => String(d.settlement_id ?? '')).filter(Boolean))
    const rawAdvances = (advanceRes.data ?? []) as AdvanceRow[]
    const advances = rawAdvances.filter(
      (a) => a.deducted_settlement_id && settlementIds.has(a.deducted_settlement_id),
    )

    return NextResponse.json({
      details,
      advances,
    })
  } catch (err) {
    console.error('rider settlements error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 },
    )
  }
}
