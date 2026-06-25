import { createClient } from '@supabase/supabase-js'

const url = 'https://xuyrtrngfdguecaodtff.supabase.co'
const key = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh1eXJ0cm5nZmRndWVjYW9kdGZmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM1NDAzOSwiZXhwIjoyMDg3OTMwMDM5fQ.uAThTACmvYfu8qsmD4wNsiK7gBOQm8lkyOggTDJyZ8U'
const admin = createClient(url, key, { auth: { persistSession: false } })

// 모든 유저 목록 조회
const { data: users } = await admin.auth.admin.listUsers({ perPage: 50 })
console.log('\n=== auth.users 상태 ===')
users?.users?.forEach(u => {
  const confirmed = u.email_confirmed_at ? '✅' : '❌ 미확인'
  console.log(`${u.email} | ${confirmed}`)
})

// profiles 조회
const { data: profiles } = await admin.from('profiles').select('id, username, email')
console.log('\n=== profiles ===')
profiles?.forEach(p => console.log(`${p.username} | ${p.email}`))

// 미확인 이메일 전체 확인 처리 + windcall 비밀번호 111111 설정
console.log('\n=== 수정 작업 ===')
for (const u of users?.users ?? []) {
  if (!u.email_confirmed_at) {
    const { error } = await admin.auth.admin.updateUserById(u.id, { email_confirm: true })
    console.log(`이메일 확인 처리: ${u.email} ->`, error ? 'FAIL: ' + error.message : 'OK')
  }
}

// windcall 비밀번호를 111111로 강제 설정
const windcallId = '4c046c9c-14ff-4d06-bee4-a6181a81f298'
const { error: pwErr } = await admin.auth.admin.updateUserById(windcallId, { password: '111111' })
console.log('windcall 비밀번호 111111 설정:', pwErr ? 'FAIL: ' + pwErr.message : 'SUCCESS')

// get_email_by_username SQL 함수 추가 (RPC 방식으로 실행)
console.log('\nDone.')
