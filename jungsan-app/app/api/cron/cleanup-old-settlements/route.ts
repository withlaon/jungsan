/**
 * POST /api/cron/cleanup-old-settlements
 * 매일 새벽 3시 실행 - 4주(28일) 이전 정산 데이터 자동 삭제
 *
 * 삭제 순서:
 * 1. settlement_details (weekly_settlements FK 참조)
 * 2. advance_payments.deducted_settlement_id 초기화
 * 3. promotions.settlement_id 초기화
 * 4. weekly_settlements 삭제
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const IS_VERCEL = process.env.VERCEL === '1'
const KEEP_WEEKS = 4

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET) {
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (!IS_VERCEL) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const admin = createAdminClient()
    const cutoff = new Date(Date.now() - KEEP_WEEKS * 7 * 24 * 60 * 60 * 1000).toISOString()

    // 4주 이전 정산 조회
    const { data: oldSettlements, error: fetchErr } = await admin
      .from('weekly_settlements')
      .select('id')
      .lt('week_end', cutoff)

    if (fetchErr) {
      console.error('[cleanup-old-settlements] 조회 오류:', fetchErr.message)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!oldSettlements || oldSettlements.length === 0) {
      return NextResponse.json({ deleted: 0, message: '삭제 대상 없음' })
    }

    const ids = oldSettlements.map(s => s.id)
    console.log(`[cleanup-old-settlements] 삭제 대상 ${ids.length}건`)

    // 1. settlement_details 삭제
    const { error: detailErr } = await admin
      .from('settlement_details')
      .delete()
      .in('settlement_id', ids)
    if (detailErr) console.warn('[cleanup-old-settlements] settlement_details 삭제 경고:', detailErr.message)

    // 2. advance_payments.deducted_settlement_id 초기화
    const { error: advErr } = await admin
      .from('advance_payments')
      .update({ deducted_settlement_id: null, deducted_at: null })
      .in('deducted_settlement_id', ids)
    if (advErr) console.warn('[cleanup-old-settlements] advance_payments 초기화 경고:', advErr.message)

    // 3. promotions.settlement_id 초기화
    const { error: promoErr } = await admin
      .from('promotions')
      .update({ settlement_id: null })
      .in('settlement_id', ids)
    if (promoErr) console.warn('[cleanup-old-settlements] promotions 초기화 경고:', promoErr.message)

    // 4. weekly_settlements 삭제
    const { error: settleErr } = await admin
      .from('weekly_settlements')
      .delete()
      .in('id', ids)
    if (settleErr) {
      console.error('[cleanup-old-settlements] weekly_settlements 삭제 오류:', settleErr.message)
      return NextResponse.json({ error: settleErr.message }, { status: 500 })
    }

    console.log(`[cleanup-old-settlements] ${ids.length}건 삭제 완료`)
    return NextResponse.json({ deleted: ids.length })
  } catch (err) {
    console.error('[cleanup-old-settlements] 예상치 못한 오류:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
