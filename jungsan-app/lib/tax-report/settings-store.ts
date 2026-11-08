import { createAdminClient } from '@/lib/supabase/admin'
import type { TaxReportMode } from '@/lib/tax-report/allocate'

const BUCKET = 'tax-report-settings'

export interface StoredTaxSetting {
  id: string
  rider_id: string
  tax_name: string | null
  tax_ssn: string | null
  mode: TaxReportMode
}

function filePath(userId: string) {
  return `${userId}.json`
}

export async function readTaxSettings(userId: string): Promise<StoredTaxSetting[]> {
  const admin = createAdminClient()
  const { data, error } = await admin.storage.from(BUCKET).download(filePath(userId))
  if (error || !data) return []
  try {
    const parsed = JSON.parse(await data.text()) as { settings?: unknown[] }
    if (!Array.isArray(parsed.settings)) return []
    return parsed.settings.filter(isSetting).map((row) => ({ ...row, id: row.rider_id }))
  } catch {
    return []
  }
}

export async function writeTaxSettings(userId: string, settings: StoredTaxSetting[]) {
  const admin = createAdminClient()
  const body = Buffer.from(JSON.stringify({ settings }))
  const { error } = await admin.storage.from(BUCKET).upload(filePath(userId), body, {
    upsert: true,
    contentType: 'application/json',
  })
  if (error) throw new Error(error.message)
}

function isSetting(value: unknown): value is StoredTaxSetting {
  if (!value || typeof value !== 'object') return false
  const row = value as StoredTaxSetting
  return typeof row.rider_id === 'string'
    && (row.mode === 'report' || row.mode === 'split' || row.mode === 'exclude')
}
