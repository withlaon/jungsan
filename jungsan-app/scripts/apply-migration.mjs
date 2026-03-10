/**
 * Supabase Management API를 이용해 마이그레이션 SQL을 직접 실행하는 스크립트.
 * 사용: node scripts/apply-migration.mjs
 *
 * 실행 전 환경변수 설정:
 *   SUPABASE_ACCESS_TOKEN  - https://supabase.com/dashboard/account/tokens 에서 생성
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const PROJECT_REF = 'xuyrtrngfdguecaodtff'
const ACCESS_TOKEN = process.env.SUPABASE_ACCESS_TOKEN

if (!ACCESS_TOKEN) {
  console.error('\n❌ SUPABASE_ACCESS_TOKEN 환경변수가 필요합니다.')
  console.error('   Supabase Dashboard > Account > Access Tokens 에서 생성 후:')
  console.error('   $env:SUPABASE_ACCESS_TOKEN="your_token" ; node scripts/apply-migration.mjs\n')
  process.exit(1)
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const sqlPath = join(__dirname, '../supabase/migrations/20260310000000_member_realtime.sql')
const sql = readFileSync(sqlPath, 'utf-8')

console.log('🚀 마이그레이션 적용 중...')

const res = await fetch(`https://api.supabase.com/v1/projects/${PROJECT_REF}/database/query`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${ACCESS_TOKEN}`,
  },
  body: JSON.stringify({ query: sql }),
})

const text = await res.text()
if (res.ok) {
  console.log('✅ 마이그레이션 성공!')
} else {
  console.error('❌ 마이그레이션 실패:', res.status, text)
  process.exit(1)
}
