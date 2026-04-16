/**
 * production DB에 적용되지 않은 마이그레이션 SQL을 직접 실행합니다.
 * Supabase 대시보드 SQL 편집기나 psql 접근이 없는 경우에 사용합니다.
 *
 * 실행: node scripts/apply-pending-migrations.cjs
 *
 * !! 주의: 이 스크립트는 service_role 키로 DB를 직접 변경합니다.
 *         반드시 .env.local 에 SUPABASE_DB_URL 이 설정되어 있어야 합니다.
 *         (Supabase 대시보드 > Project Settings > Database > Connection string > URI)
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const envText = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
const env = {}
for (const line of envText.split('\n')) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) env[m[1]] = m[2].trim()
}

const dbUrl = env['SUPABASE_DB_URL']
if (!dbUrl) {
  console.log(`
======================================================
SUPABASE_DB_URL 이 .env.local 에 없습니다.
Supabase Dashboard > Project Settings > Database > URI 에서 복사 후 .env.local 에 추가:

SUPABASE_DB_URL=postgresql://postgres:[PASSWORD]@db.xuyrtrngfdguecaodtff.supabase.co:5432/postgres

또는 Supabase Dashboard SQL 편집기에서 직접 실행:

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS access_until timestamptz;
COMMENT ON COLUMN subscriptions.access_until IS '구독 해지 시점부터 남은 이용 기간 종료일시';
======================================================
`)
  process.exit(0)
}

const sql = `ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS access_until timestamptz;
COMMENT ON COLUMN subscriptions.access_until IS '\uAD6C\uB3C5 \uD574\uC9C0 \uC2DC\uC810\uBD80\uD130 \uB0A8\uC740 \uC774\uC6A9 \uAE30\uAC04 \uC885\uB8CC\uC77C\uC2DC';`

try {
  execSync(`psql "${dbUrl}" -c "${sql.replace(/"/g, '\\"')}"`, { stdio: 'inherit' })
  console.log('마이그레이션 적용 완료')
} catch (e) {
  console.error('psql 실행 실패:', e.message)
  console.log('\nSupabase Dashboard SQL 편집기에서 직접 실행하세요:')
  console.log(sql)
}
