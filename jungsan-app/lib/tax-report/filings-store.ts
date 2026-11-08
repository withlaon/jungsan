import { createAdminClient } from '@/lib/supabase/admin'
import { normalizeRiderName } from '@/lib/tax-report/allocate'

const BUCKET = 'tax-report-filings'

export interface StoredFilingFile {
  fileName: string
  sheetName: string
  period: string | null
  rows: { name: string; amount: number }[]
}

export interface StoredFiling {
  month: string
  savedAt: string
  supplyAmount: number
  files: StoredFilingFile[]
}

function filePath(userId: string) {
  return `${userId}.json`
}

export async function readFilings(userId: string): Promise<StoredFiling[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(filePath(userId))
  if (error || !data) {
    if (isMissing(error)) return []
    throw new Error(error?.message ?? '저장된 신고 파일을 읽지 못했습니다.')
  }
  const parsed = JSON.parse(await data.text()) as { filings?: unknown[] }
  if (!Array.isArray(parsed.filings)) return []
  return parsed.filings.filter(isFiling)
}

export async function writeFiling(userId: string, filing: StoredFiling) {
  const current = await readFilings(userId)
  const next = current.filter((row) => row.month !== filing.month)
  if (filing.files.length > 0) next.push(filing)
  next.sort((a, b) => b.month.localeCompare(a.month))
  await writeAll(userId, next)
}

async function writeAll(userId: string, filings: StoredFiling[]) {
  const admin = createAdminClient()
  await ensureBucket(admin)
  const body = Buffer.from(JSON.stringify({ filings }))
  const { error } = await admin.storage.from(BUCKET).upload(filePath(userId), body, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '0',
  })
  if (error) throw new Error(error.message)
}

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  const existing = await admin.storage.getBucket(BUCKET)
  if (existing.data) return
  const created = await admin.storage.createBucket(BUCKET, { public: false })
  if (created.error && !/already exists/i.test(created.error.message)) {
    throw new Error(created.error.message)
  }
}

function isMissing(error: { message?: string; status?: number; statusCode?: string | number } | null): boolean {
  if (!error) return true
  const message = (error.message ?? '').toLowerCase()
  const status = Number(error.status ?? error.statusCode)
  return status === 404 || message.includes('not found') || message.includes('does not exist')
}

function isFiling(value: unknown): value is StoredFiling {
  if (!value || typeof value !== 'object') return false
  const row = value as StoredFiling
  return /^\d{4}-\d{2}$/.test(row.month)
    && typeof row.savedAt === 'string'
    && Array.isArray(row.files)
    && Number.isFinite(Number(row.supplyAmount))
}

export function sanitizeFilingFiles(value: unknown): StoredFilingFile[] {
  if (!Array.isArray(value)) return []
  const files: StoredFilingFile[] = []
  for (const item of value.slice(0, 30)) {
    if (!item || typeof item !== 'object') continue
    const file = item as StoredFilingFile
    const fileName = String(file.fileName ?? '').trim().slice(0, 180)
    if (!fileName || !Array.isArray(file.rows)) continue
    const rows: { name: string; amount: number }[] = []
    for (const raw of file.rows.slice(0, 2000)) {
      if (!raw || typeof raw !== 'object') continue
      const row = raw as { name?: unknown; amount?: unknown }
      const name = normalizeRiderName(String(row.name ?? '')).slice(0, 80)
      const amount = Math.round(Number(row.amount))
      if (!name || !Number.isFinite(amount) || amount === 0) continue
      rows.push({ name, amount })
    }
    files.push({
      fileName,
      sheetName: String(file.sheetName ?? '').slice(0, 80),
      period: typeof file.period === 'string' && file.period.trim() ? file.period.trim().slice(0, 120) : null,
      rows,
    })
  }
  return files
}
