import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { merchantSubscriptionAccessDenied } from '@/lib/subscription/merchant-subscription-access'

type AddRidersBody = {
  sourceFeeId?: string
  riderIds?: string[]
}

function feeGroupMatches(
  source: Record<string, unknown>,
  row: Record<string, unknown>
): boolean {
  return (
    source.fee_type === row.fee_type &&
    source.item_name === row.item_name &&
    source.amount === row.amount &&
    source.date_mode === row.date_mode &&
    (source.week_start ?? null) === (row.week_start ?? null) &&
    (source.deadline_date ?? null) === (row.deadline_date ?? null)
  )
}

/**
 * POST /api/admin/management-fees/add-riders
 * 기존 관리비 설정을 복사해 라이더별 관리비 행을 추가합니다.
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    let body: AddRidersBody
    try {
      body = (await req.json()) as AddRidersBody
    } catch {
      return NextResponse.json({ error: '요청 형식이 올바르지 않습니다.' }, { status: 400 })
    }

    const sourceFeeId = typeof body.sourceFeeId === 'string' ? body.sourceFeeId.trim() : ''
    const riderIds = Array.isArray(body.riderIds)
      ? [...new Set(body.riderIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : []

    if (!sourceFeeId) {
      return NextResponse.json({ error: '관리비 ID가 필요합니다.' }, { status: 400 })
    }
    if (riderIds.length === 0) {
      return NextResponse.json({ error: '추가할 라이더를 선택해주세요.' }, { status: 400 })
    }

    let db: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>
    try {
      db = createAdminClient()
    } catch {
      db = supabase
    }

    const { data: profile } = await db
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    const isGlobalAdmin = profile?.username?.toLowerCase() === 'admin'

    if (!isGlobalAdmin) {
      try {
        const adminForGate = createAdminClient()
        const denied = await merchantSubscriptionAccessDenied(adminForGate, user.id, profile?.username)
        if (denied) return denied
      } catch (gateErr) {
        console.error('[management-fees/add-riders] subscription gate error:', gateErr)
      }
    }

    const { data: source, error: sourceErr } = await db
      .from('management_fees')
      .select('*')
      .eq('id', sourceFeeId)
      .maybeSingle()

    if (sourceErr) {
      return NextResponse.json({ error: sourceErr.message }, { status: 500 })
    }
    if (!source) {
      return NextResponse.json({ error: '관리비 항목을 찾을 수 없습니다.' }, { status: 404 })
    }
    if (!isGlobalAdmin && source.user_id != null && source.user_id !== user.id) {
      return NextResponse.json({ error: '추가 권한이 없습니다.' }, { status: 403 })
    }

    const ownerUserId = source.user_id ?? user.id

    let riderQuery = db.from('riders').select('id').in('id', riderIds)
    if (!isGlobalAdmin) {
      riderQuery = riderQuery.eq('user_id', ownerUserId)
    }
    const { data: validRiders, error: riderErr } = await riderQuery
    if (riderErr) {
      return NextResponse.json({ error: riderErr.message }, { status: 500 })
    }
    const validIds = new Set((validRiders ?? []).map((r) => r.id))
    const allowedRiderIds = riderIds.filter((id) => validIds.has(id))
    if (allowedRiderIds.length === 0) {
      return NextResponse.json({ error: '선택한 라이더를 추가할 수 없습니다.' }, { status: 400 })
    }

    const { data: userFees, error: groupErr } = await db
      .from('management_fees')
      .select('id, rider_id, fee_type, item_name, amount, date_mode, week_start, deadline_date')
      .eq('user_id', ownerUserId)

    if (groupErr) {
      return NextResponse.json({ error: groupErr.message }, { status: 500 })
    }

    const sameGroupRows = (userFees ?? []).filter((row) => feeGroupMatches(source, row))
    const existingRiderIds = new Set(
      sameGroupRows.map((row) => row.rider_id).filter((id): id is string => Boolean(id))
    )
    const newRiderIds = allowedRiderIds.filter((id) => !existingRiderIds.has(id))
    if (newRiderIds.length === 0) {
      return NextResponse.json(
        { error: '선택한 라이더는 이미 모두 적용되어 있습니다.' },
        { status: 409 }
      )
    }

    const rows = newRiderIds.map((riderId) => ({
      user_id: ownerUserId,
      fee_type: source.fee_type,
      item_name: source.item_name,
      rider_id: riderId,
      amount: source.amount,
      date_mode: source.date_mode,
      week_start: source.week_start,
      deadline_date: source.deadline_date,
      memo: source.memo,
    }))

    const { data: inserted, error: insertErr } = await db
      .from('management_fees')
      .insert(rows)
      .select('id, rider_id')

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({
      inserted: inserted?.length ?? newRiderIds.length,
      riderIds: newRiderIds,
    })
  } catch (err) {
    console.error('[management-fees/add-riders]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
