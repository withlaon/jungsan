import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/rider/advance-payments?rider_id=<uuid>
 * 라이더 포털(비인증)에서 선지급금/회수 내역 조회
 * - RLS 우회를 위해 admin client 사용
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

    const { data, error } = await db
      .from('advance_payments')
      .select('id, amount, memo, type, deducted_settlement_id')
      .eq('rider_id', riderId)
      .not('deducted_settlement_id', 'is', null)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data ?? [])
  } catch (err) {
    console.error('rider advance-payments error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
