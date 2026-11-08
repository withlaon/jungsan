import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { allocateTaxReport, aggregateAmounts, normalizeRiderName } from '@/lib/tax-report/allocate'
import { buildTaxInputs } from '@/lib/tax-report/inputs'
import { readFilings, type StoredFiling } from '@/lib/tax-report/filings-store'
import { readTaxSettings } from '@/lib/tax-report/settings-store'

export const dynamic = 'force-dynamic'

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

  let settings
  try {
    settings = await readTaxSettings(user.id)
  } catch (err) {
    const message = err instanceof Error ? err.message : '세금신고 설정을 불러오지 못했습니다.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
  const inputs = buildTaxInputs(riderRows ?? [], settings)

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

  let filings: StoredFiling[]
  try {
    filings = await readFilings(user.id)
  } catch {
    filings = []
  }
  const savedReport = new Map(filings.map((filing) => [
    filing.month,
    {
      reportAmount: allocateTaxReport(aggregateAmounts(filing.files.flatMap((file) => file.rows)), inputs).finalTotal,
      supplyAmount: Math.max(0, Math.round(Number(filing.supplyAmount) || 0)),
      fileCount: filing.files.length,
    },
  ]))

  const months = [...buckets.entries()]
    .map(([month, bucket]) => {
      const calculated = allocateTaxReport(
        [...bucket.byRider.entries()].map(([name, amount]) => ({ name, amount })),
        inputs,
      ).finalTotal
      const saved = savedReport.get(month)
      const reportAmount = saved?.reportAmount ?? calculated
      const supplyAmount = bucket.weekCount > 0 ? bucket.supplyAmount : (saved?.supplyAmount ?? bucket.supplyAmount)
      savedReport.delete(month)
      return {
        month,
        supplyAmount,
        reportAmount,
        difference: supplyAmount - reportAmount,
        weekCount: bucket.weekCount,
        saved: saved != null,
      }
    })

  for (const [month, saved] of savedReport) {
    months.push({
      month,
      supplyAmount: saved.supplyAmount,
      reportAmount: saved.reportAmount,
      difference: saved.supplyAmount - saved.reportAmount,
      weekCount: saved.fileCount,
      saved: true,
    })
  }
  months.sort((a, b) => b.month.localeCompare(a.month))

  return NextResponse.json({ months }, { headers: { 'Cache-Control': 'no-store' } })
}
