/**
 * POST /api/settlement/recalculate
 * 로그인한 사업자(user_id) 기준 주간 정산 상세를 최신 설정으로 재계산합니다.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recalculateAllSettlementsForUser } from '@/lib/settlement/recalculate-user-settlements'
import { merchantSubscriptionAccessDenied } from '@/lib/subscription/merchant-subscription-access'

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const adminGate = createAdminClient()
    const { data: profile } = await adminGate
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    const denied = await merchantSubscriptionAccessDenied(adminGate, user.id, profile?.username)
    if (denied) return denied

    let onlySettlementId: string | undefined
    try {
      const body = (await req.json()) as { settlementId?: string }
      if (typeof body?.settlementId === 'string' && body.settlementId) {
        onlySettlementId = body.settlementId
      }
    } catch {
      /* body 없음 */
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
      { error: err instanceof Error ? err.message : '재계산 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
