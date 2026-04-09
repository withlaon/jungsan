import type { SupabaseClient } from '@supabase/supabase-js'
import {
  calculateSettlement,
  type RiderSettlementInput,
  type RiderSettlementResult,
} from '@/lib/settlement/calculator'
import type {
  AdvancePayment,
  FeeSettings,
  InsuranceFee,
  ManagementFee,
  Promotion,
  Rider,
  SettlementDetail,
  WeeklySettlement,
} from '@/types'

const DEFAULT_FEE: FeeSettings = {
  id: 'default',
  user_id: null,
  insurance_rate: 0,
  income_tax_rate: 0.033,
  management_fee_type: 'fixed',
  management_fee_value: 0,
  effective_from: '',
  note: null,
  created_at: '',
}

async function loadFeeSettings(admin: SupabaseClient, userId: string): Promise<FeeSettings> {
  const { data: userRow } = await admin
    .from('fee_settings')
    .select('*')
    .eq('user_id', userId)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (userRow) return userRow as FeeSettings
  const { data: globalRow } = await admin
    .from('fee_settings')
    .select('*')
    .is('user_id', null)
    .order('effective_from', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (globalRow as FeeSettings) ?? DEFAULT_FEE
}

function normalizeAdvancesForSettlement(
  advances: AdvancePayment[],
  settlementId: string
): AdvancePayment[] {
  return advances
    .filter((p) => p.deducted_settlement_id == null || p.deducted_settlement_id === settlementId)
    .map((p) => ({ ...p, deducted_settlement_id: null }))
}

function buildInputs(
  details: Array<SettlementDetail & { riders?: Rider }>
): RiderSettlementInput[] {
  return details.map((d) => ({
    riderId: d.rider_id,
    riderName: d.riders?.name ?? '',
    deliveryCount: d.delivery_count,
    baseAmount: d.base_amount,
    deliveryFee: d.delivery_fee ?? 0,
    additionalPay: d.additional_pay ?? 0,
    hourlyInsurance: d.hourly_insurance ?? 0,
    excelEmploymentInsurance: d.excel_employment_insurance ?? 0,
    excelAccidentInsurance: d.excel_accident_insurance ?? 0,
  }))
}

function rowUpdateFromResult(r: RiderSettlementResult): Record<string, number> {
  return {
    promotion_amount: r.promotionAmount,
    insurance_deduction: r.insuranceDeduction,
    income_tax_deduction: r.incomeTaxDeduction,
    management_fee_deduction: r.managementFeeDeduction,
    call_fee_deduction: r.callFeeDeduction,
    employment_insurance_addition: r.employmentInsuranceAddition,
    accident_insurance_addition: r.accidentInsuranceAddition,
    advance_deduction: r.advanceDeduction,
    advance_recovery: r.advanceRecovery,
    tax_base_amount: r.taxBaseAmount,
    final_amount: r.finalAmount,
    excel_employment_insurance: r.excelEmploymentInsurance,
    excel_accident_insurance: r.excelAccidentInsurance,
  }
}

/**
 * 같은 테넌트(userId)의 모든(또는 특정) 주간 정산에 대해
 * 현재 fee_settings·프로모션·관리비·보험·선지급 기준으로 settlement_details를 재계산합니다.
 */
export async function recalculateAllSettlementsForUser(
  admin: SupabaseClient,
  userId: string,
  onlySettlementId?: string | null
): Promise<{ recalculated: number; errors: string[] }> {
  const errors: string[] = []
  let recalculated = 0

  const { data: profile } = await admin
    .from('profiles')
    .select('platform')
    .eq('id', userId)
    .maybeSingle()
  const platform = profile?.platform === 'coupang' ? 'coupang' : 'baemin'

  const feeSettings = await loadFeeSettings(admin, userId)

  let mq = admin.from('management_fees').select('*')
  mq = mq.eq('user_id', userId)
  const { data: managementFees } = await mq

  let iq = admin.from('insurance_fees').select('*')
  iq = iq.eq('user_id', userId)
  const { data: insuranceFees } = await iq

  let pq = admin.from('promotions').select('*').is('settlement_id', null)
  pq = pq.eq('user_id', userId)
  const { data: promotions } = await pq

  let sq = admin
    .from('weekly_settlements')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
  if (onlySettlementId) sq = sq.eq('id', onlySettlementId)
  const { data: settlements, error: se } = await sq
  if (se) {
    errors.push(se.message)
    return { recalculated: 0, errors }
  }

  for (const settlement of settlements ?? []) {
    const ws = settlement as WeeklySettlement
    try {
      const { data: details, error: de } = await admin
        .from('settlement_details')
        .select('*, riders(*)')
        .eq('settlement_id', ws.id)
      if (de) {
        errors.push(`${ws.id}: ${de.message}`)
        continue
      }
      if (!details?.length) continue

      let advQ = admin
        .from('advance_payments')
        .select('*')
        .eq('user_id', userId)
        .or(`deducted_settlement_id.is.null,deducted_settlement_id.eq.${ws.id}`)
      const { data: advRows } = await advQ

      const advances = normalizeAdvancesForSettlement((advRows ?? []) as AdvancePayment[], ws.id)
      const inputs = buildInputs(details as Array<SettlementDetail & { riders?: Rider }>)
      const results = calculateSettlement(
        inputs,
        feeSettings,
        (promotions ?? []) as Promotion[],
        advances,
        (managementFees ?? []) as ManagementFee[],
        ws.week_start,
        ws.week_end,
        (insuranceFees ?? []) as InsuranceFee[],
        platform
      )

      const byRider = new Map(results.map((r) => [r.riderId, r]))
      for (const d of details) {
        const r = byRider.get(d.rider_id)
        if (!r) continue
        const upd = rowUpdateFromResult(r)
        const { error: ue } = await admin.from('settlement_details').update(upd).eq('id', d.id)
        if (ue) errors.push(`${ws.id}/${d.rider_id}: ${ue.message}`)
      }
      recalculated += 1
    } catch (e) {
      errors.push(`${ws.id}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { recalculated, errors }
}
