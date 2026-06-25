/**
 * POST /api/cron/cleanup-inactive
 * 매일 새벽 3시 실행 - 비활성 회원 자동 탈퇴 및 데이터 삭제
 *
 * 삭제 조건:
 * 1. trial 만료 후 1개월 이상 미구독 (subscriptions.status = 'trial' AND trial_ends_at < now() - 1달)
 * 2. 구독 해제 후 1개월 이상 미재구독 (subscriptions.status = 'cancelled' AND cancelled_at < now() - 1달)
 *
 * 삭제 내용:
 * - settlement_details, advance_payments, promotions, management_fees,
 *   insurance_fees, weekly_settlements, riders, subscriptions, profiles
 * - auth.users 삭제 (ON DELETE CASCADE로 연관 데이터 자동 삭제)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

const CRON_SECRET = process.env.CRON_SECRET ?? ''
const IS_VERCEL = process.env.VERCEL === '1'

export async function POST(req: NextRequest) {
  // 보안 검증
  const authHeader = req.headers.get('authorization')
  if (CRON_SECRET) {
    if (authHeader !== `Bearer ${CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (IS_VERCEL) {
    // Vercel Cron 내부 호출은 허용
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now = new Date()
  // 1개월 전 기준일
  const oneMonthAgo = new Date(now)
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  const cutoff = oneMonthAgo.toISOString()

  try {
    // 삭제 대상 조회: trial 만료 1개월 초과 또는 cancelled 1개월 초과
    const { data: targets, error: fetchErr } = await admin
      .from('subscriptions')
      .select('user_id, status, trial_ends_at, cancelled_at')
      .or(
        `and(status.eq.trial,trial_ends_at.lt.${cutoff}),` +
        `and(status.eq.cancelled,cancelled_at.lt.${cutoff})`
      )

    if (fetchErr) {
      console.error('[cleanup-inactive] fetch error:', fetchErr.message)
      return NextResponse.json({ error: fetchErr.message }, { status: 500 })
    }

    if (!targets || targets.length === 0) {
      return NextResponse.json({ deleted: 0, message: '삭제 대상 없음' })
    }

    console.log(`[cleanup-inactive] 삭제 대상 ${targets.length}명`)

    const deleted: string[] = []
    const failed: string[] = []

    for (const target of targets) {
      const uid = target.user_id
      try {
        // 1. 라이더 관련 데이터 삭제 (settlement_details는 rider_id FK이므로 riders 삭제 전에)
        const { data: riderIds } = await admin
          .from('riders')
          .select('id')
          .eq('user_id', uid)

        if (riderIds && riderIds.length > 0) {
          const ids = riderIds.map(r => r.id)
          await admin.from('settlement_details').delete().in('rider_id', ids)
        }

        // 2. 주차별 정산 삭제
        const { data: weekIds } = await admin
          .from('weekly_settlements')
          .select('id')
          .eq('user_id', uid)

        if (weekIds && weekIds.length > 0) {
          const ids = weekIds.map(w => w.id)
          await admin.from('settlement_details').delete().in('settlement_id', ids)
        }

        // 3. 나머지 테이블 삭제
        await admin.from('advance_payments').delete().eq('user_id', uid)
        await admin.from('promotions').delete().eq('user_id', uid)
        await admin.from('management_fees').delete().eq('user_id', uid)
        await admin.from('insurance_fees').delete().eq('user_id', uid)
        await admin.from('weekly_settlements').delete().eq('user_id', uid)
        await admin.from('riders').delete().eq('user_id', uid)
        await admin.from('subscriptions').delete().eq('user_id', uid)
        await admin.from('profiles').delete().eq('id', uid)

        // 4. auth.users 삭제 (마지막)
        const { error: authErr } = await admin.auth.admin.deleteUser(uid)
        if (authErr) {
          console.error(`[cleanup-inactive] auth.deleteUser 실패 uid=${uid}:`, authErr.message)
          failed.push(uid)
        } else {
          deleted.push(uid)
          console.log(`[cleanup-inactive] 삭제 완료: uid=${uid} (${target.status})`)
        }
      } catch (e) {
        console.error(`[cleanup-inactive] uid=${uid} 처리 오류:`, e)
        failed.push(uid)
      }
    }

    return NextResponse.json({
      deleted: deleted.length,
      failed: failed.length,
      deletedIds: deleted,
    })
  } catch (err) {
    console.error('[cleanup-inactive] unexpected error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
