import { createClient } from '@supabase/supabase-js'
import { writeFileSync } from 'fs'

const url = 'https://xuyrtrngfdguecaodtff.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXJ0cm5nZmRndWVjYW9kdGZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM1NDAzOSwiZXhwIjoyMDg3OTMwMDM5fQ.uAThTACmvYfu8qsmD4wNsiK7gBOQm8lkyOggTDJyZ8U'
const admin = createClient(url, key, { auth: { persistSession: false } })

const weekId = 'd18e6f36-a5b6-462e-bd67-4ad86fc87b0b'
const userId = 'e5964948-d0d0-484c-af7b-3813488611bd'

// settlement_details + riders JOIN
const { data: details, error } = await admin
  .from('settlement_details')
  .select(`
    id,
    delivery_count,
    delivery_fee,
    base_amount,
    additional_pay,
    promotion_amount,
    call_fee_deduction,
    management_fee_deduction,
    insurance_deduction,
    income_tax_deduction,
    employment_insurance_addition,
    accident_insurance_addition,
    hourly_insurance,
    excel_employment_insurance,
    excel_accident_insurance,
    advance_deduction,
    advance_recovery,
    final_amount,
    tax_base_amount,
    rider_id,
    riders(name, rider_username, phone, bank_name, bank_account, account_holder)
  `)
  .eq('settlement_id', weekId)
  .order('rider_id')

if (error) { console.error('에러:', error.message); process.exit(1) }
console.log(`총 ${details.length}건 조회 완료`)

// CSV 생성 (한글 컬럼명)
const header = [
  '라이더명', '라이더아이디', '연락처', '은행', '계좌번호', '예금주',
  '배달건수', '배달비', '기본급여', '추가수당', '프로모션금액',
  '콜비차감', '관리비차감', '보험차감', '소득세차감',
  '고용보험추가', '상해보험추가', '시간제보험', '엑셀고용보험', '엑셀상해보험',
  '선지급차감', '선지급회수', '세전금액', '최종정산금액'
]

const rows = details.map(d => {
  const r = d.riders
  return [
    r?.name ?? '',
    r?.rider_username ?? '',
    r?.phone ?? '',
    r?.bank_name ?? '',
    r?.bank_account ?? '',
    r?.account_holder ?? '',
    d.delivery_count ?? 0,
    d.delivery_fee ?? 0,
    d.base_amount ?? 0,
    d.additional_pay ?? 0,
    d.promotion_amount ?? 0,
    d.call_fee_deduction ?? 0,
    d.management_fee_deduction ?? 0,
    d.insurance_deduction ?? 0,
    d.income_tax_deduction ?? 0,
    d.employment_insurance_addition ?? 0,
    d.accident_insurance_addition ?? 0,
    d.hourly_insurance ?? 0,
    d.excel_employment_insurance ?? 0,
    d.excel_accident_insurance ?? 0,
    d.advance_deduction ?? 0,
    d.advance_recovery ?? 0,
    d.tax_base_amount ?? 0,
    d.final_amount ?? 0,
  ].map(v => String(v).includes(',') ? `"${v}"` : v)
})

const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\n')
writeFileSync('scripts/enjoy2_2026-05-27_settlement.csv', csvContent, 'utf8')
console.log('✅ CSV 저장 완료: scripts/enjoy2_2026-05-27_settlement.csv')
console.log('첫 번째 행 미리보기:', rows[0]?.slice(0, 6))
