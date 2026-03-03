export interface Rider {
  id: string
  user_id: string | null
  name: string
  rider_username: string | null
  id_number: string | null
  phone: string | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
  join_date: string | null
  status: 'active' | 'inactive'
  access_token: string | null
  created_at: string
  updated_at: string
}

export interface WeeklySettlement {
  id: string
  user_id: string | null
  week_start: string
  week_end: string
  status: 'draft' | 'confirmed'
  raw_file_name: string | null
  settled_amount: number          // 정산예정금액 (갑지 P25)
  branch_fee: number              // 지사관리비 (갑지 F25)
  vat_amount: number              // 부가세 (갑지 C31)
  employer_employment_insurance: number  // 고용보험사업주 (갑지 I25)
  employer_accident_insurance: number    // 산재보험사업주 (갑지 K25)
  created_at: string
  updated_at: string
}

export interface SettlementDetail {
  id: string
  settlement_id: string
  rider_id: string
  delivery_count: number
  base_amount: number             // 기본정산금액 (총배달료)
  delivery_fee: number            // 배달료 (Excel E열)
  additional_pay: number          // 추가지급 (Excel F열)
  hourly_insurance: number        // 시간제보험료 (Excel H열)
  excel_employment_insurance: number  // 고용보험 from Excel (L열)
  excel_accident_insurance: number    // 산재보험 from Excel (M열)
  promotion_amount: number
  insurance_deduction: number     // 구 보험 공제 (미사용, 하위호환용)
  income_tax_deduction: number    // 원천세 (세금신고금액 × 3.3%)
  management_fee_deduction: number
  call_fee_deduction: number
  employment_insurance_addition: number
  accident_insurance_addition: number
  advance_deduction: number       // 선지급금
  advance_recovery: number        // 선지급금회수
  tax_base_amount: number         // 세금신고금액
  final_amount: number
  created_at: string
  riders?: Rider
}

export interface AdvancePayment {
  id: string
  user_id: string | null
  rider_id: string
  amount: number
  paid_date: string
  memo: string | null
  type: 'advance' | 'recovery'
  deducted_settlement_id: string | null
  created_at: string
  riders?: Rider
}

export interface PromoRange {
  min_count: number
  max_count: number | null
  amount: number
}

export interface Promotion {
  id: string
  user_id: string | null
  settlement_id: string | null
  type: 'global' | 'individual'
  promo_kind: 'fixed' | 'range' | 'per_count'
  rider_id: string | null
  amount: number
  ranges: PromoRange[] | null
  per_count_min: number | null
  week_start: string | null
  deadline_date: string | null
  date_mode: 'week' | 'deadline' | 'none'
  description: string | null
  created_at: string
  riders?: Rider
  weekly_settlements?: WeeklySettlement
}

export interface InsuranceFee {
  id: string
  user_id: string | null
  rider_id: string | null
  employment_fee: number
  accident_fee: number
  date_mode: 'week' | 'deadline' | 'none'
  week_start: string | null
  deadline_date: string | null
  memo: string | null
  created_at: string
  riders?: Rider
}

export interface ManagementFee {
  id: string
  user_id: string | null
  rider_id: string | null
  item_name: string
  fee_type: 'general' | 'call'
  amount: number
  date_mode: 'week' | 'deadline' | 'none'
  week_start: string | null
  deadline_date: string | null
  memo: string | null
  created_at: string
  riders?: Rider
}

export interface FeeSettings {
  id: string
  insurance_rate: number
  income_tax_rate: number
  management_fee_type: 'rate' | 'fixed'
  management_fee_value: number
  effective_from: string
  note: string | null
  created_at: string
}

export interface SettlementSummary {
  settlement: WeeklySettlement
  active_riders: number
  total_base_amount: number
  total_promotion: number
  total_insurance: number
  total_income_tax: number
  total_management_fee: number
  total_advance_deduction: number
  total_final_amount: number
  details: (SettlementDetail & { riders: Rider })[]
}
