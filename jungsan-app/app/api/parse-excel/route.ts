import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import * as XLSX from 'xlsx'
import type { ParsedRiderRow, ExcelSummary } from '@/lib/excel/baemin-parser'

// 숫자 변환 유틸
function toNum(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  const n = parseInt(String(v ?? '0').replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : Math.abs(n)
}

// 셀 주소로 숫자 값 추출
function cellNum(sheet: XLSX.WorkSheet, ref: string): number {
  const cell = sheet[ref]
  if (!cell) return 0
  return toNum(cell.v)
}

// 시트명에 키워드 포함 여부 검색
function findSheet(names: string[], keyword: string): string | undefined {
  return names.find(n => n.includes(keyword))
}

// 배민 파싱: 갑지 + 을지 시트 파싱
function extractBaeminData(workbook: XLSX.WorkBook, isWindcall = false): {
  rows: ParsedRiderRow[]
  summary: ExcelSummary
  weekStart?: string
  weekEnd?: string
} | null {
  const gapjiName = findSheet(workbook.SheetNames, '갑지')
  const euljiName = findSheet(workbook.SheetNames, '을지')

  if (!euljiName) return null

  let summary: ExcelSummary = { settledAmount: 0, branchFee: 0, vatAmount: 0, employerEmploymentInsurance: 0, employerAccidentInsurance: 0 }
  if (gapjiName) {
    const g = workbook.Sheets[gapjiName]
    summary = {
      settledAmount:                  cellNum(g, 'P25'),
      branchFee:                      cellNum(g, 'F25'),
      vatAmount:                      cellNum(g, 'C31'),
      employerEmploymentInsurance:    cellNum(g, 'I25'),
      employerAccidentInsurance:      cellNum(g, 'K25'),
      ...(isWindcall ? { insuranceRefund: cellNum(g, 'N25') } : {}),
    }
  }

  const e = workbook.Sheets[euljiName]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(e, { header: 1, defval: '' })

  const rows: ParsedRiderRow[] = []
  for (let i = 19; i < raw.length; i++) {
    const r = raw[i] as unknown[]
    const userId = String(r[1] ?? '').trim()
    const name   = String(r[2] ?? '').trim()
    if (!name && !userId) break
    if (!name) continue

    const rawDeliveryCount = String(r[3] ?? '').trim()
    const deliveryCount    = toNum(r[3])
    if (rawDeliveryCount === '-' || deliveryCount <= 0) continue

    const deliveryFee       = toNum(r[4])
    const additionalPay     = toNum(r[5])
    const totalDeliveryFee  = toNum(r[6])

    rows.push({
      userId,
      name,
      deliveryCount,
      deliveryFee,
      additionalPay,
      totalDeliveryFee,
      baseAmount: totalDeliveryFee,
      hourlyInsurance:     toNum(r[7]),
      employmentInsurance: toNum(r[11]),
      accidentInsurance:   toNum(r[12]),
      settlementAmount:    toNum(r[21]),
      withholdingTax:      toNum(r[24]),
      payAmount:           toNum(r[25]),
    })
  }

  const csv = XLSX.utils.sheet_to_csv(e)
  const m   = csv.match(/(\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2})[^0-9]*(\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2})/)
  return {
    rows,
    summary,
    weekStart: m?.[1].replace(/[.\/]/g, '-'),
    weekEnd:   m?.[2].replace(/[.\/]/g, '-'),
  }
}

// 일반 형식 (헤더 기반 자동 감지)
const NAME_COLUMNS   = ['라이더명', '기사명', '배달원명', '기사 명', '이름', '성명', '라이더 명', '배달기사', 'name', 'rider']
const COUNT_COLUMNS  = ['배달건수', '건수', '처리 건수', '처리건수', '배달수', 'count', 'delivery_count']
const AMOUNT_COLUMNS = ['정산금액', '지급금액', '지급액', '최종금액', '배달비', 'amount', 'settlement_amount', '실수령액', '지급']

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
  const m   = csv.match(/(\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2})[^0-9]*(\d{4}[-.\/]\d{1,2}[-.\/]\d{1,2})/)
  return {
    rows,
    summary: { settledAmount: 0, branchFee: 0, vatAmount: 0, employerEmploymentInsurance: 0, employerAccidentInsurance: 0 },
    weekStart: m?.[1].replace(/[.\/]/g, '-'),
    weekEnd:   m?.[2].replace(/[.\/]/g, '-'),
  }
}

// 배민 파일 파싱 후 일반 형식으로 fallback
function extractData(workbook: XLSX.WorkBook, isWindcall = false) {
  const debugAllSheets = workbook.SheetNames.map(name => {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '' })
    const firstNonEmpty = (raw as unknown[][]).find(r => r.filter(Boolean).length > 2)
    return { sheet: name, headers: (firstNonEmpty ?? []).slice(0, 20).map(h => String(h ?? '').trim()) }
  })

  const baemin = extractBaeminData(workbook, isWindcall)
  if (baemin) return { ...baemin, detectedPlatform: 'baemin', debugAllSheets }
  const generic = extractGenericData(workbook)
  return { ...generic, detectedPlatform: 'baemin', debugAllSheets }
}

// 암호화 파일 파싱 시도
function tryParse(buf: Buffer, password?: string, isWindcall = false) {
  try {
    const wb = XLSX.read(buf, { type: 'buffer', ...(password ? { password } : {}) })
    return extractData(wb, isWindcall)
  } catch {
    return null
  }
}

function isPasswordError(msg: string) {
  return /password|encrypted|cfb|PASSWD|Bad state|decrypt/i.test(msg)
}

function buildCandidates(rawBizNum: string): string[] {
  const digits  = rawBizNum.replace(/\D/g, '')
  const dashed  = digits.replace(/^(\d{3})(\d{2})(\d{5})$/, '--')
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

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const formData   = await request.formData()
    const file       = formData.get('file') as File | null
    const rawBizNum  = (formData.get('bizNum') as string | null) || ''
    const isWindcall = (formData.get('windcallMode') as string | null) === 'true'

    if (!file) return NextResponse.json({ success: false, error: '파일이 없습니다.' })

    const buffer = Buffer.from(await file.arrayBuffer())

    const plain = tryParse(buffer, undefined, isWindcall)
    if (plain) return NextResponse.json({ success: true, ...plain })

    const plainErr = (() => {
      try { XLSX.read(buffer, { type: 'buffer' }); return '' }
      catch (e) { return e instanceof Error ? e.message : String(e) }
    })()

    if (!isPasswordError(plainErr)) {
      return NextResponse.json({ success: false, error: '파싱 오류: ' + plainErr })
    }

    const candidates = buildCandidates(rawBizNum)

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false, isPasswordRequired: true,
        error: '파일이 암호화되어 있습니다. 사업자번호를 프로필에 등록해 주세요.',
      })
    }

    for (const pwd of candidates) {
      const decrypted = await decryptWithXlsxPopulate(buffer, pwd)
      if (decrypted) {
        const parsed = tryParse(decrypted, undefined, isWindcall)
        if (parsed) return NextResponse.json({ success: true, ...parsed })
      }

      const xlsxResult = tryParse(buffer, pwd, isWindcall)
      if (xlsxResult) return NextResponse.json({ success: true, ...xlsxResult })
    }

    return NextResponse.json({
      success: false, isPasswordRequired: true,
      error: '비밀번호로 복호화할 수 없습니다. 올바른 사업자번호가 등록되어 있는지 확인해 주세요.',
    })

  } catch (e) {
    return NextResponse.json({ success: false, error: '서버 오류: ' + (e instanceof Error ? e.message : String(e)) })
  }
}
