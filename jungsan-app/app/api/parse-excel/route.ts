import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import * as XLSX from 'xlsx'
import type { ParsedRiderRow, ExcelSummary } from '@/lib/excel/baemin-parser'

// ?? ?? ?? ?? ??
function toNum(v: unknown): number {
  if (typeof v === 'number') return Math.round(v)
  const n = parseInt(String(v ?? '0').replace(/[^0-9.-]/g, ''))
  return isNaN(n) ? 0 : Math.abs(n)
}

// ?? ?? ? ?? ? ?? ??
function cellNum(sheet: XLSX.WorkSheet, ref: string): number {
  const cell = sheet[ref]
  if (!cell) return 0
  return toNum(cell.v)
}

// ?? ??/?? ?? ?? ?? ??
function findSheet(names: string[], keyword: string): string | undefined {
  return names.find(n => n.includes(keyword))
}

// ??????????????????????????????????????????????????????????????
// ?? ?? ??: ?? + ?? ?? ??
// ??????????????????????????????????????????????????????????????
function extractBaeminData(workbook: XLSX.WorkBook, isWindcall = false): {
  rows: ParsedRiderRow[]
  summary: ExcelSummary
  weekStart?: string
  weekEnd?: string
} | null {
  const gapjiName = findSheet(workbook.SheetNames, '??')
  const euljiName = findSheet(workbook.SheetNames, '??')

  if (!euljiName) return null   // ?? ??? ?? ?? ??

  // ?? ??: ??????(P25), ????(C31) ??
  let summary: ExcelSummary = { settledAmount: 0, branchFee: 0, vatAmount: 0, employerEmploymentInsurance: 0, employerAccidentInsurance: 0 }
  if (gapjiName) {
    const g = workbook.Sheets[gapjiName]
    summary = {
      settledAmount:                  cellNum(g, 'P25'),
      branchFee:                      cellNum(g, 'F25'),
      vatAmount:                      cellNum(g, 'C31'),
      employerEmploymentInsurance:    cellNum(g, 'I25'),
      employerAccidentInsurance:      cellNum(g, 'K25'),
      // windcall ??: ?? N? ???????? ? ?? ????? ?? (?? ???)
      ...(isWindcall ? { insuranceRefund: cellNum(g, 'N25') } : {}),
    }
  }

  // ?? ??: 20??? ??? ??? ??
  const e = workbook.Sheets[euljiName]
  const raw = XLSX.utils.sheet_to_json<unknown[]>(e, { header: 1, defval: '' })

  const rows: ParsedRiderRow[] = []
  // ?? ?? row 20 = ?? index 19 (0-based)
  for (let i = 19; i < raw.length; i++) {
    const r = raw[i] as unknown[]
    const userId = String(r[1] ?? '').trim()   // B
    const name   = String(r[2] ?? '').trim()   // C
    if (!name && !userId) break                // ??텶D ? ? ??? ??? ?
    if (!name) continue                        // ?? ?? ? ???

    // D? ????? 0??? "-"(???)? ???? ?? ??
    const rawDeliveryCount = String(r[3] ?? '').trim()
    const deliveryCount    = toNum(r[3])
    if (rawDeliveryCount === '-' || deliveryCount <= 0) continue

    const deliveryFee       = toNum(r[4])      // E  ???
    const additionalPay     = toNum(r[5])      // F  ????
    const totalDeliveryFee  = toNum(r[6])      // G  ????

    // ?? windcall ??: ?? P(15)/Q(16)/R(17)? ???? ? ??? ???? ?? ?? ??
    // P, Q, R? ?? 0??? ??(?? ??). L/M? ?? ??? ??.
    // (?? ???? ? ?? ??? ? isWindcall = false)
    rows.push({
      userId,
      name,
      deliveryCount,                           // D  ????(=????)
      deliveryFee,                             // E
      additionalPay,                           // F
      totalDeliveryFee,                        // G
      baseAmount: totalDeliveryFee,            // ?? ?? ?? = ????(G)
      hourlyInsurance:     toNum(r[7]),        // H  ??????
      employmentInsurance: toNum(r[11]),       // L  ???? (P? ???? ???)
      accidentInsurance:   toNum(r[12]),       // M  ???? (Q/R? ???? ???)
      settlementAmount:    toNum(r[21]),       // V  ???? ????
      withholdingTax:      toNum(r[24]),       // Y  ?????
      payAmount:           toNum(r[25]),       // Z  ????????
    })
  }

  // ?? ?? ?? (?? ?? ?????)
  const csv = XLSX.utils.sheet_to_csv(e)
  const m   = csv.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})[^0-9]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/)
  return {
    rows,
    summary,
    weekStart: m?.[1].replace(/[./]/g, '-'),
    weekEnd:   m?.[2].replace(/[./]/g, '-'),
  }
}

// ??????????????????????????????????????????????????????????????
// ?? ?? (??/?? ?? ?? ?? ??)
// ??????????????????????????????????????????????????????????????
const NAME_COLUMNS   = ['????', '???', '????', '?? ??', '??', '??', '??? ??', '????', 'name', 'rider']
const COUNT_COLUMNS  = ['????', '??', '?? ??', '????', '????', 'count', 'delivery_count']
const AMOUNT_COLUMNS = ['????', '????', '???', '????', '???', 'amount', 'settlement_amount', '????', '???']

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

// ??????????????????????????????????????????????????????????????
// ???? ??: ??? ??? ? ??? ??
// ??????????????????????????????????????????????????????????????

// ???? ?? ?? ? ?? ?? ? ???? ???? ????? ??
function isCoupangSheet(headers: string[]): boolean {
  const norm = headers.map(h => String(h).replace(/[\s\t\r\n]/g, ''))
  const hasRiderName   = norm.some(h => h.includes('????') || h.includes('?????') || h.includes('???'))
  const hasFee         = norm.some(h => h.includes('????') || h.includes('????'))
  const hasOrderNum    = norm.some(h => h.includes('????'))
  const hasFinalAmt    = norm.some(h => h.includes('??????'))
  const hasSurcharge   = norm.some(h =>
    h.includes('?????') || h.includes('?????') ||
    h.includes('??????') || h.includes('????')
  )

  if (hasRiderName && (hasFee || hasOrderNum || hasSurcharge || hasFinalAmt)) return true
  if (hasFinalAmt && (hasOrderNum || hasFee)) return true
  if (hasFee && hasOrderNum) return true
  return false
}

// ?? ?? ??: "????ID" ?? "????" ??? ?? ??
function isCoupangSummarySheet(headers: string[]): boolean {
  const norm = headers.map(h => String(h).replace(/[\s\t\r\n]/g, ''))
  return norm.some(h => h.includes('????') || h.includes('????ID') || h.includes('licenseId') || h.includes('license'))
}

function extractCoupangData(workbook: XLSX.WorkBook): {
  rows: ParsedRiderRow[]
  summary: ExcelSummary
  weekStart?: string
  weekEnd?: string
  debugHeaders?: string[]
} | null {
  const emptySum: ExcelSummary = {
    settledAmount: 0, branchFee: 0, vatAmount: 0,
    employerEmploymentInsurance: 0, employerAccidentInsurance: 0,
  }

  // ?? 1??: ?? ???? ????ID ? ???? ?? ?? ??
  // ?? ???? "????ID" ??? ?? { ???? ? ????ID } ? ??
  const licenseMap = new Map<string, string>() // key: ????(normalized), value: ????ID

  for (const sheetName of workbook.SheetNames) {
    const isSummaryByName = sheetName.includes('??') || sheetName.includes('??') || sheetName.toLowerCase().includes('summary')
    const sheet = workbook.Sheets[sheetName]
    const raw   = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

    // ?? ? ??
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const row = (raw[i] as unknown[]).map(h => String(h ?? '').trim())
      if (!isCoupangSummarySheet(row)) continue

      const norm = row.map(h => h.replace(/[\s\t\r\n]/g, ''))
      const licIdx  = norm.findIndex(h => h.includes('????') || h.toLowerCase().includes('license'))
      const nameIdx = norm.findIndex(h => h.includes('????') || h.includes('???') || h.includes('?????') || h.includes('??'))

      if (licIdx === -1) break

      // ??? ? ??
      for (let j = i + 1; j < raw.length; j++) {
        const dRow    = raw[j] as unknown[]
        const licId   = String(dRow[licIdx] ?? '').trim()
        const name    = nameIdx !== -1 ? String(dRow[nameIdx] ?? '').trim() : ''
        if (!licId) continue
        // ?? ? ????ID ?? (??? ??? ????ID ??? ???? ??)
        const key = (name || licId).replace(/\s/g, '').toLowerCase()
        licenseMap.set(key, licId)
      }

      // ?? ?? ?? ??
      if (!isSummaryByName) break
    }
  }

  // ?? 2??: ??? ???? ??? ?? ??
  let resultRows: ParsedRiderRow[] | null = null
  let resultWeekStart: string | undefined
  let resultWeekEnd: string | undefined
  let resultDebugHeaders: string[] | undefined

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const raw   = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

    // ?? ? ?? ? ?? 30??? (???/? ? ??)
    let headerRowIdx = -1
    let headers: string[] = []
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const row = (raw[i] as unknown[]).map(h => String(h ?? '').trim())
      if (row.filter(Boolean).length < 3) continue  // 3? ?? ???? ??
      if (isCoupangSheet(row)) { headerRowIdx = i; headers = row; break }
    }
    if (headerRowIdx === -1) continue

    // ?? ??? ?? (?? ?? ? ?? ??)
    const norm = headers.map(h => h.replace(/[\s\t\r\n]/g, ''))
    const ci = (...keys: string[]): number => {
      for (const k of keys) {
        const kn  = k.replace(/\s/g, '')
        const idx = norm.findIndex(h => h === kn || h.includes(kn) || kn.includes(h))
        if (idx !== -1) return idx
      }
      return -1
    }

    // ?? ??: ?? ???
    let nameIdx = ci('????', '?????', '???', '????', '??', '??', '???')
    // ??? ??? ? ?? ???? ?? ??? ?? ??
    if (nameIdx === -1) {
      for (let col = 0; col < headers.length; col++) {
        if (headers[col].trim()) { nameIdx = col; break }
      }
    }
    if (nameIdx === -1) continue

    // ??? ??? ????ID ??? ??? ?? ??
    const licIdxInOrder = ci('????ID', '????', 'licenseId', 'license')

    const finalAmtIdx  = ci('??????', '????', '????')
    const pickupFeeIdx = ci('????', '???')
    const delivFeeIdx  = ci('????', '???')
    const regionIdx    = ci('????')
    const distIdx      = ci('??????', '????')
    const pickupSurIdx = ci('?????')
    const destSurIdx   = ci('?????')
    const weatherIdx   = ci('????')
    const promo1Idx    = ci('??????1', '????1')
    const promo2Idx    = ci('??????2', '????2')
    const promo3Idx    = ci('??????3', '????3')
    const promo4Idx    = ci('??????4', '????4')

    // ?? ?? ? ???? ??? ?? ?? ???
    const hasAnyAmtCol = [finalAmtIdx, pickupFeeIdx, delivFeeIdx, regionIdx, distIdx].some(x => x !== -1)

    // ??? ?? (???? ? { count, amount, licenseId })
    const riderMap = new Map<string, { deliveryCount: number; totalAmount: number; licenseId: string }>()
    const SKIP_NAMES = new Set(['??', '??', '??', '??', '??', 'total', 'sum'])

    for (let i = headerRowIdx + 1; i < raw.length; i++) {
      const row  = raw[i] as unknown[]
      const name = String(row[nameIdx] ?? '').trim()
      if (!name) continue
      if (SKIP_NAMES.has(name.toLowerCase())) continue  // ?? ? ??

      // ??? ???? ????ID ?? (???)
      const rowLicId = licIdxInOrder !== -1 ? String(row[licIdxInOrder] ?? '').trim() : ''
      if (rowLicId) {
        const nameNorm = name.replace(/\s/g, '').toLowerCase()
        if (!licenseMap.has(nameNorm)) licenseMap.set(nameNorm, rowLicId)
      }

      // ??? ????: ?????? ?? ??, ??? ?? ??
      let orderAmt: number
      if (finalAmtIdx !== -1 && toNum(row[finalAmtIdx]) > 0) {
        orderAmt = toNum(row[finalAmtIdx])
      } else if (hasAnyAmtCol) {
        const cols = [pickupFeeIdx, delivFeeIdx, regionIdx, distIdx,
                      pickupSurIdx, destSurIdx, weatherIdx,
                      promo1Idx, promo2Idx, promo3Idx, promo4Idx]
        orderAmt = cols.filter(x => x !== -1).reduce((s, idx) => s + toNum(row[idx]), 0)
      } else {
        let lastNum = 0
        for (let c = row.length - 1; c >= 0; c--) {
          const v = toNum(row[c])
          if (v > 0) { lastNum = v; break }
        }
        orderAmt = lastNum
      }

      const existing = riderMap.get(name)
      if (existing) {
        riderMap.set(name, {
          ...existing,
          deliveryCount: existing.deliveryCount + 1,
          totalAmount:   existing.totalAmount   + orderAmt,
        })
      } else {
        riderMap.set(name, { deliveryCount: 1, totalAmount: orderAmt, licenseId: rowLicId })
      }
    }

    if (riderMap.size === 0) continue

    // ?? ???? ??? licenseMap ?? userId ??
    const rows: ParsedRiderRow[] = Array.from(riderMap.entries()).map(([name, data]) => {
      const nameNorm = name.replace(/\s/g, '').toLowerCase()
      const licenseId = data.licenseId || licenseMap.get(nameNorm) || ''
      return {
        userId:              licenseId,   // ????ID ? userId ? ??? ??
        name,
        deliveryCount:       data.deliveryCount,
        baseAmount:          data.totalAmount,
        deliveryFee:         data.totalAmount,
        additionalPay:       0,
        totalDeliveryFee:    data.totalAmount,
        hourlyInsurance:     0,
        employmentInsurance: 0,   // ????? 0.9%? ??
        accidentInsurance:   0,   // ????? 0.7%? ??
        settlementAmount:    data.totalAmount,
        withholdingTax:      0,
        payAmount:           0,
      }
    })

    const csv = XLSX.utils.sheet_to_csv(sheet)
    const m   = csv.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})[^0-9]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/)

    // ?? ??? ???? ?? ?? ???? ?? ?? ??
    if (!resultRows || rows.length > resultRows.length) {
      resultRows         = rows
      resultWeekStart    = m?.[1].replace(/[./]/g, '-')
      resultWeekEnd      = m?.[2].replace(/[./]/g, '-')
      resultDebugHeaders = headers.slice(0, 25)
    }
  }

  if (!resultRows || resultRows.length === 0) return null

  return {
    rows:         resultRows,
    summary:      emptySum,
    weekStart:    resultWeekStart,
    weekEnd:      resultWeekEnd,
    debugHeaders: resultDebugHeaders,
  }
}

// ?? ????? ??? ?? (?? ? ???? ? ?? ??) ??
function extractData(workbook: XLSX.WorkBook, isWindcall = false) {
  // ???: ?? ??? ? ? ?? ?? (?? ??? ?? ?? ?? ?? ???)
  const debugAllSheets = workbook.SheetNames.map(name => {
    const raw = XLSX.utils.sheet_to_json<unknown[]>(workbook.Sheets[name], { header: 1, defval: '' })
    const firstNonEmpty = (raw as unknown[][]).find(r => r.filter(Boolean).length > 2)
    return { sheet: name, headers: (firstNonEmpty ?? []).slice(0, 20).map(h => String(h ?? '').trim()) }
  })

  const baemin  = extractBaeminData(workbook, isWindcall)
  if (baemin)  return { ...baemin,  detectedPlatform: 'baemin',  debugAllSheets }
  const coupang = extractCoupangData(workbook)
  if (coupang) return { ...coupang, detectedPlatform: 'coupang', debugAllSheets }
  const generic = extractGenericData(workbook)
  return { ...generic, detectedPlatform: 'unknown', debugAllSheets }
}

// ?? ?? ?? ?? ??
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

// ??????????????????????????????????????????????????????????????
// POST ???
// ??????????????????????????????????????????????????????????????
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '???? ?????.' }, { status: 401 })
    }
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    const formData    = await request.formData()
    const file        = formData.get('file') as File | null
    const rawBizNum   = (formData.get('bizNum') as string | null) || ''
    // windcall ??? ?? ?? ?? (?? N? ???? + ?? P/Q/R ???? ??)
    const isWindcall  = (formData.get('windcallMode') as string | null) === 'true'

    if (!file) return NextResponse.json({ success: false, error: '??? ????.' })

    const buffer = Buffer.from(await file.arrayBuffer())

    // ?? 1?: ???? ?? ?? ??
    const plain = tryParse(buffer, undefined, isWindcall)
    if (plain) return NextResponse.json({ success: true, ...plain })

    // ??? ?? ??
    const plainErr = (() => {
      try { XLSX.read(buffer, { type: 'buffer' }); return '' }
      catch (e) { return e instanceof Error ? e.message : String(e) }
    })()

    if (!isPasswordError(plainErr)) {
      return NextResponse.json({ success: false, error: '?? ??: ' + plainErr })
    }

    // ?? ????? ??? ?? ??
    const candidates = buildCandidates(rawBizNum)

    if (candidates.length === 0) {
      return NextResponse.json({
        success: false, isPasswordRequired: true,
        error: '????? ??? ?????. ????? ???????? ??????.',
      })
    }

    for (const pwd of candidates) {
      // ?? 2?: xlsx-populate AES-256 ??? ??
      const decrypted = await decryptWithXlsxPopulate(buffer, pwd)
      if (decrypted) {
        const parsed = tryParse(decrypted, undefined, isWindcall)
        if (parsed) return NextResponse.json({ success: true, ...parsed })
      }

      // ?? 3?: xlsx ?? password ?? ??
      const xlsxResult = tryParse(buffer, pwd, isWindcall)
      if (xlsxResult) return NextResponse.json({ success: true, ...xlsxResult })
    }

    return NextResponse.json({
      success: false, isPasswordRequired: true,
      error: '???????? ??? ? ? ????. ?? ????? ???????? ???? ??????.',
    })

  } catch (e) {
    return NextResponse.json({ success: false, error: '?? ??: ' + (e instanceof Error ? e.message : String(e)) })
  }
}
