#!/usr/bin/env node
/**
 * 파일 변경 시 자동으로 GitHub에 커밋 & 푸시
 * 실행: npm run sync:watch (프로젝트 루트에서)
 * 30초마다 변경사항 확인 후 자동 커밋 & 푸시
 */
const { spawn, execSync } = require('child_process')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const INTERVAL_MS = 30000

let syncing = false

function run(cmd, args, cwd = ROOT) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { cwd, shell: true, stdio: 'inherit' })
    proc.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`exit ${code}`))))
  })
}

async function sync() {
  if (syncing) return
  try {
    const status = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' })
    if (!status.trim()) return
  } catch (_) {
    return
  }
  syncing = true
  try {
    await run('git', ['add', '-A'])
    await run('git', ['commit', '-m', `auto: sync ${new Date().toISOString().slice(0, 19).replace('T', ' ')}`])
    await run('git', ['push', 'origin', 'main'])
    console.log('[auto-sync] GitHub 푸시 완료')
  } catch (e) {
    if (!/nothing to commit|already up to date/i.test(String(e))) {
      console.error('[auto-sync] 오류:', e.message || e)
    }
  }
  syncing = false
}

console.log('[auto-sync] 30초마다 변경사항 확인 후 자동 푸시 (Ctrl+C 종료)')
setInterval(sync, INTERVAL_MS)
sync()
