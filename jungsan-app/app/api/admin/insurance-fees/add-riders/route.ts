import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type AddRidersBody = {
  sourceFeeId?: string
  riderIds?: string[]
}

function insGroupMatches(
  source: Record<string, unknown>,
  row: Record<string, unknown>
): boolean {
  return (
    source.employment_fee === row.employment_fee &&
    source.accident_fee === row.accident_fee &&
    source.date_mode === row.date_mode &&
    (source.week_start ?? null) === (row.week_start ?? null) &&
    (source.deadline_date ?? null) === (row.deadline_date ?? null)
  )
}

/**
 * POST /api/admin/insurance-fees/add-riders
 * 기존 고용?�재 관리비 ?�정??복사???�이?�별 ?�을 추�??�니??
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그?�이 ?�요?�니??' }, { status: 401 })
    }

    let body: AddRidersBody
    try {
      body = (await req.json()) as AddRidersBody
    } catch {
      return NextResponse.json({ error: '?�청 ?�식???�바르�? ?�습?�다.' }, { status: 400 })
    }

    const sourceFeeId = typeof body.sourceFeeId === 'string' ? body.sourceFeeId.trim() : ''
    const riderIds = Array.isArray(body.riderIds)
      ? [...new Set(body.riderIds.filter((id): id is string => typeof id === 'string' && id.length > 0))]
      : []

    if (!sourceFeeId) {
      return NextResponse.json({ error: '관리비 ID가 ?�요?�니??' }, { status: 400 })
    }
    if (riderIds.length === 0) {
      return NextResponse.json({ error: '추�????�이?��? ?�택?�주?�요.' }, { status: 400 })
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
      } catch (gateErr) {
        console.error('[insurance-fees/add-riders] subscription gate error:', gateErr)
      }
    }

    const { data: source, error: sourceErr } = await db
      .from('insurance_fees')
      .select('*')
      .eq('id', sourceFeeId)
      .maybeSingle()

    if (sourceErr) {
      return NextResponse.json({ error: sourceErr.message }, { status: 500 })
    }
    if (!source) {
      return NextResponse.json({ error: '고용?�재 관리비 ??��??찾을 ???�습?�다.' }, { status: 404 })
    }
    if (!isGlobalAdmin && source.user_id != null && source.user_id !== user.id) {
      return NextResponse.json({ error: '추�? 권한???�습?�다.' }, { status: 403 })
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
      return NextResponse.json({ error: '?�택???�이?��? 추�??????�습?�다.' }, { status: 400 })
    }

    const { data: userFees, error: groupErr } = await db
      .from('insurance_fees')
      .select('id, rider_id, employment_fee, accident_fee, date_mode, week_start, deadline_date')
      .eq('user_id', ownerUserId)

    if (groupErr) {
      return NextResponse.json({ error: groupErr.message }, { status: 500 })
    }

    const sameGroupRows = (userFees ?? []).filter((row) => insGroupMatches(source, row))
    const existingRiderIds = new Set(
      sameGroupRows.map((row) => row.rider_id).filter((id): id is string => Boolean(id))
    )
    const newRiderIds = allowedRiderIds.filter((id) => !existingRiderIds.has(id))
    if (newRiderIds.length === 0) {
      return NextResponse.json(
        { error: '?�택???�이?�는 ?��? 모두 ?�용?�어 ?�습?�다.' },
        { status: 409 }
      )
    }

    const rows = newRiderIds.map((riderId) => ({
      user_id: ownerUserId,
      rider_id: riderId,
      employment_fee: source.employment_fee,
      accident_fee: source.accident_fee,
      date_mode: source.date_mode,
      week_start: source.week_start,
      deadline_date: source.deadline_date,
      memo: source.memo,
    }))

    const { data: inserted, error: insertErr } = await db
      .from('insurance_fees')
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
    console.error('[insurance-fees/add-riders]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
