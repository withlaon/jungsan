/**
 * windcall 사용자 데이터 삭제 및 초기화 스크립트
 * 실행: npm run reset:windcall (또는 npx tsx scripts/reset-windcall.ts)
 * .env.local의 SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_URL 필요
 */
import { config } from 'dotenv'
config({ path: '.env.local' })

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY를 .env.local에 설정하세요.')
  process.exit(1)
}

const admin = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
})

async function main() {
  const username = 'windcall'

  const { data: profile, error: profileErr } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()

  if (profileErr || !profile) {
    console.log(`사용자 '${username}'을(를) 찾을 수 없습니다.`)
    return
  }

  const targetUserId = profile.id
  console.log(`'${username}' (${targetUserId}) 데이터 삭제 중...`)

  const { data: settlements } = await admin
    .from('weekly_settlements')
    .select('id')
    .eq('user_id', targetUserId)

  const settlementIds = (settlements ?? []).map((s) => s.id)
  if (settlementIds.length > 0) {
    const { error: sdErr } = await admin.from('settlement_details').delete().in('settlement_id', settlementIds)
    if (sdErr) console.warn('settlement_details:', sdErr.message)
  }

  await admin.from('advance_payments').delete().eq('user_id', targetUserId)
  await admin.from('promotions').delete().eq('user_id', targetUserId)
  await admin.from('management_fees').delete().eq('user_id', targetUserId)
  await admin.from('insurance_fees').delete().eq('user_id', targetUserId)
  await admin.from('weekly_settlements').delete().eq('user_id', targetUserId)
  await admin.from('riders').delete().eq('user_id', targetUserId)
  await admin.from('member_features').delete().eq('user_id', targetUserId)
  await admin.from('profiles').delete().eq('id', targetUserId)

  const { error: authErr } = await admin.auth.admin.deleteUser(targetUserId)
  if (authErr) console.warn('auth deleteUser:', authErr.message)

  console.log(`'${username}' 사용자의 모든 데이터가 삭제되었습니다.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
