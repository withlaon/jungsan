import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allocateTaxReport, normalizeRiderName, type RiderTaxInput } from '@/lib/tax-report/allocate'
import { readTaxSettings } from '@/lib/tax-report/settings-store'

interface DetailRow {
  settlement_id: string
  tax_base_amount: number | null
  riders: { name: string | null } | null
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const admin = createAdminClient()
  const { data: settlements, error: settlementError } = await admin
    .from('weekly_settlements')
    .select('id, week_end, vat_amount')
    .eq('user_id', user.id)
  if (settlementError) return NextResponse.json({ error: settlementError.message }, { status: 500 })

  const rows = settlements ?? []
  const details: DetailRow[] = []
  const ids = rows.map((row) => row.id)
  for (let offset = 0; offset < ids.length; offset += 50) {
    const chunk = ids.slice(offset, offset + 50)
    const { data, error } = await admin
      .from('settlement_details')
      .select('settlement_id, tax_base_amount, riders(name)')
      .in('settlement_id', chunk)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    details.push(...((data ?? []) as unknown as DetailRow[]))
  }

  const { data: riderRows, error: riderError } = await admin
    .from('riders')
    .select('id, name, id_number')
    .eq('user_id', user.id)
  if (riderError) return NextResponse.json({ error: riderError.message }, { status: 500 })

  const settings = await readTaxSettings(user.id)
  const inputs: RiderTaxInput[] = (riderRows ?? []).map((rider) => {
    const setting = settings.find((item) => item.rider_id === rider.id)
    return {
      sourceName: rider.name,
      mode: setting?.mode === 'split' || setting?.mode === 'exclude' ? setting.mode : 'report',
      taxName: setting?.tax_name ?? null,
      taxSsn: setting?.tax_ssn ?? null,
      originalSsn: rider.id_number,
    }
  })

  const monthOf = new Map(
    rows
      .map((row) => [row.id, String(row.week_end ?? '').slice(0, 7)] as const)
      .filter((entry) => /^\d{4}-\d{2}$/.test(entry[1])),
  )
  const buckets = new Map<string, { supplyAmount: number; weekCount: number; byRider: Map<string, number> }>()
  const ensure = (month: string) => {
    let bucket = buckets.get(month)
    if (!bucket) {
      bucket = { supplyAmount: 0, weekCount: 0, byRider: new Map() }
      buckets.set(month, bucket)
    }
    return bucket
  }

  for (const row of rows) {
    const month = String(row.week_end ?? '').slice(0, 7)
    if (!/^\d{4}-\d{2}$/.test(month)) continue
    const bucket = ensure(month)
    bucket.weekCount += 1
    bucket.supplyAmount += Math.round(Number(row.vat_amount ?? 0) * 10)
  }

  for (const detail of details) {
    const month = monthOf.get(detail.settlement_id)
    const name = normalizeRiderName(detail.riders?.name ?? '')
    if (!month || !name) continue
    const bucket = ensure(month)
    bucket.byRider.set(name, (bucket.byRider.get(name) ?? 0) + Math.round(Number(detail.tax_base_amount ?? 0)))
  }

  const months = [...buckets.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([month, bucket]) => {
      const reportAmount = allocateTaxReport(
        [...bucket.byRider.entries()].map(([name, amount]) => ({ name, amount })),
        inputs,
      ).finalTotal
      return {
        month,
        supplyAmount: bucket.supplyAmount,
        reportAmount,
        difference: bucket.supplyAmount - reportAmount,
        weekCount: bucket.weekCount,
      }
    })

  return NextResponse.json({ months })
}
