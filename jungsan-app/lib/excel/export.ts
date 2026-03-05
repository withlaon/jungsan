import * as XLSX from 'xlsx'
import { SettlementDetail, Rider, WeeklySettlement } from '@/types'

type DetailWithRider = SettlementDetail & { riders: Rider }

// ── 은행코드 매핑 (금융결제원 기준 3자리) ──
const BANK_CODES: Record<string, string> = {
  'KDB산업은행': '002', '산업은행': '002',
  'IBK기업은행': '003', '기업은행': '003',
  'KB국민은행': '004', '국민은행': '004',
  '수협은행': '007', '수협': '007',
  'NH농협은행': '011', '농협은행': '011', '농협': '011',
  '단위농협': '012',
  '우리은행': '020', '우리': '020',
  'SC제일은행': '023', 'SC은행': '023',
  '씨티은행': '027', '한국씨티은행': '027',
  '대구은행': '031', 'DGB대구은행': '031',
  '부산은행': '032', 'BNK부산은행': '032',
  '광주은행': '034',
  '제주은행': '035',
  '전북은행': '037',
  '경남은행': '039', 'BNK경남은행': '039',
  '새마을금고': '045',
  '신협': '048',
  '저축은행': '050',
  '우체국': '071', '우체국예금': '071',
  '하나은행': '081', '하나': '081',
  '신한은행': '088', '신한': '088',
  '케이뱅크': '089', 'K뱅크': '089',
  '카카오뱅크': '090', '카카오': '090',
  '토스뱅크': '092', '토스': '092',
  '한국투자저축은행': '023',
  'SBI저축은행': '103',
  '유안타증권': '209',
  'KB증권': '218',
  '미래에셋증권': '238',
  '삼성증권': '240',
  '한국투자증권': '243',
  'NH투자증권': '247',
  '교보증권': '261',
  '하이투자증권': '262',
  '현대차증권': '263',
  '키움증권': '264',
  '이베스트증권': '265',
  '신한금융투자': '278',
  '한화투자증권': '269',
  'SK증권': '266',
  '대신증권': '267',
  '메리츠증권': '287',
  '카카오페이증권': '288',
}

function getBankCode(bankName: string | undefined | null): string {
  if (!bankName) return ''
  const exact = BANK_CODES[bankName.trim()]
  if (exact) return exact
  // 부분 일치 검색
  const key = Object.keys(BANK_CODES).find(k => bankName.includes(k) || k.includes(bankName.trim()))
  return key ? BANK_CODES[key] : ''
}

// ── 파생 계산 헬퍼 ──
function totalEmp(d: DetailWithRider) {
  return (d.excel_employment_insurance ?? 0) + (d.employment_insurance_addition ?? 0)
}
function totalAcc(d: DetailWithRider) {
  return (d.excel_accident_insurance ?? 0) + (d.accident_insurance_addition ?? 0)
}
function taxBase(d: DetailWithRider) {
  return d.tax_base_amount ??
    Math.max(0, d.base_amount + d.promotion_amount - (d.hourly_insurance ?? 0) - totalEmp(d) - totalAcc(d) - (d.call_fee_deduction ?? 0))
}

// ──────────────────────────────────────────────────────────────
// 전체 정산 엑셀 다운로드
// ──────────────────────────────────────────────────────────────
export function exportSettlementExcel(
  settlement: WeeklySettlement,
  details: DetailWithRider[]
) {
  const wb = XLSX.utils.book_new()

  // ── 전체 정산 시트 ──
  const headers = [
    '라이더명', '은행', '은행코드', '계좌번호', '예금주',
    '배달건수', '배달료', '추가지급', '기본정산금액',
    '시간제보험료', '고용보험', '산재보험', '프로모션', '콜관리비',
    '세금신고금액', '소득세', '선지급금', '선지급금회수', '최종정산금액',
  ]

  const rows = details.map(d => {
    const tb = taxBase(d)
    return [
      d.riders?.name ?? '',
      d.riders?.bank_name ?? '',
      getBankCode(d.riders?.bank_name),
      d.riders?.bank_account ?? '',
      d.riders?.account_holder ?? '',
      d.delivery_count,
      d.delivery_fee ?? 0,
      d.additional_pay ?? 0,
      d.base_amount,
      d.hourly_insurance ?? 0,
      totalEmp(d),
      totalAcc(d),
      d.promotion_amount,
      d.call_fee_deduction ?? 0,
      tb,
      d.income_tax_deduction,
      d.advance_deduction,
      d.advance_recovery ?? 0,
      d.final_amount,
    ]
  })

  // 합계 행
  const sumRow = [
    '합계', '', '', '', '',
    details.reduce((s, d) => s + d.delivery_count, 0),
    details.reduce((s, d) => s + (d.delivery_fee ?? 0), 0),
    details.reduce((s, d) => s + (d.additional_pay ?? 0), 0),
    details.reduce((s, d) => s + d.base_amount, 0),
    details.reduce((s, d) => s + (d.hourly_insurance ?? 0), 0),
    details.reduce((s, d) => s + totalEmp(d), 0),
    details.reduce((s, d) => s + totalAcc(d), 0),
    details.reduce((s, d) => s + d.promotion_amount, 0),
    details.reduce((s, d) => s + (d.call_fee_deduction ?? 0), 0),
    details.reduce((s, d) => s + taxBase(d), 0),
    details.reduce((s, d) => s + d.income_tax_deduction, 0),
    details.reduce((s, d) => s + d.advance_deduction, 0),
    details.reduce((s, d) => s + (d.advance_recovery ?? 0), 0),
    details.reduce((s, d) => s + d.final_amount, 0),
  ]

  const summaryData = [
    ['라이더 주간 정산서'],
    [`정산 기간: ${settlement.week_start} ~ ${settlement.week_end}`],
    [],
    headers,
    ...rows,
    [],
    sumRow,
  ]

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData)
  summarySheet['!cols'] = [
    { wch: 12 }, { wch: 10 }, { wch: 8 }, { wch: 16 }, { wch: 10 },
    { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 14 },
    { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 14 },
  ]
  XLSX.utils.book_append_sheet(wb, summarySheet, '전체정산')

  // ── 라이더별 개별 시트 ──
  for (const d of details) {
    const riderName = d.riders?.name ?? '알수없음'
    const emp = totalEmp(d)
    const acc = totalAcc(d)
    const tb  = taxBase(d)
    const it  = d.income_tax_deduction
    const rec = d.advance_recovery ?? 0
    const callFee = d.call_fee_deduction ?? 0

    const bankCode = getBankCode(d.riders?.bank_name)
    const bankLabel = `${d.riders?.bank_name ?? '-'}${bankCode ? ` (${bankCode})` : ''}`
    const riderData: (string | number)[][] = [
      ['라이더 정산서'],
      [`정산 기간: ${settlement.week_start} ~ ${settlement.week_end}`],
      [`라이더명: ${riderName}`],
      [`은행: ${bankLabel}`],
      [`계좌번호: ${d.riders?.bank_account ?? '-'}`],
      [`예금주: ${d.riders?.account_holder ?? '-'}`],
      [],
      ['항목', '금액', '비고'],
      ['배달건수', d.delivery_count, '건'],
      ['배달료', d.delivery_fee ?? 0, ''],
      ['추가지급', d.additional_pay ?? 0, ''],
      ['기본정산금액', d.base_amount, `총배달료 (배달료+추가지급)`],
      [],
      ['[공제/조정 항목]', '', ''],
      ...(d.hourly_insurance ? [['시간제보험료', -(d.hourly_insurance ?? 0), '']] : []),
      ...(emp > 0 ? [['고용보험', -emp, '']] : []),
      ...(acc > 0 ? [['산재보험', -acc, '']] : []),
      ...(d.promotion_amount > 0 ? [['프로모션', d.promotion_amount, '']] : []),
      ...(callFee > 0 ? [['콜관리비', -callFee, `${d.delivery_count}건 × 단가`]] : []),
      [],
      ['세금신고금액', tb, '= 기본정산금액 - 보험 + 프로모션 - 콜관리비'],
      ['소득세', -it, '세금신고금액 × 소득세율'],
      ...(d.advance_deduction > 0 ? [['선지급금 공제', -d.advance_deduction, '']] : []),
      ...(rec > 0 ? [['선지급금회수', rec, '']] : []),
      [],
      ['최종정산금액', d.final_amount, '= 세금신고금액 - 소득세 - 선지급금 + 선지급금회수'],
    ]

    const riderSheet = XLSX.utils.aoa_to_sheet(riderData)
    riderSheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 30 }]
    XLSX.utils.book_append_sheet(wb, riderSheet, riderName.substring(0, 28))
  }

  XLSX.writeFile(wb, `정산_${settlement.week_start}_${settlement.week_end}.xlsx`)
}

// ──────────────────────────────────────────────────────────────
// 개별 라이더 정산서 엑셀 다운로드
// ──────────────────────────────────────────────────────────────
export function exportSingleRiderExcel(
  settlement: WeeklySettlement,
  detail: DetailWithRider
) {
  const wb   = XLSX.utils.book_new()
  const d    = detail
  const riderName = d.riders?.name ?? '알수없음'
  const emp  = totalEmp(d)
  const acc  = totalAcc(d)
  const tb   = taxBase(d)
  const it   = d.income_tax_deduction
  const rec  = d.advance_recovery ?? 0
  const callFee = d.call_fee_deduction ?? 0

  const bankCode = getBankCode(d.riders?.bank_name)
  const bankLabel = `${d.riders?.bank_name ?? '-'}${bankCode ? ` (${bankCode})` : ''}`
  const data: (string | number)[][] = [
    ['라이더 정산서'],
    [`정산 기간: ${settlement.week_start} ~ ${settlement.week_end}`],
    [`라이더명: ${riderName}`],
    [`은행: ${bankLabel}`],
    [`계좌번호: ${d.riders?.bank_account ?? '-'}`],
    [`예금주: ${d.riders?.account_holder ?? '-'}`],
    [],
    ['항목', '금액', '비고'],
    ['배달건수', d.delivery_count, '건'],
    ['배달료', d.delivery_fee ?? 0, ''],
    ['추가지급', d.additional_pay ?? 0, ''],
    ['기본정산금액', d.base_amount, '총배달료 (배달료+추가지급)'],
    [],
    ['[공제/조정 항목]', '', ''],
    ...(d.hourly_insurance ? [['시간제보험료', -(d.hourly_insurance ?? 0), '']] : []),
    ...(emp > 0 ? [['고용보험', -emp, '']] : []),
    ...(acc > 0 ? [['산재보험', -acc, '']] : []),
    ...(d.promotion_amount > 0 ? [['프로모션', d.promotion_amount, '']] : []),
    ...(callFee > 0 ? [['콜관리비', -callFee, `${d.delivery_count}건 × 단가`]] : []),
    [],
    ['세금신고금액', tb, '= 기본정산금액 - 보험 + 프로모션 - 콜관리비'],
    ['소득세', -it, '세금신고금액 × 소득세율'],
    ...(d.advance_deduction > 0 ? [['선지급금 공제', -d.advance_deduction, '']] : []),
    ...(rec > 0 ? [['선지급금회수', rec, '']] : []),
    [],
    ['최종정산금액', d.final_amount, '= 세금신고금액 - 소득세 - 선지급금 + 선지급금회수'],
  ]

  const sheet = XLSX.utils.aoa_to_sheet(data)
  sheet['!cols'] = [{ wch: 20 }, { wch: 14 }, { wch: 30 }]
  XLSX.utils.book_append_sheet(wb, sheet, '정산서')
  XLSX.writeFile(wb, `${riderName}_정산서_${settlement.week_start}.xlsx`)
}
