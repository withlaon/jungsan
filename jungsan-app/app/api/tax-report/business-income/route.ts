import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TaxReportLine } from '@/lib/tax-report/allocate'
import { buildBusinessIncomeWorkbook } from '@/lib/tax-report/business-income-workbook'

export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

  const body = await request.json().catch(() => null) as {
    month?: string
    lines?: { reportName?: string; ssn?: string; finalAmount?: number }[]
  } | null
  const month = body?.month?.trim() ?? ''
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: '신고월이 필요합니다.' }, { status: 400 })
  }
  const source = Array.isArray(body?.lines) ? body.lines.slice(0, 500) : []
  const lines: TaxReportLine[] = source
    .map((line) => ({
      sourceName: String(line?.reportName ?? '').trim(),
      reportName: String(line?.reportName ?? '').trim(),
      ssn: String(line?.ssn ?? ''),
      originalAmount: 0,
      distributed: 0,
      deducted: 0,
      finalAmount: Math.round(Number(line?.finalAmount) || 0),
      incomeTax: 0,
      localTax: 0,
      isJeong: false,
    }))
    .filter((line) => line.reportName && line.finalAmount > 0)

  if (lines.length === 0) {
    return NextResponse.json({ error: '신고할 내역이 없습니다.' }, { status: 400 })
  }

  const buffer = await buildBusinessIncomeWorkbook(lines, month)
  const [year, mon] = month.split('-')
  const filename = encodeURIComponent(`사업소득자료_윈드콜${year.slice(2)}년${mon}월.xlsx`)
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${filename}`,
      'Cache-Control': 'no-store',
    },
  })
}
