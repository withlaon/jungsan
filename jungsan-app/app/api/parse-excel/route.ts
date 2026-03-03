import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import type { ParsedRiderRow, ExcelSummary } from '@/lib/excel/baemin-parser'

// ── 숫자 변환 헬퍼 ──
function toNum(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  const n = parseInt(String(v ?? '0').replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : Math.abs(n)
}

// ── 특정 셀 숫자 값 추출 ──
function cellNum(sheet: XLSX.WorkSheet, ref: string): number {
  const cell = sheet[ref]
  if (!cell) return 0
  return toNum(cell.v)
}

// ── 갑지/을지 시트 이름 검색 ──
function findSheet(names: string[], keyword: string): string | undefined {
  return names.find(n => n.includes(keyword))
}

// ──────────────────────────────────────────────────────────────
// 배민 전용 파서: 갑지 + 을지 시트 구조
// ──────────────────────────────────────────────────────────────
function extractBaeminData(workbook: XLSX.WorkBook): {
  rows: ParsedRiderRow[]
  summary: ExcelSummary
  weekStart?: string
  weekEnd?: string
} | null {
  const gapjiName = findSheet(workbook.SheetNames, '갑지')
  const euljiName = findSheet(workbook.SheetNames, '을지')

  if (!euljiName) return null   // 을지 없으면 배민 형식 아님

  // ── 갑지: 정산예정금액(P25), 부가세액(C31) ──
  let summary: ExcelSummary = { settledAmount: 0, branchFee: 0, vatAmount: 0, employerEmploymentInsurance: 0, employerAccidentInsurance: 0 }
  if (gapjiName) {
    const g = workbook.Sheets[gapjiName]
    summary = {
      settledAmount:                  cellNum(g, 'P25'),
      branchFee:                      cellNum(g, 'F25'),
      vatAmount:                      cellNum(g, 'C31'),
      employerEmploymentInsurance:    cellNum(g, 'I25'),
      employerAccidentInsurance:      cellNum(g, 'K25'),
    }
  }

  // ── 을지: 20행부터 라이더 데이터 ──
  const e = workbook.Sheets[euljiName]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(e, { header: 1, defval: '' })

  const rows: ParsedRiderRow[] = []
  // 을지 시트 row 20 = 배열 index 19 (0-based)
  for (let i = 19; i < raw.length; i++) {
    const r = raw[i] as unknown[]
    const userId = String(r[1] ?? '').trim()   // B
    const name   = String(r[2] ?? '').trim()   // C
    if (!name && !userId) break                // 이름·ID 둘 다 없으면 데이터 끝
    if (!name) continue                        // 이름 없는 행 건너뜀

    const deliveryFee       = toNum(r[4])      // E  배달료
    const additionalPay     = toNum(r[5])      // F  추가지급
    const totalDeliveryFee  = toNum(r[6])      // G  총배달료

    rows.push({
      userId,
      name,
      deliveryCount:       toNum(r[3]),        // D  처리건수(=배달건수)
      deliveryFee,                             // E
      additionalPay,                           // F
      totalDeliveryFee,                        // G
      baseAmount: totalDeliveryFee,            // 정산 계산 기준 = 총배달료(G)
      hourlyInsurance:     toNum(r[7]),        // H  시간제보험료
      employmentInsurance: toNum(r[11]),       // L  고용보험
      accidentInsurance:   toNum(r[12]),       // M  산재보험
      settlementAmount:    toNum(r[21]),       // V  라이더별 정산금액
      withholdingTax:      toNum(r[24]),       // Y  원천징수액
      payAmount:           toNum(r[25]),       // Z  라이더별지급금액
    })
  }

  // 날짜 범위 추출 (시트 전체 텍스트에서)
  const csv = XLSX.utils.sheet_to_csv(e)
  const m   = csv.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})[^0-9]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/)
  return {
    rows,
    summary,
    weekStart: m?.[1].replace(/[./]/g, '-'),
    weekEnd:   m?.[2].replace(/[./]/g, '-'),
  }
}

// ──────────────────────────────────────────────────────────────
// 범용 파서 (갑지/을지 없는 일반 엑셀 폴백)
// ──────────────────────────────────────────────────────────────
const NAME_COLUMNS   = ['라이더명', '기사명', '이름', '성명', '라이더 이름', '배달원명', 'name', 'rider']
const COUNT_COLUMNS  = ['배달건수', '건수', '배달 건수', '배달횟수', '주문건수', 'count', 'delivery_count']
const AMOUNT_COLUMNS = ['정산금액', '배달금액', '수수료', '지급금액', '배달료', 'amount', 'settlement_amount', '합계금액', '총금액']

function findColIdx(headers: string[], candidates: string[]): number {
  const norm = headers.map(h => String(h).trim().replace(/\s+/g, ' '))
  for (const c of candidates) {
    const idx = norm.findIndex(h => h.includes(c) || c.includes(h))
    if (idx !== -1) return idx
  }
  return -1
}

function extractGenericData(workbook: XLSX.WorkBook): {
  rows: ParsedRiderRow[]
  summary: ExcelSummary
  weekStart?: string
  weekEnd?: string
} {
  const sheet = workbook.Sheets[workbook.SheetNames[0]]
  const raw   = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 })

  let headerRow = 0
  for (let i = 0; i < Math.min(raw.length, 10); i++) {
    const rowStr = (raw[i] as unknown[]).map(c => String(c ?? '')).join(' ')
    if (NAME_COLUMNS.some(col => rowStr.includes(col))) { headerRow = i; break }
  }

  const headers  = (raw[headerRow] as unknown[]).map(h => String(h ?? '').trim())
  const nameIdx  = findColIdx(headers, NAME_COLUMNS)
  const countIdx = findColIdx(headers, COUNT_COLUMNS)
  const amtIdx   = findColIdx(headers, AMOUNT_COLUMNS)

  const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number>>(sheet, { range: headerRow, defval: '' })
  const rows: ParsedRiderRow[] = []

  for (const row of jsonData) {
    const keys = Object.keys(row)
    const name = String(row[keys[nameIdx]] ?? '').trim()
    if (!name || name === headers[nameIdx]) continue
    const baseAmount    = amtIdx   >= 0 ? toNum(row[keys[amtIdx]])   : 0
    const deliveryCount = countIdx >= 0 ? toNum(row[keys[countIdx]]) : 0
    rows.push({
      userId: '', name, deliveryCount, baseAmount,
      deliveryFee: baseAmount, additionalPay: 0, totalDeliveryFee: baseAmount,
      hourlyInsurance: 0, employmentInsurance: 0, accidentInsurance: 0,
      settlementAmount: 0, withholdingTax: 0, payAmount: 0,
    })
  }

  const csv = XLSX.utils.sheet_to_csv(sheet)
  const m   = csv.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})[^0-9]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/)
  return { rows, summary: { settledAmount: 0, branchFee: 0, vatAmount: 0, employerEmploymentInsurance: 0, employerAccidentInsurance: 0 }, weekStart: m?.[1].replace(/[./]/g, '-'), weekEnd: m?.[2].replace(/[./]/g, '-') }
}

// ── 워크북에서 데이터 추출 (배민 형식 우선, 폴백) ──
function extractData(workbook: XLSX.WorkBook) {
  return extractBaeminData(workbook) ?? extractGenericData(workbook)
}

// ── 버퍼 파싱 시도 ──
function tryParse(buf: Buffer, password?: string) {
  try {
    const wb = XLSX.read(buf, { type: 'buffer', ...(password ? { password } : {}) })
    return extractData(wb)
  } catch {
    return null
  }
}

function isPasswordError(msg: string) {
  return /password|encrypted|cfb|PASSWD|Bad state|decrypt/i.test(msg)
}

function buildCandidates(rawBizNum: string): string[] {
  const digits  = rawBizNum.replace(/\D/g, '')
  const dashed  = digits.replace(/^(\d{3})(\d{2})(\d{5})$/, '$1-$2-$3')
  const original = rawBizNum.trim()
  return [...new Set([digits, dashed, original].filter(Boolean))]
}

async function decryptWithXlsxPopulate(buffer: Buffer, password: string): Promise<Buffer | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const XlsxPopulate = require('xlsx-populate') as {
      fromDataAsync: (data: Buffer, options?: { password?: string }) => Promise<{
        outputAsync: (options?: { password?: string }) => Promise<Buffer>
      }>
    }
    const workbook = await XlsxPopulate.fromDataAsync(buffer, { password })
    const plain    = await workbook.outputAsync()
    return Buffer.from(plain)
  } catch {
    return null
  }
}

// ──────────────────────────────────────────────────────────────
// POST 핸들러
// ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const formData  = await request.formData()
    const file      = formData.get('file') as File | null
    const rawBizNum = (formData.get('bizNum') as string | null) || ''

    if (!file) return NextResponse.json({ success: false, error: '파일이 없습니다.' })

    const buffer = Buffer.from(await file.arrayBuffer())

    // ── 1차: 비밀번호 없이 파싱 ──
    const plain = tryParse(buffer)
    if (plain) return NextResponse.json({ success: true, ...plain })

    // 암호화 여부 확인
    const plainErr = (() => {
      try { XLSX.read(buffer, { type: 'buffer' }); return '' }
      catch (e) { return e instanceof Error ? e.message : String(e) }
    })()

    if (!isPasswordError(plainErr)) {
      return NextResponse.json({ success: false, error: '파싱 실패: ' + plainErr })
    }

    // ── 비밀번호가 필요한 파일 ──
    const candidates = buildCandidates(rawBizNum)

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false, isPasswordRequired: true,
        error: '비밀번호가 필요한 파일입니다. 프로필에서 사업자등록번호를 확인해주세요.',
      })
    }

    for (const pwd of candidates) {
      // ── 2차: xlsx-populate AES-256 복호화 ──
      const decrypted = await decryptWithXlsxPopulate(buffer, pwd)
      if (decrypted) {
        const parsed = tryParse(decrypted)
        if (parsed) return NextResponse.json({ success: true, ...parsed })
      }

      // ── 3차: xlsx 내장 password 처리 ──
      const xlsxResult = tryParse(buffer, pwd)
      if (xlsxResult) return NextResponse.json({ success: true, ...xlsxResult })
    }

    return NextResponse.json({
      success: false, isPasswordRequired: true,
      error: '사업자등록번호로 파일을 열 수 없습니다. 파일 비밀번호와 사업자등록번호가 동일한지 확인해주세요.',
    })

  } catch (e) {
    return NextResponse.json({ success: false, error: '서버 오류: ' + (e instanceof Error ? e.message : String(e)) })
  }
}
