import type { TaxReportLine } from '@/lib/tax-report/allocate'

export function attributionLabel(month: string): string {
  const [year, mon] = month.split('-')
  return `${year}.${mon}`
}

/** 선택한 신고월의 마지막 날. 2026-09 → 2026.09.30, 2026-11 → 2026.11.30 */
export function paymentDateLabel(month: string): string {
  const [yearText, monthText] = month.split('-')
  const year = Number(yearText)
  const mon = Number(monthText)
  const last = new Date(year, mon, 0).getDate()
  return `${year}.${monthText}.${String(last).padStart(2, '0')}`
}

export function ssnDigits(ssn: string | null | undefined): string {
  return (ssn ?? '').replace(/\D/g, '')
}

/**
 * 주민등록번호 7번째 자리.
 * 1·2·3·4 내국인 → 0, 5·6·7·8 외국인 → 1.
 */
export function domesticForeignFlag(ssn: string | null | undefined): 0 | 1 | null {
  const seventh = ssnDigits(ssn)[6]
  if (seventh === '1' || seventh === '2' || seventh === '3' || seventh === '4') return 0
  if (seventh === '5' || seventh === '6' || seventh === '7' || seventh === '8') return 1
  return null
}

export function filePeriod(fileName: string, period: string | null): { start: string; end: string } | null {
  const source = `${fileName} ${period ?? ''}`
  const match = source.match(/(20\d{2}-\d{2}-\d{2})\D+(20\d{2}-\d{2}-\d{2})/)
  if (!match) return null
  return { start: match[1], end: match[2] }
}

export function periodOverlapsMonth(start: string, end: string, month: string): boolean {
  const monthStart = `${month}-01`
  const [yearText, monthText] = month.split('-')
  const last = new Date(Number(yearText), Number(monthText), 0).getDate()
  const monthEnd = `${month}-${String(last).padStart(2, '0')}`
  return start <= monthEnd && end >= monthStart
}

export async function downloadBusinessIncomeFile(lines: TaxReportLine[], month: string) {
  const response = await fetch('/api/tax-report/business-income', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      month,
      lines: lines.map((line) => ({
        reportName: line.reportName,
        ssn: line.ssn,
        finalAmount: line.finalAmount,
      })),
    }),
  })
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(typeof data.error === 'string' ? data.error : '파일 생성에 실패했습니다.')
  }
  const blob = await response.blob()
  const [year, mon] = month.split('-')
  const filename = `사업소득자료_윈드콜${year.slice(2)}년${mon}월.xlsx`
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
