import { createAdminClient } from '@/lib/supabase/admin'
import type { TaxReportMode } from '@/lib/tax-report/allocate'

const BUCKET = 'tax-report-settings'

export interface StoredTaxSetting {
  id: string
  rider_id: string
  tax_name: string | null
  tax_ssn: string | null
  mode: TaxReportMode
  source_name: string | null
}

function filePath(userId: string) {
  return `${userId}.json`
}

export async function readTaxSettings(userId: string): Promise<StoredTaxSetting[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(filePath(userId))
  if (error || !data) {
    if (isMissingObject(error)) return []
    throw new Error(error?.message ?? '세금신고 설정을 읽지 못했습니다.')
  }
  const parsed = JSON.parse(await data.text()) as { settings?: unknown[] }
  if (!Array.isArray(parsed.settings)) return []
  return parsed.settings.filter(isSetting).map((row) => ({
    id: row.rider_id,
    rider_id: row.rider_id,
    tax_name: row.tax_name ?? null,
    tax_ssn: row.tax_ssn ?? null,
    mode: row.mode,
    source_name: typeof row.source_name === 'string' && row.source_name.trim() ? row.source_name.trim() : null,
  }))
}

export async function writeTaxSettings(userId: string, settings: StoredTaxSetting[]) {
  const admin = createAdminClient()
  const body = Buffer.from(JSON.stringify({ settings }))
  const { error } = await admin.storage.from(BUCKET).upload(filePath(userId), body, {
    upsert: true,
    contentType: 'application/json',
    cacheControl: '0',
  })
  if (error) throw new Error(error.message)
}

function isMissingObject(error: { message?: string; status?: number; statusCode?: string | number } | null): boolean {
  if (!error) return true
  const message = (error.message ?? '').toLowerCase()
  const status = Number(error.status ?? error.statusCode)
  return status === 404 || message.includes('not found') || message.includes('does not exist')
}

function isSetting(value: unknown): value is StoredTaxSetting {
  if (!value || typeof value !== 'object') return false
  const row = value as StoredTaxSetting
  return typeof row.rider_id === 'string'
    && (row.mode === 'report' || row.mode === 'split' || row.mode === 'exclude')
}
