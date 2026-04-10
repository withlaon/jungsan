import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { merchantSubscriptionAccessDenied } from '@/lib/subscription/merchant-subscription-access'
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
function extractBaeminData(workbook: XLSX.WorkBook, isWindcall = false): {
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
      // windcall 전용: 갑지 N열 고용보험소급정산 → 지사 순이익에만 표시 (정산 미적용)
      ...(isWindcall ? { insuranceRefund: cellNum(g, 'N25') } : {}),
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

    // D열 처리건수가 0이거나 "-"(미배달)인 라이더는 정산 제외
    const rawDeliveryCount = String(r[3] ?? '').trim()
    const deliveryCount    = toNum(r[3])
    if (rawDeliveryCount === '-' || deliveryCount <= 0) continue

    const deliveryFee       = toNum(r[4])      // E  배달료
    const additionalPay     = toNum(r[5])      // F  추가지급
    const totalDeliveryFee  = toNum(r[6])      // G  총배달료

    // ── windcall 전용: 을지 P(15)/Q(16)/R(17)열 소급정산 → 기사별 정산에서 완전 제외 ──
    // P, Q, R열 값은 0원으로 처리(읽지 않음). L/M열 값만 그대로 사용.
    // (다른 아이디는 이 로직 미적용 — isWindcall = false)
    rows.push({
      userId,
      name,
      deliveryCount,                           // D  처리건수(=배달건수)
      deliveryFee,                             // E
      additionalPay,                           // F
      totalDeliveryFee,                        // G
      baseAmount: totalDeliveryFee,            // 정산 계산 기준 = 총배달료(G)
      hourlyInsurance:     toNum(r[7]),        // H  시간제보험료
      employmentInsurance: toNum(r[11]),       // L  고용보험 (P열 소급정산 미적용)
      accidentInsurance:   toNum(r[12]),       // M  산재보험 (Q/R열 소급정산 미적용)
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
const NAME_COLUMNS   = ['라이더명', '기사명', '기사이름', '기사 이름', '이름', '성명', '라이더 이름', '배달원명', 'name', 'rider']
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

// ──────────────────────────────────────────────────────────────
// 쿠팡이츠 파서: 주문별 데이터 → 기사별 집계
// ──────────────────────────────────────────────────────────────

// 쿠팡이츠 파일 감지 — 여러 조건 중 하나라도 충족하면 쿠팡이츠로 판단
function isCoupangSheet(headers: string[]): boolean {
  const norm = headers.map(h => String(h).replace(/[\s\t\r\n]/g, ''))
  const hasRiderName   = norm.some(h => h.includes('기사이름') || h.includes('라이더이름') || h.includes('기사명'))
  const hasFee         = norm.some(h => h.includes('픽업비용') || h.includes('배달비용'))
  const hasOrderNum    = norm.some(h => h.includes('주문번호'))
  const hasFinalAmt    = norm.some(h => h.includes('최종정산금액'))
  const hasSurcharge   = norm.some(h =>
    h.includes('픽업지할증') || h.includes('도착지할증') ||
    h.includes('배달거리할증') || h.includes('기상할증')
  )

  if (hasRiderName && (hasFee || hasOrderNum || hasSurcharge || hasFinalAmt)) return true
  if (hasFinalAmt && (hasOrderNum || hasFee)) return true
  if (hasFee && hasOrderNum) return true
  return false
}

// 종합 시트 감지: "라이선스ID" 또는 "라이선스" 컬럼이 있는 시트
function isCoupangSummarySheet(headers: string[]): boolean {
  const norm = headers.map(h => String(h).replace(/[\s\t\r\n]/g, ''))
  return norm.some(h => h.includes('라이선스') || h.includes('라이선스ID') || h.includes('licenseId') || h.includes('license'))
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

  // ── 1단계: 종합 시트에서 라이선스ID ↔ 기사이름 매핑 구성 ──
  // 종합 시트에서 "라이선스ID" 컬럼을 찾아 { 기사이름 → 라이선스ID } 맵 구성
  const licenseMap = new Map<string, string>() // key: 기사이름(normalized), value: 라이선스ID

  for (const sheetName of workbook.SheetNames) {
    const isSummaryByName = sheetName.includes('종합') || sheetName.includes('집계') || sheetName.toLowerCase().includes('summary')
    const sheet = workbook.Sheets[sheetName]
    const raw   = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

    // 헤더 행 탐색
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const row = (raw[i] as unknown[]).map(h => String(h ?? '').trim())
      if (!isCoupangSummarySheet(row)) continue

      const norm = row.map(h => h.replace(/[\s\t\r\n]/g, ''))
      const licIdx  = norm.findIndex(h => h.includes('라이선스') || h.toLowerCase().includes('license'))
      const nameIdx = norm.findIndex(h => h.includes('기사이름') || h.includes('기사명') || h.includes('라이더이름') || h.includes('이름'))

      if (licIdx === -1) break

      // 데이터 행 순회
      for (let j = i + 1; j < raw.length; j++) {
        const dRow    = raw[j] as unknown[]
        const licId   = String(dRow[licIdx] ?? '').trim()
        const name    = nameIdx !== -1 ? String(dRow[nameIdx] ?? '').trim() : ''
        if (!licId) continue
        // 이름 → 라이선스ID 매핑 (이름이 없으면 라이선스ID 자체를 이름으로 간주)
        const key = (name || licId).replace(/\s/g, '').toLowerCase()
        licenseMap.set(key, licId)
      }

      // 종합 시트 처리 완료
      if (!isSummaryByName) break
    }
  }

  // ── 2단계: 주문별 시트에서 기사별 집계 ──
  let resultRows: ParsedRiderRow[] | null = null
  let resultWeekStart: string | undefined
  let resultWeekEnd: string | undefined
  let resultDebugHeaders: string[] | undefined

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName]
    const raw   = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' })

    // 헤더 행 탐색 — 최대 30행까지 (타이틀/빈 행 대비)
    let headerRowIdx = -1
    let headers: string[] = []
    for (let i = 0; i < Math.min(raw.length, 30); i++) {
      const row = (raw[i] as unknown[]).map(h => String(h ?? '').trim())
      if (row.filter(Boolean).length < 3) continue  // 3개 미만 컬럼이면 스킵
      if (isCoupangSheet(row)) { headerRowIdx = i; headers = row; break }
    }
    if (headerRowIdx === -1) continue

    // 컬럼 인덱스 헬퍼 (공백 제거 후 부분 매칭)
    const norm = headers.map(h => h.replace(/[\s\t\r\n]/g, ''))
    const ci = (...keys: string[]): number => {
      for (const k of keys) {
        const kn  = k.replace(/\s/g, '')
        const idx = norm.findIndex(h => h === kn || h.includes(kn) || kn.includes(h))
        if (idx !== -1) return idx
      }
      return -1
    }

    // 이름 컬럼: 넓은 후보군
    let nameIdx = ci('기사이름', '라이더이름', '기사명', '라이더명', '이름', '기사', '라이더')
    // 그래도 없으면 첫 번째 비어있지 않은 문자열 컬럼 추정
    if (nameIdx === -1) {
      for (let col = 0; col < headers.length; col++) {
        if (headers[col].trim()) { nameIdx = col; break }
      }
    }
    if (nameIdx === -1) continue

    // 주문별 시트에 라이선스ID 컬럼이 있으면 추가 수집
    const licIdxInOrder = ci('라이선스ID', '라이선스', 'licenseId', 'license')

    const finalAmtIdx  = ci('최종정산금액', '정산금액', '최종금액')
    const pickupFeeIdx = ci('픽업비용', '픽업료')
    const delivFeeIdx  = ci('배달비용', '배달료')
    const regionIdx    = ci('지역단가')
    const distIdx      = ci('배달거리할증', '거리할증')
    const pickupSurIdx = ci('픽업지할증')
    const destSurIdx   = ci('도착지할증')
    const weatherIdx   = ci('기상할증')
    const promo1Idx    = ci('기타프로모션1', '프로모션1')
    const promo2Idx    = ci('기타프로모션2', '프로모션2')
    const promo3Idx    = ci('기타프로모션3', '프로모션3')
    const promo4Idx    = ci('기타프로모션4', '프로모션4')

    // 금액 컬럼 중 하나라도 있어야 의미 있는 데이터
    const hasAnyAmtCol = [finalAmtIdx, pickupFeeIdx, delivFeeIdx, regionIdx, distIdx].some(x => x !== -1)

    // 기사별 집계 (기사이름 → { count, amount, licenseId })
    const riderMap = new Map<string, { deliveryCount: number; totalAmount: number; licenseId: string }>()
    const SKIP_NAMES = new Set(['합계', '소계', '총계', '합산', '전체', 'total', 'sum'])

    for (let i = headerRowIdx + 1; i < raw.length; i++) {
      const row  = raw[i] as unknown[]
      const name = String(row[nameIdx] ?? '').trim()
      if (!name) continue
      if (SKIP_NAMES.has(name.toLowerCase())) continue  // 합계 행 제외

      // 주문별 시트에서 라이선스ID 추출 (있으면)
      const rowLicId = licIdxInOrder !== -1 ? String(row[licIdxInOrder] ?? '').trim() : ''
      if (rowLicId) {
        const nameNorm = name.replace(/\s/g, '').toLowerCase()
        if (!licenseMap.has(nameNorm)) licenseMap.set(nameNorm, rowLicId)
      }

      // 주문별 정산금액: 최종정산금액 컬럼 우선, 없으면 항목 합산
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

    // 종합 시트에서 구축한 licenseMap 으로 userId 보강
    const rows: ParsedRiderRow[] = Array.from(riderMap.entries()).map(([name, data]) => {
      const nameNorm = name.replace(/\s/g, '').toLowerCase()
      const licenseId = data.licenseId || licenseMap.get(nameNorm) || ''
      return {
        userId:              licenseId,   // 라이선스ID → userId 로 매핑에 활용
        name,
        deliveryCount:       data.deliveryCount,
        baseAmount:          data.totalAmount,
        deliveryFee:         data.totalAmount,
        additionalPay:       0,
        totalDeliveryFee:    data.totalAmount,
        hourlyInsurance:     0,
        employmentInsurance: 0,   // 계산기에서 0.9%로 계산
        accidentInsurance:   0,   // 계산기에서 0.7%로 계산
        settlementAmount:    data.totalAmount,
        withholdingTax:      0,
        payAmount:           0,
      }
    })

    const csv = XLSX.utils.sheet_to_csv(sheet)
    const m   = csv.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})[^0-9]*(\d{4}[-./]\d{1,2}[-./]\d{1,2})/)

    // 여러 시트가 감지되면 가장 많은 라이더가 있는 시트 사용
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

// ── 워크북에서 데이터 추출 (배민 → 쿠팡이츠 → 범용 폴백) ──
function extractData(workbook: XLSX.WorkBook, isWindcall = false) {
  // 디버그: 모든 시트의 첫 행 헤더 수집 (어떤 파서도 감지 못할 경우 원인 파악용)
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

// ── 버퍼 파싱 시도 ──
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

// ──────────────────────────────────────────────────────────────
// POST 핸들러
// ──────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ success: false, error: '로그인이 필요합니다.' }, { status: 401 })
    }
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    const denied = await merchantSubscriptionAccessDenied(admin, user.id, profile?.username)
    if (denied) {
      const body = await denied.json().catch(() => ({}))
      const msg = typeof (body as { error?: string }).error === 'string'
        ? (body as { error: string }).error
        : '이용할 수 없습니다.'
      return NextResponse.json({ success: false, error: msg }, { status: denied.status })
    }

    const formData    = await request.formData()
    const file        = formData.get('file') as File | null
    const rawBizNum   = (formData.get('bizNum') as string | null) || ''
    // windcall 아이디 전용 파싱 규칙 (갑지 N열 소급정산 + 을지 P/Q/R 소급정산 제외)
    const isWindcall  = (formData.get('windcallMode') as string | null) === 'true'

    if (!file) return NextResponse.json({ success: false, error: '파일이 없습니다.' })

    const buffer = Buffer.from(await file.arrayBuffer())

    // ── 1차: 비밀번호 없이 파싱 ──
    const plain = tryParse(buffer, undefined, isWindcall)
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
        const parsed = tryParse(decrypted, undefined, isWindcall)
        if (parsed) return NextResponse.json({ success: true, ...parsed })
      }

      // ── 3차: xlsx 내장 password 처리 ──
      const xlsxResult = tryParse(buffer, pwd, isWindcall)
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
