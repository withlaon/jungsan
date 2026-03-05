import { FeeSettings, ManagementFee, InsuranceFee, Promotion, AdvancePayment } from '@/types'

export interface RiderSettlementInput {
  riderId: string
  riderName: string
  deliveryCount: number
  baseAmount: number                  // 기본정산금액 = 총배달료 (G열)
  deliveryFee: number                 // 배달료 (E열)
  additionalPay: number               // 추가지급 (F열)
  hourlyInsurance: number             // 시간제보험료 (H열)
  excelEmploymentInsurance: number    // 고용보험 from Excel (L열)
  excelAccidentInsurance: number      // 산재보험 from Excel (M열)
}

export interface RiderSettlementResult {
  riderId: string
  riderName: string
  deliveryCount: number
  baseAmount: number                  // 기본정산금액
  deliveryFee: number                 // 배달료
  additionalPay: number               // 추가지급
  hourlyInsurance: number             // 시간제보험료
  totalEmploymentInsurance: number    // 고용보험 합계 (Excel + 추가분)
  totalAccidentInsurance: number      // 산재보험 합계 (Excel + 추가분)
  excelEmploymentInsurance: number    // Excel 고용보험
  excelAccidentInsurance: number      // Excel 산재보험
  employmentInsuranceAddition: number // 추가분
  accidentInsuranceAddition: number   // 추가분
  promotionAmount: number             // 프로모션
  callFeeDeduction: number            // 콜관리비
  managementFeeDeduction: number      // 일반관리비 (보관용)
  taxBaseAmount: number               // 세금신고금액
  incomeTaxDeduction: number          // 원천세 (= taxBaseAmount × 3.3%)
  advanceDeduction: number            // 선지급금
  advanceRecovery: number             // 선지급금회수
  finalAmount: number                 // 최종정산금액
  // 하위호환
  grossAmount: number
  insuranceDeduction: number
  totalDeduction: number
}

function isFeeApplicable(fee: ManagementFee | InsuranceFee, weekStart: string, weekEnd: string): boolean {
  const f = fee as ManagementFee
  if (f.date_mode === 'none') return true
  if (f.date_mode === 'week') return f.week_start === weekStart
  if (f.date_mode === 'deadline' && f.deadline_date) return f.deadline_date >= weekStart
  return false
}

export function calculateSettlement(
  inputs: RiderSettlementInput[],
  settings: FeeSettings,
  promotions: Promotion[],
  advancePayments: AdvancePayment[],
  managementFees: ManagementFee[] = [],
  weekStart = '',
  weekEnd = '',
  insuranceFees: InsuranceFee[] = [],
  platform = 'baemin',          // 'baemin' | 'coupang'
): RiderSettlementResult[] {
  const isBaemin = platform === 'baemin' || platform === '배민'

  return inputs.map(input => {
    const {
      riderId, riderName, deliveryCount, baseAmount,
      deliveryFee, additionalPay, hourlyInsurance,
      excelEmploymentInsurance, excelAccidentInsurance,
    } = input

    // ── 프로모션 계산 ──
    const applicablePromos = promotions.filter(p => {
      if (p.date_mode === 'week' && p.week_start !== weekStart) return false
      if (p.date_mode === 'deadline' && p.deadline_date && p.deadline_date < weekStart) return false
      return true
    })

    const calcPromo = (promos: Promotion[]) =>
      promos.reduce((s, p) => {
        if (p.promo_kind === 'fixed') return s + p.amount
        if (p.promo_kind === 'range' && p.ranges) {
          const range = p.ranges.find(r =>
            deliveryCount >= r.min_count && (r.max_count === null || deliveryCount <= r.max_count)
          )
          return s + (range?.amount ?? 0)
        }
        if (p.promo_kind === 'per_count' && p.per_count_min !== null) {
          return s + Math.max(0, deliveryCount - p.per_count_min) * p.amount
        }
        return s
      }, 0)

    const promotionAmount =
      calcPromo(applicablePromos.filter(p => p.type === 'global' && (p.rider_id === null || p.rider_id === riderId))) +
      calcPromo(applicablePromos.filter(p => p.type === 'individual' && p.rider_id === riderId))

    // ── 관리비 계산 ──
    const applicableFees = managementFees.filter(fee =>
      isFeeApplicable(fee, weekStart, weekEnd) && (fee.rider_id === null || fee.rider_id === riderId)
    )
    const managementFeeDeduction = applicableFees
      .filter(f => f.fee_type === 'general')
      .reduce((s, f) => s + f.amount, 0)
    const callFeeDeduction = applicableFees
      .filter(f => f.fee_type === 'call')
      .reduce((s, f) => s + f.amount * deliveryCount, 0)

    // ── 고용/산재보험 추가분 (관리비 설정) ──
    const applicableInsuranceFees = insuranceFees.filter(fee =>
      isFeeApplicable(fee, weekStart, weekEnd) && (fee.rider_id === null || fee.rider_id === riderId)
    )
    const employmentInsuranceAddition = applicableInsuranceFees.reduce((s, f) => s + f.employment_fee, 0)
    const accidentInsuranceAddition   = applicableInsuranceFees.reduce((s, f) => s + f.accident_fee, 0)

    // ── 고용/산재보험 합계 ──
    const totalEmploymentInsurance = excelEmploymentInsurance + employmentInsuranceAddition
    const totalAccidentInsurance   = excelAccidentInsurance   + accidentInsuranceAddition

    // ── 세금신고금액 ──
    let taxBaseAmount: number
    if (isBaemin) {
      // [배민] 세금신고금액 = 기본정산금액 + 지사프로모션
      taxBaseAmount = Math.max(0, baseAmount + promotionAmount)
    } else {
      // [쿠팡 등] 기존 계산식
      taxBaseAmount = Math.max(0,
        baseAmount
        - hourlyInsurance
        - totalEmploymentInsurance
        - totalAccidentInsurance
        + promotionAmount
        - callFeeDeduction
      )
    }

    // ── 원천세 ──
    let incomeTaxDeduction: number
    if (isBaemin) {
      // [배민] 원천세 = 세금신고금액 × 3.3% (원단위 절상)
      incomeTaxDeduction = Math.ceil(taxBaseAmount * settings.income_tax_rate)
    } else {
      incomeTaxDeduction = Math.floor(taxBaseAmount * settings.income_tax_rate)
    }

    // ── 선지급금 / 선지급금회수 ──
    const advanceDeduction = advancePayments
      .filter(p => p.rider_id === riderId && !p.deducted_settlement_id && p.type === 'advance')
      .reduce((s, p) => s + p.amount, 0)
    const advanceRecovery = advancePayments
      .filter(p => p.rider_id === riderId && !p.deducted_settlement_id && p.type === 'recovery')
      .reduce((s, p) => s + p.amount, 0)

    // ── 최종정산금액 ──
    let finalAmount: number
    if (isBaemin) {
      // [배민] 최종정산금액 = 기본정산금액 - 고용보험 - 산재보험 + 지사프로모션
      //                      - 콜관리비 - 원천세 - 선지급금 + 선지급금회수
      finalAmount = Math.max(0,
        baseAmount
        - totalEmploymentInsurance
        - totalAccidentInsurance
        + promotionAmount
        - callFeeDeduction
        - incomeTaxDeduction
        - advanceDeduction
        + advanceRecovery
      )
    } else {
      // [쿠팡 등] 기존 계산식: 세금신고금액 - 원천세 - 선지급금 + 선지급금회수
      finalAmount = Math.max(0, taxBaseAmount - incomeTaxDeduction - advanceDeduction + advanceRecovery)
    }

    // 하위호환 필드
    const grossAmount        = baseAmount + promotionAmount
    const insuranceDeduction = Math.floor(grossAmount * settings.insurance_rate)
    const totalDeduction     = isBaemin
      ? totalEmploymentInsurance + totalAccidentInsurance + callFeeDeduction + incomeTaxDeduction + advanceDeduction
      : hourlyInsurance + totalEmploymentInsurance + totalAccidentInsurance + incomeTaxDeduction + callFeeDeduction + advanceDeduction

    return {
      riderId, riderName, deliveryCount, baseAmount,
      deliveryFee, additionalPay, hourlyInsurance,
      totalEmploymentInsurance, totalAccidentInsurance,
      excelEmploymentInsurance, excelAccidentInsurance,
      employmentInsuranceAddition, accidentInsuranceAddition,
      promotionAmount, callFeeDeduction, managementFeeDeduction,
      taxBaseAmount, incomeTaxDeduction,
      advanceDeduction, advanceRecovery, finalAmount,
      grossAmount, insuranceDeduction, totalDeduction,
    }
  })
}
