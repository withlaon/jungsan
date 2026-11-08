import * as XLSX from 'xlsx'
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

function setCell(ws: XLSX.WorkSheet, row: number, col: number, value: string | number | null) {
  const addr = XLSX.utils.encode_cell({ r: row, c: col })
  if (value == null || value === '') {
    delete ws[addr]
    return
  }
  if (typeof value === 'number') {
    ws[addr] = { t: 'n', v: value }
    return
  }
  ws[addr] = { t: 's', v: value }
}

export async function downloadBusinessIncomeFile(lines: TaxReportLine[], month: string) {
  const response = await fetch('/templates/business-income-blank.xls')
  if (!response.ok) throw new Error('세무사 제출 양식을 불러오지 못했습니다.')
  const template = await response.arrayBuffer()
  const workbook = XLSX.read(template, { type: 'array' })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:O3')
  const lastRow = Math.max(range.e.r, 3 + lines.length)

  for (let row = 3; row <= lastRow; row++) {
    for (let col = 0; col <= 14; col++) delete sheet[XLSX.utils.encode_cell({ r: row, c: col })]
  }

  const belong = attributionLabel(month)
  const paidOn = paymentDateLabel(month)
  lines.forEach((line, index) => {
    const row = 3 + index
    const digits = ssnDigits(line.ssn)
    const flag = domesticForeignFlag(digits)
    setCell(sheet, row, 0, index + 1)
    setCell(sheet, row, 1, belong)
    setCell(sheet, row, 2, paidOn)
    setCell(sheet, row, 3, line.reportName)
    setCell(sheet, row, 4, digits ? Number(digits) : null)
    setCell(sheet, row, 7, '퀵서비스')
    setCell(sheet, row, 9, line.finalAmount)
    if (flag != null) setCell(sheet, row, 13, flag)
  })

  sheet['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(range.e.r, 3 + lines.length - 1), c: Math.max(range.e.c, 255) },
  })

  const [year, mon] = month.split('-')
  XLSX.writeFile(workbook, `사업소득자료_윈드콜${year.slice(2)}년${mon}월.xls`, { bookType: 'xls' })
}
