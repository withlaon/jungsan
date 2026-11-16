import { createAdminClient } from '@/lib/supabase/admin'

const BUCKET = 'rider-activity'

function filePath(userId: string) {
  return `${userId}.json`
}

export async function readRiderActivity(userId: string): Promise<Record<string, string>> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(filePath(userId))
  if (error || !data) return {}
  try {
    const parsed = JSON.parse(await data.text()) as { lastSeen?: unknown }
    return sanitize(parsed.lastSeen)
  } catch {
    return {}
  }
}

export async function mergeRiderActivity(userId: string, updates: Record<string, string>) {
  const current = await readRiderActivity(userId)
  let changed = false
  const next = { ...current }
  for (const [riderId, date] of Object.entries(updates)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    if (!next[riderId] || next[riderId] < date) {
      next[riderId] = date
      changed = true
    }
  }
  if (changed) await writeRiderActivity(userId, next)
  return next
}

async function writeRiderActivity(userId: string, lastSeen: Record<string, string>) {
  const admin = createAdminClient()
  await ensureBucket(admin)
  const body = Buffer.from(JSON.stringify({ lastSeen }))
  const { error } = await admin.storage.from(BUCKET).upload(filePath(userId), body, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '0',
  })
  if (error) throw new Error('라이더 정산 이력을 저장하지 못했습니다.')
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const existing = await admin.storage.getBucket(BUCKET)
  if (existing.data) return
  const created = await admin.storage.createBucket(BUCKET, { public: false })
  if (created.error && !/already exists/i.test(created.error.message ?? '')) {
    throw new Error('라이더 정산 이력 저장소를 준비하지 못했습니다.')
  }
}

function sanitize(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {}
  const next: Record<string, string> = {}
  for (const [key, date] of Object.entries(value)) {
    if (typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date)) next[key] = date
  }
  return next
}
