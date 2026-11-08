import * as XLSX from 'xlsx'
import { normalizeRiderName } from '@/lib/tax-report/allocate'

export interface ParsedSettlementFile {
  fileName: string
  sheetName: string
  period: string | null
  rows: { name: string; amount: number }[]
  error?: string
}

function cellText(value: unknown): string {
  if (value == null) return ''
  return String(value).replace(/\s+/g, ' ').trim()
}

function cellAmount(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.round(value)
  if (typeof value === 'string') {
    const n = Number(value.replace(/,/g, '').trim())
    if (Number.isFinite(n)) return Math.round(n)
  }
  return null
}

export function parseSettlementWorkbook(data: ArrayBuffer, fileName: string): ParsedSettlementFile {
  const wb = XLSX.read(data, { type: 'array' })
  const sheetName = wb.SheetNames.includes('전체정산') ? '전체정산' : wb.SheetNames[0]
  const ws = sheetName ? wb.Sheets[sheetName] : undefined
  if (!ws || !sheetName) {
    return { fileName, sheetName: '', period: null, rows: [], error: '시트를 찾지 못했습니다.' }
  }

  const grid = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null, raw: true })
  const headerIdx = grid.findIndex((row, i) => {
    if (i > 20 || !Array.isArray(row)) return false
    return row.some((cell) => cellText(cell) === '라이더명')
  })
  if (headerIdx < 0) {
    return {
      fileName,
      sheetName,
      period: null,
      rows: [],
      error: '라이더명 헤더를 찾지 못했습니다. 정산결과보기에서 받은 주간 정산 엑셀을 올려 주세요.',
    }
  }

  const header = grid[headerIdx] as unknown[]
  const nameCol = Math.max(0, header.findIndex((cell) => cellText(cell) === '라이더명'))
  const labeledAmountCol = header.findIndex((cell) => cellText(cell).replace(/\s/g, '') === '세금신고금액')
  const amountCol = labeledAmountCol >= 0 ? labeledAmountCol : 15

  let period: string | null = null
  for (let i = 0; i < headerIdx; i++) {
    const row = grid[i]
    if (!Array.isArray(row)) continue
    const text = row.map(cellText).find((v) => v.includes('정산'))
    if (text) {
      period = text
      break
    }
  }

  const rows: { name: string; amount: number }[] = []
  for (let i = headerIdx + 1; i < grid.length; i++) {
    const row = grid[i]
    if (!Array.isArray(row)) continue
    const name = normalizeRiderName(cellText(row[nameCol]))
    if (!name || name === '합계') continue
    const amount = cellAmount(row[amountCol])
    if (amount == null || amount === 0) continue
    rows.push({ name, amount })
  }

  return { fileName, sheetName, period, rows }
}
