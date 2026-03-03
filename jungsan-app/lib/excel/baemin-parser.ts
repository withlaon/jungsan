import * as XLSX from 'xlsx'

export interface ParsedRiderRow {
  userId: string          // User ID (B열)
  name: string            // 라이더명 (C열)
  deliveryCount: number   // 배달건수 (D열)
  baseAmount: number      // 총배달료 (G열) - 정산 계산 기준
  deliveryFee: number     // 배달료 (E열)
  additionalPay: number   // 추가지급 (F열)
  totalDeliveryFee: number   // 총배달료 (G열)
  hourlyInsurance: number    // 시간제보험료 (H열)
  employmentInsurance: number // 고용보험 (L열)
  accidentInsurance: number   // 산재보험 (M열)
  settlementAmount: number    // 라이더별 정산금액 (V열)
  withholdingTax: number      // 원천징수액 (Y열)
  payAmount: number           // 라이더별지급금액 (Z열)
  rawRow?: Record<string, string | number>
}

export interface ExcelSummary {
  settledAmount: number                  // 정산예정금액 (갑지 P25)
  branchFee: number                      // 지사관리비 (갑지 F25)
  vatAmount: number                      // 부가세액 (갑지 C31)
  employerEmploymentInsurance: number    // 고용보험사업주 (갑지 I25)
  employerAccidentInsurance: number      // 산재보험사업주 (갑지 K25)
}

export interface ParseResult {
  rows: ParsedRiderRow[]
  summary?: ExcelSummary
  headers: string[]
  rawData: Record<string, string | number>[]
  weekStart?: string
  weekEnd?: string
}

// 배달의민족 정산 엑셀의 가능한 컬럼명 목록
const NAME_COLUMNS = ['라이더명', '기사명', '이름', '성명', '라이더 이름', '배달원명', 'name', 'rider']
const COUNT_COLUMNS = ['배달건수', '건수', '배달 건수', '배달횟수', '주문건수', 'count', 'delivery_count']
const AMOUNT_COLUMNS = ['정산금액', '배달금액', '수수료', '지급금액', '배달료', 'amount', 'settlement_amount', '합계금액', '총금액']

function normalizeHeader(header: string): string {
  return String(header).trim().replace(/\s+/g, ' ')
}

function findColumn(headers: string[], candidates: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const candidate of candidates) {
    const idx = normalized.findIndex(h => h.includes(candidate) || candidate.includes(h))
    if (idx !== -1) return idx
  }
  return -1
}

export function parseBaeminExcel(file: ArrayBuffer, password?: string): ParseResult {
  // Uint8Array로 변환해야 암호화 파일도 정확히 처리됨
  const data = new Uint8Array(file)
  const workbook = XLSX.read(data, { type: 'array', ...(password ? { password } : {}) })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  const raw = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  // 헤더 행 찾기 (이름 컬럼이 있는 행)
  let headerRowIndex = 0
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const row = raw[i] as unknown[]
    const rowStr = row.map(c => String(c ?? '')).join(' ')
    if (NAME_COLUMNS.some(col => rowStr.includes(col))) {
      headerRowIndex = i
      break
    }
  }

  const headers = (raw[headerRowIndex] as unknown[]).map(h => String(h ?? '').trim())

  const nameIdx = findColumn(headers, NAME_COLUMNS)
  const countIdx = findColumn(headers, COUNT_COLUMNS)
  const amountIdx = findColumn(headers, AMOUNT_COLUMNS)

  const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, {
    range: headerRowIndex,
    defval: '',
  })

  const parsedRows: ParsedRiderRow[] = []

  for (const row of jsonData) {
    const nameKey = Object.keys(row)[nameIdx]
    const countKey = Object.keys(row)[countIdx]
    const amountKey = Object.keys(row)[amountIdx]

    const name = String(row[nameKey] ?? '').trim()
    if (!name || name === '' || name === headers[nameIdx]) continue

    const deliveryCount = countIdx >= 0 ? parseInt(String(row[countKey] ?? '0').replace(/[^0-9]/g, '')) || 0 : 0
    const baseAmount = amountIdx >= 0 ? parseInt(String(row[amountKey] ?? '0').replace(/[^0-9]/g, '')) || 0 : 0

    if (name) {
      parsedRows.push({
        userId: '', name, deliveryCount, baseAmount,
        deliveryFee: baseAmount, additionalPay: 0, totalDeliveryFee: baseAmount,
        hourlyInsurance: 0, employmentInsurance: 0, accidentInsurance: 0,
        settlementAmount: 0, withholdingTax: 0, payAmount: 0,
        rawRow: row,
      })
    }
  }

  // 주차 날짜 추출 시도 (셀 내용에서)
  let weekStart: string | undefined
  let weekEnd: string | undefined

  const fullText = XLSX.utils.sheet_to_csv(sheet)
  const dateRangeMatch = fullText.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})[^0-9]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/)
  if (dateRangeMatch) {
    weekStart = dateRangeMatch[1].replace(/[./]/g, '-')
    weekEnd = dateRangeMatch[2].replace(/[./]/g, '-')
  }

  return {
    rows: parsedRows,
    headers,
    rawData: jsonData,
    weekStart,
    weekEnd,
  }
}

export function detectColumnMapping(headers: string[]): {
  nameIndex: number
  countIndex: number
  amountIndex: number
} {
  return {
    nameIndex: findColumn(headers, NAME_COLUMNS),
    countIndex: findColumn(headers, COUNT_COLUMNS),
    amountIndex: findColumn(headers, AMOUNT_COLUMNS),
  }
}
