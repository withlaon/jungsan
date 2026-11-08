/** 세무서 신고 합산·배분. 정호걸은 최종 신고액 6,750,000원으로 맞춘다. 김형식은 본인 금액만 신고한다. */

export const JEONG_NAME = '정호걸'
export const JEONG_TARGET = 6_750_000
export const KIM_NAME = '김형식'

export type TaxReportMode = 'report' | 'split' | 'exclude'

export interface RiderTaxInput {
  sourceName: string
  mode: TaxReportMode
  taxName: string | null
  taxSsn: string | null
  originalSsn: string | null
}

export interface SourceAmount {
  name: string
  amount: number
}

export interface TaxReportLine {
  sourceName: string
  reportName: string
  ssn: string
  originalAmount: number
  distributed: number
  deducted: number
  finalAmount: number
  incomeTax: number
  localTax: number
  isJeong: boolean
}

export interface AdjustmentRow {
  sourceName: string
  reportName: string
  ssn: string
  kind: '신고' | '정호걸' | '나누기' | '제외'
  originalAmount: number
  distributed: number
  deducted: number
  finalAmount: number
}

export interface TaxAllocationResult {
  lines: TaxReportLine[]
  adjustments: AdjustmentRow[]
  excluded: { name: string; amount: number }[]
  splitRiders: { name: string; amount: number }[]
  originalTotal: number
  finalTotal: number
  excludedTotal: number
  splitTotal: number
  jeongOriginal: number | null
  jeongFinal: number | null
  jeongFilledFromSplit: number
  jeongFilledFromOthers: number
  jeongExcess: number
  distributedEach: number
  distributionRecipients: number
  discarded: number
  notes: string[]
  missingSsn: string[]
}

export function normalizeRiderName(name: string): string {
  return name.replace(/\s+/g, ' ').trim()
}

export function formatSsn(value: string | null | undefined): string {
  const raw = (value ?? '').trim()
  if (!raw) return ''
  const digits = raw.replace(/\D/g, '')
  if (digits.length === 13) return `${digits.slice(0, 6)}-${digits.slice(6)}`
  return raw
}

export function aggregateAmounts(groups: { name: string; amount: number }[]): SourceAmount[] {
  const map = new Map<string, number>()
  for (const row of groups) {
    const name = normalizeRiderName(row.name)
    if (!name || name === '합계') continue
    if (!Number.isFinite(row.amount)) continue
    map.set(name, (map.get(name) ?? 0) + Math.round(row.amount))
  }
  return [...map.entries()].map(([name, amount]) => ({ name, amount }))
}

interface Reporter {
  sourceName: string
  reportName: string
  ssn: string
  originalAmount: number
  distributed: number
  deducted: number
  finalAmount: number
  isJeong: boolean
}

function won(n: number): string {
  return `${n.toLocaleString('ko-KR')}원`
}

function withTax(line: Omit<TaxReportLine, 'incomeTax' | 'localTax'>): TaxReportLine {
  const incomeTax = Math.floor(line.finalAmount * 0.03)
  const localTax = Math.floor(incomeTax * 0.1)
  return { ...line, incomeTax, localTax }
}

function indexInputs(inputs: RiderTaxInput[]) {
  const exact = new Map<string, RiderTaxInput>()
  const lower = new Map<string, RiderTaxInput>()
  const score = (s: RiderTaxInput) =>
    (s.mode !== 'report' ? 4 : 0) + (s.taxName?.trim() ? 1 : 0) + (s.taxSsn?.trim() ? 1 : 0)

  for (const input of inputs) {
    const key = normalizeRiderName(input.sourceName)
    if (!key) continue
    const prev = exact.get(key)
    if (!prev || score(input) >= score(prev)) exact.set(key, input)
    const lk = key.toLowerCase()
    const prevL = lower.get(lk)
    if (!prevL || score(input) >= score(prevL)) lower.set(lk, input)
  }

  return (name: string) => {
    const key = normalizeRiderName(name)
    return exact.get(key) ?? lower.get(key.toLowerCase())
  }
}

function isKim(name: string): boolean {
  return normalizeRiderName(name) === KIM_NAME
}

function toReporter(row: SourceAmount, setting: RiderTaxInput | undefined, isJeong: boolean): Reporter {
  const taxName = setting?.taxName?.trim() || ''
  return {
    sourceName: row.name,
    reportName: taxName || row.name,
    ssn: formatSsn(setting?.taxSsn || setting?.originalSsn || ''),
    originalAmount: row.amount,
    distributed: 0,
    deducted: 0,
    finalAmount: row.amount,
    isJeong,
  }
}

function deductExact(others: Reporter[], need: number): number {
  const donors = others.filter((o) => o.finalAmount > 0)
  const available = donors.reduce((s, o) => s + o.finalAmount, 0)
  const goal = Math.min(Math.max(0, need), available)
  if (goal <= 0 || available <= 0) return 0

  const cuts = donors.map((o) => Math.min(o.finalAmount, Math.floor((goal * o.finalAmount) / available)))
  let remain = goal - cuts.reduce((s, n) => s + n, 0)
  const order = donors
    .map((o, i) => ({ i, room: o.finalAmount - cuts[i] }))
    .sort((a, b) => b.room - a.room)

  for (const item of order) {
    if (remain <= 0) break
    const add = Math.min(item.room, remain)
    cuts[item.i] += add
    remain -= add
  }

  donors.forEach((o, i) => {
    o.finalAmount -= cuts[i]
    o.deducted += cuts[i]
  })
  return goal - remain
}

export function allocateTaxReport(amounts: SourceAmount[], inputs: RiderTaxInput[]): TaxAllocationResult {
  const find = indexInputs(inputs)
  const excluded: { name: string; amount: number }[] = []
  const splitRiders: { name: string; amount: number }[] = []
  const others: Reporter[] = []
  let jeong: Reporter | null = null
  let jeongSettingIgnored = false

  for (const row of amounts) {
    const setting = find(row.name)
    if (normalizeRiderName(row.name) === JEONG_NAME) {
      if (setting && setting.mode !== 'report') jeongSettingIgnored = true
      jeong = toReporter(row, setting, true)
      continue
    }
    if (setting?.mode === 'exclude') {
      excluded.push({ name: row.name, amount: row.amount })
      continue
    }
    if (setting?.mode === 'split') {
      splitRiders.push({ name: row.name, amount: row.amount })
      continue
    }
    others.push(toReporter(row, setting, false))
  }

  const excludedTotal = excluded.reduce((s, o) => s + o.amount, 0)
  const splitTotal = splitRiders.reduce((s, o) => s + o.amount, 0)
  const originalTotal =
    (jeong?.originalAmount ?? 0) +
    others.reduce((s, o) => s + o.originalAmount, 0) +
    excludedTotal +
    splitTotal

  let splitPool = splitTotal
  let jeongFilledFromSplit = 0
  let jeongFilledFromOthers = 0
  let jeongExcess = 0
  const notes: string[] = []

  if (!jeong && amounts.length > 0) {
    notes.push('업로드한 파일에 정호걸이 없어 6,750,000원 맞춤을 적용하지 않았습니다.')
  }

  if (jeong) {
    if (jeong.originalAmount > JEONG_TARGET) {
      jeongExcess = jeong.originalAmount - JEONG_TARGET
      jeong.deducted = jeongExcess
      jeong.finalAmount = JEONG_TARGET
      notes.push(
        `정호걸 원본 ${won(jeong.originalAmount)}을 6,750,000원으로 맞추고, 초과 ${won(jeongExcess)}을 다른 신고 라이더에게 나눕니다.`,
      )
    } else if (jeong.originalAmount < JEONG_TARGET) {
      const need = JEONG_TARGET - jeong.originalAmount
      jeongFilledFromSplit = Math.min(need, splitPool)
      splitPool -= jeongFilledFromSplit
      jeongFilledFromOthers = jeong.finalAmount + jeongFilledFromSplit < JEONG_TARGET
        ? deductExact(
            others.filter((o) => !isKim(o.sourceName)),
            JEONG_TARGET - jeong.originalAmount - jeongFilledFromSplit,
          )
        : 0
      jeong.distributed = jeongFilledFromSplit + jeongFilledFromOthers
      jeong.finalAmount = jeong.originalAmount + jeong.distributed
      if (jeongFilledFromSplit > 0) {
        notes.push(
          `정호걸 원본 ${won(jeong.originalAmount)}이 6,750,000원보다 적어, 나누기 금액 ${won(jeongFilledFromSplit)}을 나누기 재원에서 빼 정호걸에 포함했습니다.`,
        )
      }
      if (jeongFilledFromOthers > 0) {
        notes.push(
          `나누기 금액만으로는 6,750,000원이 되지 않아, 다른 신고 라이더 금액 ${won(jeongFilledFromOthers)}을 정호걸에 옮겼습니다.`,
        )
      }
      if (jeong.finalAmount !== JEONG_TARGET) {
        notes.push('남은 금액이 부족해 정호걸을 6,750,000원까지 채우지 못했습니다.')
      }
    } else {
      jeong.finalAmount = JEONG_TARGET
      notes.push('정호걸 합계가 이미 6,750,000원입니다.')
    }
    if (jeongSettingIgnored) {
      notes.push('정호걸은 나누기·전체신고안하기 설정과 관계없이 6,750,000원으로 맞춥니다.')
    }
  }

  const pool = splitPool + jeongExcess
  const kim = others.find((o) => isKim(o.sourceName)) ?? null
  const distributionTargets = others.filter(
    (o) => !isKim(o.sourceName) && (o.originalAmount > 0 || o.finalAmount > 0),
  )
  let distributedEach = 0
  let discarded = 0

  if (kim) {
    notes.push('김형식은 본인 금액만 신고하고, 나눈 금액은 포함하지 않습니다.')
  }

  if (distributionTargets.length > 0 && pool > 0) {
    distributedEach = Math.floor(pool / distributionTargets.length / 10) * 10
    for (const o of distributionTargets) {
      o.distributed += distributedEach
      o.finalAmount += distributedEach
    }
    discarded = pool - distributedEach * distributionTargets.length
    notes.push(
      `신고 라이더 ${distributionTargets.length}명에게 1인당 ${won(distributedEach)}씩 배분했습니다. 10원 단위 절사 ${won(discarded)}은 신고액에 넣지 않습니다.`,
    )
  } else if (pool > 0) {
    discarded = pool
    notes.push(`배분할 신고 라이더가 없어 ${won(discarded)}은 신고액에 포함하지 않았습니다.`)
  }

  if (excluded.length > 0) {
    notes.push(
      `전체신고안하기 ${excluded.length}명, ${won(excludedTotal)}은 파일에 나오지 않고 금액도 나누지 않습니다.`,
    )
  }
  if (splitRiders.length > 0) {
    notes.push(
      `세금신고금액 나누기 ${splitRiders.length}명, 합계 ${won(splitTotal)}은 본인 명의로 신고하지 않습니다.`,
    )
  }

  const lines = [jeong, ...others]
    .filter((r): r is Reporter => !!r && r.finalAmount > 0)
    .map((r) =>
      withTax({
        sourceName: r.sourceName,
        reportName: r.reportName,
        ssn: r.ssn,
        originalAmount: r.originalAmount,
        distributed: r.distributed,
        deducted: r.deducted,
        finalAmount: r.finalAmount,
        isJeong: r.isJeong,
      }),
    )
    .sort((a, b) => a.reportName.localeCompare(b.reportName, 'ko'))

  const adjustments: AdjustmentRow[] = [
    ...excluded.map((r) => ({
      sourceName: r.name,
      reportName: '',
      ssn: '',
      kind: '제외' as const,
      originalAmount: r.amount,
      distributed: 0,
      deducted: 0,
      finalAmount: 0,
    })),
    ...splitRiders.map((r) => ({
      sourceName: r.name,
      reportName: '',
      ssn: '',
      kind: '나누기' as const,
      originalAmount: r.amount,
      distributed: 0,
      deducted: 0,
      finalAmount: 0,
    })),
    ...(jeong
      ? [{
          sourceName: jeong.sourceName,
          reportName: jeong.reportName,
          ssn: jeong.ssn,
          kind: '정호걸' as const,
          originalAmount: jeong.originalAmount,
          distributed: jeong.distributed,
          deducted: jeong.deducted,
          finalAmount: jeong.finalAmount,
        }]
      : []),
    ...others.map((r) => ({
      sourceName: r.sourceName,
      reportName: r.reportName,
      ssn: r.ssn,
      kind: '신고' as const,
      originalAmount: r.originalAmount,
      distributed: r.distributed,
      deducted: r.deducted,
      finalAmount: r.finalAmount,
    })),
  ]

  const finalTotal = lines.reduce((s, l) => s + l.finalAmount, 0)

  return {
    lines,
    adjustments,
    excluded,
    splitRiders,
    originalTotal,
    finalTotal,
    excludedTotal,
    splitTotal,
    jeongOriginal: jeong?.originalAmount ?? null,
    jeongFinal: jeong?.finalAmount ?? null,
    jeongFilledFromSplit,
    jeongFilledFromOthers,
    jeongExcess,
    distributedEach,
    distributionRecipients: distributionTargets.length,
    discarded,
    notes,
    missingSsn: lines.filter((l) => !l.ssn).map((l) => l.reportName),
  }
}
