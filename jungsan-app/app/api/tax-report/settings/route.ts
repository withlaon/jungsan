import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatSsn, type TaxReportMode } from '@/lib/tax-report/allocate'
import { readTaxSettings, writeTaxSettings, type StoredTaxSetting } from '@/lib/tax-report/settings-store'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: noStore })
  try {
    const settings = await enrichSourceNames(user.id, await readTaxSettings(user.id))
    return NextResponse.json({ settings }, { headers: noStore })
  } catch (err) {
    const message = err instanceof Error ? err.message : '세금신고 설정을 불러오지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 500, headers: noStore })
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: noStore })

  const body = await request.json().catch(() => null) as {
    rider_id?: string
    tax_name?: string | null
    tax_ssn?: string | null
    mode?: string
  } | null

  const riderId = body?.rider_id?.trim() ?? ''
  const mode: TaxReportMode = body?.mode === 'split' || body?.mode === 'exclude' ? body.mode : 'report'
  if (!riderId) return NextResponse.json({ error: '라이더가 필요합니다.' }, { status: 400, headers: noStore })

  const admin = createAdminClient()
  const { data: rider } = await admin.from('riders').select('id, user_id, name').eq('id', riderId).maybeSingle()
  if (!rider || (rider.user_id && rider.user_id !== user.id)) {
    return NextResponse.json({ error: '라이더를 찾을 수 없습니다.' }, { status: 404, headers: noStore })
  }

  const taxName = mode === 'report' ? (body?.tax_name ?? '').trim() : ''
  const ssnDigits = mode === 'report' ? (body?.tax_ssn ?? '').replace(/\D/g, '') : ''
  if (ssnDigits && ssnDigits.length !== 13) {
    return NextResponse.json({ error: '주민등록번호는 13자리여야 합니다.' }, { status: 400, headers: noStore })
  }

  let settings: StoredTaxSetting[]
  try {
    settings = await readTaxSettings(user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : '저장된 설정을 읽지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 500, headers: noStore })
  }
  const previous = settings.find((row) => row.rider_id === riderId)
  const nextRow: StoredTaxSetting = {
    id: riderId,
    rider_id: riderId,
    tax_name: taxName || null,
    tax_ssn: ssnDigits ? formatSsn(ssnDigits) : null,
    mode,
    source_name: rider.name?.trim() || previous?.source_name || null,
  }
  const next = settings.filter((row) => row.rider_id !== riderId)
  if (nextRow.mode !== 'report' || nextRow.tax_name || nextRow.tax_ssn) next.push(nextRow)

  try {
    await writeTaxSettings(user.id, next)
  } catch (err) {
    const message = err instanceof Error ? err.message : '저장에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500, headers: noStore })
  }

  return NextResponse.json({ setting: next.find((row) => row.rider_id === riderId) ?? null }, { headers: noStore })
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: noStore })
  const riderId = request.nextUrl.searchParams.get('rider_id')?.trim() ?? ''
  if (!riderId) return NextResponse.json({ error: '라이더가 필요합니다.' }, { status: 400, headers: noStore })

  try {
    const settings = await readTaxSettings(user.id)
    await writeTaxSettings(user.id, settings.filter((row) => row.rider_id !== riderId))
  } catch (err) {
    const message = err instanceof Error ? err.message : '삭제에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500, headers: noStore })
  }
  return NextResponse.json({ ok: true }, { headers: noStore })
}

async function enrichSourceNames(userId: string, settings: StoredTaxSetting[]) {
  const missing = settings.filter((row) => !row.source_name)
  if (missing.length === 0) return settings
  const admin = createAdminClient()
  const { data } = await admin.from('riders').select('id, name').in('id', missing.map((row) => row.rider_id))
  const names = new Map((data ?? []).map((row) => [row.id, row.name?.trim() || null]))
  const next = settings.map((row) => (
    row.source_name ? row : { ...row, source_name: names.get(row.rider_id) ?? null }
  ))
  if (next.some((row, index) => row.source_name !== settings[index]?.source_name)) {
    await writeTaxSettings(userId, next)
  }
  return next
}
