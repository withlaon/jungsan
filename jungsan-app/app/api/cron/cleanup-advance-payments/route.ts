/**
 * POST /api/cron/cleanup-advance-payments
 * 매일 새벽 4시 실행 - 공제완료 후 3일 경과한 선지급금·회수 내역 자동 삭제
 *
 * 삭제 조건:
 * - deducted_at IS NOT NULL (공제완료)
 * - deducted_at < now() - 3일
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const IS_VERCEL = process.env.VERCEL === '1'

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
    const cutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()

    const { data: targets, error: fetchErr } = await admin
      .from('advance_payments')
      .select('id, type, deducted_at')
      .not('deducted_at', 'is', null)
      .lt('deducted_at', cutoff)

    if (fetchErr) {
      console.error('[cleanup-advance-payments] 조회 오류:', fetchErr.message)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!targets || targets.length === 0) {
      return NextResponse.json({ deleted: 0, message: '삭제 대상 없음' })
    }

    const ids = targets.map(t => t.id)
    const { error: delErr } = await admin
      .from('advance_payments')
      .delete()
      .in('id', ids)

    if (delErr) {
      console.error('[cleanup-advance-payments] 삭제 오류:', delErr.message)
      return NextResponse.json({ error: delErr.message }, { status: 500 })
    }

    console.log(`[cleanup-advance-payments] ${ids.length}건 삭제 완료`)
    return NextResponse.json({ deleted: ids.length, deletedIds: ids })
  } catch (err) {
    console.error('[cleanup-advance-payments] 예상치 못한 오류:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
