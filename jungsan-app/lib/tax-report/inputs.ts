import { normalizeRiderName, type RiderTaxInput, type TaxReportMode } from '@/lib/tax-report/allocate'

export interface TaxSettingSource {
  rider_id: string
  tax_name: string | null
  tax_ssn: string | null
  mode: TaxReportMode
  source_name?: string | null
}

interface RiderSource {
  id: string
  name: string
  id_number: string | null
}

export function buildTaxInputs(riders: RiderSource[], settings: TaxSettingSource[]): RiderTaxInput[] {
  const byId = new Map(settings.map((setting) => [setting.rider_id, setting]))
  const inputs: RiderTaxInput[] = []
  const usedNames = new Set<string>()

  const push = (sourceName: string, setting: TaxSettingSource | undefined, originalSsn: string | null) => {
    const name = normalizeRiderName(sourceName)
    if (!name || usedNames.has(name)) return
    usedNames.add(name)
    const mode = setting?.mode === 'split' || setting?.mode === 'exclude' ? setting.mode : 'report'
    inputs.push({
      sourceName: name,
      mode,
      taxName: setting?.tax_name?.trim() || null,
      taxSsn: setting?.tax_ssn?.trim() || null,
      originalSsn,
    })
  }

  for (const rider of riders) {
    push(rider.name, byId.get(rider.id), rider.id_number)
  }

  for (const setting of settings) {
    const savedName = setting.source_name?.trim()
    if (!savedName) continue
    const rider = riders.find((item) => item.id === setting.rider_id)
    push(savedName, setting, rider?.id_number ?? null)
  }

  return inputs
}
