import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { formatSsn, type TaxReportMode } from '@/lib/tax-report/allocate'
import { readTaxSettings, writeTaxSettings, type StoredTaxSetting } from '@/lib/tax-report/settings-store'

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const settings = await readTaxSettings(user.id)
  return NextResponse.json({ settings })
}

export async function PUT(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    rider_id?: string
    tax_name?: string | null
    tax_ssn?: string | null
    mode?: string
  } | null

  const riderId = body?.rider_id?.trim() ?? ''
  const mode: TaxReportMode = body?.mode === 'split' || body?.mode === 'exclude' ? body.mode : 'report'
  if (!riderId) return NextResponse.json({ error: '라이더가 필요합니다.' }, { status: 400 })

  const admin = createAdminClient()
  const { data: rider } = await admin.from('riders').select('id, user_id').eq('id', riderId).maybeSingle()
  if (!rider || (rider.user_id && rider.user_id !== user.id)) {
    return NextResponse.json({ error: '라이더를 찾을 수 없습니다.' }, { status: 404 })
  }

  const taxName = mode === 'report' ? (body?.tax_name ?? '').trim() : ''
  const ssnDigits = mode === 'report' ? (body?.tax_ssn ?? '').replace(/\D/g, '') : ''
  if (ssnDigits && ssnDigits.length !== 13) {
    return NextResponse.json({ error: '주민등록번호는 13자리여야 합니다.' }, { status: 400 })
  }

  const settings = await readTaxSettings(user.id)
  const nextRow: StoredTaxSetting = {
    id: riderId,
    rider_id: riderId,
    tax_name: taxName || null,
    tax_ssn: ssnDigits ? formatSsn(ssnDigits) : null,
    mode,
  }
  const next = settings.filter((row) => row.rider_id !== riderId)
  if (nextRow.mode !== 'report' || nextRow.tax_name || nextRow.tax_ssn) next.push(nextRow)

  try {
    await writeTaxSettings(user.id, next)
  } catch (err) {
    const message = err instanceof Error ? err.message : '저장에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  return NextResponse.json({ setting: next.find((row) => row.rider_id === riderId) ?? null })
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  const riderId = request.nextUrl.searchParams.get('rider_id')?.trim() ?? ''
  if (!riderId) return NextResponse.json({ error: '라이더가 필요합니다.' }, { status: 400 })

  const settings = await readTaxSettings(user.id)
  try {
    await writeTaxSettings(user.id, settings.filter((row) => row.rider_id !== riderId))
  } catch (err) {
    const message = err instanceof Error ? err.message : '삭제에 실패했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
