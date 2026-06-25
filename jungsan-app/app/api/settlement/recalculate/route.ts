/**
 * POST /api/settlement/recalculate
 * 로그?�한 ?�업??user_id) 기�? 주간 ?�산 ?�세�?최신 ?�정?�로 ?�계?�합?�다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalculateAllSettlementsForUser } from '@/lib/settlement/recalculate-user-settlements'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그?�이 ?�요?�니??' }, { status: 401 })
    }

    const adminGate = createAdminClient()
    const { data: profile } = await adminGate
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    let onlySettlementId: string | undefined
    try {
      const body = (await req.json()) as { settlementId?: string }
      if (typeof body?.settlementId === 'string' && body.settlementId) {
        onlySettlementId = body.settlementId
      }
    } catch {
      /* body ?�음 */
    }

    const { recalculated, errors } = await recalculateAllSettlementsForUser(
      adminGate,
      user.id,
      onlySettlementId ?? null
    )

    return NextResponse.json({ recalculated, errors })
  } catch (err) {
    console.error('[settlement/recalculate]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : '?�계??�??�류가 발생?�습?�다.' },
      { status: 500 }
    )
  }
}
