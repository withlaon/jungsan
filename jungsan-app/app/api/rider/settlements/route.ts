import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

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

    // settlement_details + weekly_settlements 조인, advance_payments 병렬 조회
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

    return NextResponse.json({
      details: detailsRes.data ?? [],
      advances: advanceRes.data ?? [],
    })
  } catch (err) {
    console.error('rider settlements error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
