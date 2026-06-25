import { createClient } from '@supabase/supabase-js'

const url = 'https://xuyrtrngfdguecaodtff.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXJ0cm5nZmRndWVjYW9kdGZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM1NDAzOSwiZXhwIjoyMDg3OTMwMDM5fQ.uAThTACmvYfu8qsmD4wNsiK7gBOQm8lkyOggTDJyZ8U'
const admin = createClient(url, key, { auth: { persistSession: false } })

const WINDCALL_ID = '4c046c9c-14ff-4d06-bee4-a6181a81f298'

// 삭제 대상 프로필 조회
const { data: profiles } = await admin
  .from('profiles')
  .select('id, username, email')
  .neq('id', WINDCALL_ID)

console.log(`\n삭제 대상 계정 ${profiles?.length}개:`)
profiles?.forEach(p => console.log(` - ${p.username} (${p.email})`))

for (const p of profiles ?? []) {
  const uid = p.id
  console.log(`\n[처리 중] ${p.username} (${uid})`)

  try {
    // 1. rider_id 목록 조회
    const { data: riderRows } = await admin.from('riders').select('id').eq('user_id', uid)
    const riderIds = riderRows?.map(r => r.id) ?? []

    // 2. settlement_id 목록 조회
    const { data: weekRows } = await admin.from('weekly_settlements').select('id').eq('user_id', uid)
    const weekIds = weekRows?.map(w => w.id) ?? []

    // 3. settlement_details 삭제 (rider_id + settlement_id 두 경로)
    if (riderIds.length > 0) await admin.from('settlement_details').delete().in('rider_id', riderIds)
    if (weekIds.length > 0) await admin.from('settlement_details').delete().in('settlement_id', weekIds)

    // 4. 나머지 테이블 삭제
    await admin.from('advance_payments').delete().eq('user_id', uid)
    await admin.from('promotions').delete().eq('user_id', uid)
    await admin.from('management_fees').delete().eq('user_id', uid)
    await admin.from('insurance_fees').delete().eq('user_id', uid)
    await admin.from('weekly_settlements').delete().eq('user_id', uid)
    await admin.from('riders').delete().eq('user_id', uid)
    await admin.from('subscriptions').delete().eq('user_id', uid)
    await admin.from('profiles').delete().eq('id', uid)

    // 5. auth.users 삭제
    const { error: authErr } = await admin.auth.admin.deleteUser(uid)
    if (authErr) {
      console.log(`  ❌ auth 삭제 실패: ${authErr.message}`)
    } else {
      console.log(`  ✅ 완전 삭제 완료`)
    }
  } catch (e) {
    console.log(`  ❌ 오류: ${e.message}`)
  }
}

// 최종 확인
const { data: remaining } = await admin.from('profiles').select('username, email')
console.log('\n=== 남은 계정 ===')
remaining?.forEach(p => console.log(` - ${p.username} (${p.email})`))
