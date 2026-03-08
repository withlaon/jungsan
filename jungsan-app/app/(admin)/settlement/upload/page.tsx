'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useRiders } from '@/hooks/useRiders'
import { ParsedRiderRow, ExcelSummary } from '@/lib/excel/baemin-parser'
import { calculateSettlement, RiderSettlementResult } from '@/lib/settlement/calculator'
import { Rider, FeeSettings, Promotion, AdvancePayment, ManagementFee, InsuranceFee } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FileSpreadsheet, AlertTriangle, CheckCircle, ChevronRight, Loader2,
  X, Lock, Plus, CalendarDays,
} from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { toast } from 'sonner'

type Step = 'upload' | 'preview' | 'confirm'
type FileStatus = 'pending' | 'parsing' | 'success' | 'error'

interface UploadedFile {
  id: string
  file: File
  status: FileStatus
  rows: ParsedRiderRow[]
  summary?: ExcelSummary
  detectedPlatform?: string
  errorMsg?: string
}

// ?? 二쇨컙 ?듭뀡 (???? ??
function getWeekOptions() {
  const options: { label: string; value: string; endValue: string }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysBack = (today.getDay() - 3 + 7) % 7
  const baseWed = new Date(today)
  baseWed.setDate(today.getDate() - daysBack)
  const dl = ['??, '??, '??, '??, '紐?, '湲?, '??]
  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}.${m}.${day}`
  }
  const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  for (let i = 0; i < 24; i++) {
    const wed = new Date(baseWed)
    wed.setDate(baseWed.getDate() - i * 7)
    const tue = new Date(wed)
    tue.setDate(wed.getDate() + 6)
    options.push({
      label: `${fmt(wed)}(${dl[wed.getDay()]}) ~ ${fmt(tue)}(${dl[tue.getDay()]})`,
      value: fmtISO(wed),
      endValue: fmtISO(tue),
    })
  }
  return options
}
const weekOptions = getWeekOptions()

export default function SettlementUploadPage() {
  const router = useRouter()
  const supabase = createClient()
  const { userId, isAdmin, platform, loading: userLoading } = useUser()
  const { riders: allRiders } = useRiders()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<Step>('upload')
  const [dragging, setDragging] = useState(false)

  // ?ъ뾽?먮벑濡앸쾲???レ옄留? - ?뷀샇???뚯씪 ?먮룞 鍮꾨?踰덊샇 (ref濡???긽 理쒖떊媛??좎?)
  const autoPasswordRef = useRef<string>('')

  // 湲곌컙 ?좏깮
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0]?.value ?? '')
  const weekStart = selectedWeek
  const weekEnd = weekOptions.find(w => w.value === selectedWeek)?.endValue ?? ''

  // ?뚯씪 紐⑸줉
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])

  // preview
  const [parsedRows, setParsedRows] = useState<ParsedRiderRow[]>([])
  const [summaryData, setSummaryData] = useState<ExcelSummary | null>(null)
  const riders = allRiders.filter(r => r.status === 'active')
  const [riderMapping, setRiderMapping] = useState<Record<string, string>>({})
  const [settings, setSettings] = useState<FeeSettings | null>(null)
  const [managementFees, setManagementFees] = useState<ManagementFee[]>([])
  const [insuranceFees, setInsuranceFees] = useState<InsuranceFee[]>([])
  const [promotionsCache, setPromotionsCache] = useState<Promotion[]>([])
  const [results, setResults] = useState<RiderSettlementResult[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isAdmin || userId) {
      fetchSettings(); fetchManagementFees(); fetchInsuranceFees(); fetchProfileNumbers(); fetchPromotionsCache()
    }
  }, [userId, isAdmin])

  // ?ъ뾽?먮벑濡앸쾲???먮낯 ref (?쒕쾭 API???꾨떖??
  const rawBizNumRef = useRef<string>('')

  // ?꾨줈?꾩뿉???ъ뾽?먮벑濡앸쾲??罹먯떆
  const fetchProfileNumbers = async () => {
    if (rawBizNumRef.current) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data: profile } = await supabase
      .from('profiles')
      .select('business_number')
      .eq('id', user.id)
      .maybeSingle()
    if (profile?.business_number) {
      autoPasswordRef.current = profile.business_number.replace(/\D/g, '')
      rawBizNumRef.current = profile.business_number.trim()
    }
  }

  const fetchSettings = async () => {
    // ?좎?蹂??ㅼ젙 ?곗꽑 議고쉶, ?놁쑝硫?湲濡쒕쾶(user_id IS NULL) ?ㅼ젙 ?ъ슜
    if (userId) {
      const { data: userSettings } = await supabase
        .from('fee_settings')
        .select('*')
        .eq('user_id', userId)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (userSettings) { setSettings(userSettings); return }
    }
    const { data } = await supabase
      .from('fee_settings')
      .select('*')
      .is('user_id', null)
      .order('effective_from', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) setSettings(data)
  }
  const fetchManagementFees = async () => {
    let q = supabase.from('management_fees').select('*')
    if (!isAdmin && userId) q = q.eq('user_id', userId)
    const { data } = await q
    if (data) setManagementFees(data as ManagementFee[])
  }
  const fetchInsuranceFees = async () => {
    let q = supabase.from('insurance_fees').select('*')
    if (!isAdmin && userId) q = q.eq('user_id', userId)
    const { data } = await q
    if (data) setInsuranceFees(data as InsuranceFee[])
  }
  const fetchPromotionsCache = async () => {
    let q = supabase.from('promotions').select('*').or('settlement_id.is.null')
    if (!isAdmin && userId) q = q.eq('user_id', userId)
    const { data } = await q
    if (data) setPromotionsCache(data as Promotion[])
  }

  // ?? ?꾨줈紐⑥뀡 誘몃━蹂닿린 怨꾩궛 ??
  const calcPreviewPromo = (riderId: string, deliveryCount: number): number => {
    const applicable = promotionsCache.filter(p => {
      if (p.date_mode === 'none') return true
      if (p.date_mode === 'week' && p.week_start) return p.week_start === weekStart
      return true
    })
    const calc = (promos: Promotion[]) =>
      promos.reduce((s, p) => {
        if (p.promo_kind === 'fixed') return s + p.amount
        if (p.promo_kind === 'range' && p.ranges) {
          const range = (p.ranges as Array<{min_count:number;max_count:number|null;amount:number}>).find(r =>
            deliveryCount >= r.min_count && (r.max_count === null || deliveryCount <= r.max_count)
          )
          return s + (range?.amount ?? 0)
        }
        if (p.promo_kind === 'per_count' && p.per_count_min !== null) {
          return s + Math.max(0, deliveryCount - p.per_count_min) * p.amount
        }
        return s
      }, 0)
    return (
      calc(applicable.filter(p => p.type === 'global' && (p.rider_id === null || p.rider_id === riderId))) +
      calc(applicable.filter(p => p.type === 'individual' && p.rider_id === riderId))
    )
  }

  // ?? ?듭떖 ?뚯떛 濡쒖쭅 (?쒕쾭 API ?몄텧) ??
  const parseFileCore = async (file: File): Promise<{
    success: boolean
    rows: ParsedRiderRow[]
    summary?: ExcelSummary
    detectedPlatform?: string
    isPasswordRequired: boolean
    errorMsg?: string
  }> => {
    const formData = new FormData()
    formData.append('file', file)
    if (rawBizNumRef.current) formData.append('bizNum', rawBizNumRef.current)
    try {
      const res  = await fetch('/api/parse-excel', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.success) {
        // ?붾쾭洹? ?ㅼ젣 ?뚯씪 ?쒗듃/?ㅻ뜑 援ъ“ 肄섏넄 異쒕젰 (荑좏뙜?댁툩 ?뚯떛 臾몄젣 遺꾩꽍??
        console.log('[parse-excel] detectedPlatform:', data.detectedPlatform)
        console.log('[parse-excel] rows:', data.rows?.length)
        console.log('[parse-excel] debugAllSheets:', JSON.stringify(data.debugAllSheets, null, 2))
        return {
          success: true, rows: data.rows, summary: data.summary,
          detectedPlatform: data.detectedPlatform,
          isPasswordRequired: false,
        }
      }
      return {
        success: false, rows: [],
        isPasswordRequired: !!data.isPasswordRequired,
        errorMsg: data.error ?? '?뚯떛 ?ㅽ뙣',
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, rows: [], isPasswordRequired: false, errorMsg: '?붿껌 ?ㅽ뙣: ' + msg }
    }
  }

  // ?? ?⑥씪 ?뚯씪 ?뚯떛 (state ?낅뜲?댄듃) ??
  // ?쒕쾭(API)?먯꽌 ?ъ뾽?먮벑濡앸쾲???щ윭 ?뺤떇?쇰줈 ?먮룞 ?쒕룄?섎?濡??대씪?댁뼵?몃뒗 1???몄텧留?
  const parseFile = async (id: string, file: File) => {
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'parsing', errorMsg: undefined } : f))
    // bizNum???꾩쭅 紐?媛?몄솕?쇰㈃ 癒쇱? 議고쉶
    if (!rawBizNumRef.current) await fetchProfileNumbers()
    const result = await parseFileCore(file)
    if (result.success) {
      setUploadedFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'success', rows: result.rows, summary: result.summary, detectedPlatform: result.detectedPlatform, errorMsg: undefined } : f
      ))
    } else {
      setUploadedFiles(prev => prev.map(f =>
        f.id === id ? { ...f, status: 'error', rows: [], errorMsg: result.errorMsg } : f
      ))
    }
  }

  // ?? ?뚯씪 異붽? ??
  const addFiles = useCallback((files: File[]) => {
    const newEntries: UploadedFile[] = files
      .filter(f => /\.(xlsx|xls|csv)$/i.test(f.name))
      .map(f => ({
        id: `${Date.now()}_${Math.random()}`,
        file: f,
        status: 'pending' as FileStatus,
        rows: [],
      }))
    if (newEntries.length === 0) { toast.error('.xlsx, .xls, .csv ?뚯씪留??낅줈??媛?ν빀?덈떎.'); return }
    setUploadedFiles(prev => [...prev, ...newEntries])
    for (const entry of newEntries) {
      parseFile(entry.id, entry.file)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [addFiles])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
    e.target.value = ''
  }

  const removeFile = (id: string) => setUploadedFiles(prev => prev.filter(f => f.id !== id))

  // ?? ?뚯씪 紐⑸줉?쇰줈 preview ?대룞 ??
  const goToPreviewWithFiles = (files: UploadedFile[]) => {
    const successFiles = files.filter(f => f.status === 'success')
    if (successFiles.length === 0) return

    // ?? 1?④퀎: ?대쫫 ??userId ??갑???몃뜳??援ъ텞 ??
    // ?대뼡 ?뚯씪?대뱺 userId 媛 ?덈뒗 ?됱씠 ?덉쑝硫?洹?userId 瑜??뺢퇋 ?ㅻ줈 ?ъ슜
    const nameToUserId = new Map<string, string>()
    for (const uf of successFiles) {
      for (const row of uf.rows) {
        const uid = (row.userId ?? '').trim().toLowerCase()
        const nm  = row.name.replace(/\s/g, '').toLowerCase()
        if (uid) nameToUserId.set(nm, uid)
      }
    }

    // ?? 2?④퀎: ?쇱씠?붾퀎 ?⑹궛 (?щ윭 ?뚯씪 ?숈씪 ?쇱씠???곗씠??蹂묓빀) ??
    // ?뺢퇋 ?? userId > ?대쫫?쇰줈 ??“?뚮맂 userId > ?뺢퇋?붾맂 ?대쫫
    const mergedMap = new Map<string, ParsedRiderRow>()
    for (const uf of successFiles) {
      for (const row of uf.rows) {
        const uid = (row.userId ?? '').trim().toLowerCase()
        const nm  = row.name.replace(/\s/g, '').toLowerCase()
        const key = uid || nameToUserId.get(nm) || nm

        const existing = mergedMap.get(key)
        if (existing) {
          mergedMap.set(key, {
            ...existing,
            deliveryCount:       existing.deliveryCount       + row.deliveryCount,
            baseAmount:          existing.baseAmount          + row.baseAmount,
            deliveryFee:         existing.deliveryFee         + row.deliveryFee,
            additionalPay:       existing.additionalPay       + row.additionalPay,
            totalDeliveryFee:    existing.totalDeliveryFee    + row.totalDeliveryFee,
            hourlyInsurance:     existing.hourlyInsurance     + row.hourlyInsurance,
            employmentInsurance: existing.employmentInsurance + row.employmentInsurance,
            accidentInsurance:   existing.accidentInsurance   + row.accidentInsurance,
            settlementAmount:    existing.settlementAmount    + row.settlementAmount,
            withholdingTax:      existing.withholdingTax      + row.withholdingTax,
            payAmount:           existing.payAmount           + row.payAmount,
          })
        } else {
          mergedMap.set(key, { ...row })
        }
      }
    }
    const merged = Array.from(mergedMap.values())
    setParsedRows(merged)

    // 媛묒? summary ?⑹궛
    const totalSummary = successFiles.reduce(
      (acc, f) => ({
        settledAmount:                acc.settledAmount                + (f.summary?.settledAmount                ?? 0),
        branchFee:                    acc.branchFee                    + (f.summary?.branchFee                    ?? 0),
        vatAmount:                    acc.vatAmount                    + (f.summary?.vatAmount                    ?? 0),
        employerEmploymentInsurance:  acc.employerEmploymentInsurance  + (f.summary?.employerEmploymentInsurance  ?? 0),
        employerAccidentInsurance:    acc.employerAccidentInsurance    + (f.summary?.employerAccidentInsurance    ?? 0),
      }),
      { settledAmount: 0, branchFee: 0, vatAmount: 0, employerEmploymentInsurance: 0, employerAccidentInsurance: 0 }
    )
    const hasData = Object.values(totalSummary).some(v => v > 0)
    setSummaryData(hasData ? totalSummary : null)

    // ?쇱씠???먮룞 留ㅽ븨 ?곗꽑?쒖쐞:
    // 1) ?뚯씪 userId(?쇱씠?좎뒪ID/諛곕?ID) ???ъ씠??rider_username
    // 2) ?뚯씪 湲곗궗?대쫫 ???ъ씠???쇱씠?붾챸
    // 3) ?뚯씪 湲곗궗?대쫫 ???ъ씠??rider_username (??갑??
    const mapping: Record<string, string> = {}
    for (const row of merged) {
      const rowNameNorm = row.name.replace(/\s/g, '').toLowerCase()
      const rowUidNorm  = (row.userId ?? '').replace(/\s/g, '').toLowerCase()

      const matched = riders.find(r => {
        const rNameNorm = r.name.replace(/\s/g, '').toLowerCase()
        const rUserNorm = (r.rider_username ?? '').replace(/\s/g, '').toLowerCase()

        // 1) ?뚯씪 userId(?쇱씠?좎뒪ID) ???ъ씠??rider_username ?쇱튂 (荑좏뙜?댁툩 ?듭떖 留ㅽ븨)
        if (rowUidNorm && rUserNorm && rUserNorm === rowUidNorm) return true
        // 2) ?뚯씪 湲곗궗?대쫫 ???ъ씠???쇱씠?붾챸 ?쇱튂
        if (rNameNorm === rowNameNorm) return true
        // 3) ?뚯씪 湲곗궗?대쫫 ???ъ씠??rider_username ?쇱튂 (??갑??蹂댁“)
        if (rUserNorm && rUserNorm === rowNameNorm) return true
        return false
      })
      if (matched) mapping[row.name] = matched.id
    }
    setRiderMapping(mapping)
    setStep('preview')
  }

  // ?? ?ㅼ쓬 ?④퀎 踰꾪듉 ??
  const handleGoToPreview = () => {
    if (uploadedFiles.filter(f => f.status === 'success').length === 0) {
      toast.error('?뚯떛 ?꾨즺???뚯씪???놁뒿?덈떎.'); return
    }
    goToPreviewWithFiles(uploadedFiles)
  }

  // ?? ?뺤궛 怨꾩궛 ??
  const handlePreviewConfirm = async () => {
    // settings媛 ?놁쑝硫?湲곕낯 ?몄쑉濡?fallback (3.3% ?먯쿇??
    const effectiveSettings = settings ?? {
      id: 'default', user_id: null,
      insurance_rate: 0, income_tax_rate: 0.033,
      management_fee_type: 'fixed' as const, management_fee_value: 0,
      effective_from: '', note: null, created_at: '',
    }
    if (!settings) {
      toast('?ㅼ젙媛믪씠 ?놁뼱 湲곕낯 ?몄쑉(?먯쿇??3.3%)濡?怨꾩궛?⑸땲??', { icon: '?좑툘' })
    }

    const [promoRes, advanceRes] = await Promise.all([
      (() => { let q = supabase.from('promotions').select('*').or('settlement_id.is.null'); if (!isAdmin && userId) q = q.eq('user_id', userId); return q })(),
      (() => { let q = supabase.from('advance_payments').select('*').is('deducted_settlement_id', null); if (!isAdmin && userId) q = q.eq('user_id', userId); return q })(),
    ])
    const promotions: Promotion[] = promoRes.data ?? []
    const advances: AdvancePayment[] = advanceRes.data ?? []

    // ?쇱씠???곌껐???됰쭔 異붿텧
    const rawInputs = parsedRows
      .filter(r => riderMapping[r.name] && riderMapping[r.name] !== 'none')
      .map(r => {
        const rId = riderMapping[r.name]
        const officialName = riders.find(rd => rd.id === rId)?.name ?? r.name
        return {
          riderId:                  rId,
          riderName:                officialName,
          deliveryCount:            r.deliveryCount,
          baseAmount:               r.baseAmount,
          deliveryFee:              r.deliveryFee,
          additionalPay:            r.additionalPay,
          hourlyInsurance:          r.hourlyInsurance,
          excelEmploymentInsurance: r.employmentInsurance,
          excelAccidentInsurance:   r.accidentInsurance,
        }
      })

    if (rawInputs.length === 0) {
      const unmapped = parsedRows.length
      if (unmapped === 0) {
        toast.error('?뚯떛???쇱씠???곗씠?곌? ?놁뒿?덈떎. ?뚯씪???ㅼ떆 ?낅줈?쒗빐二쇱꽭??')
      } else {
        toast.error(`${unmapped}紐낆쓽 ?쇱씠?붽? 紐⑤몢 誘몄뿰寃??곹깭?낅땲?? ?곗륫 "?쇱씠???곌껐" ?쒕∼?ㅼ슫?먯꽌 ?곌껐?댁＜?몄슂.`)
      }
      return
    }

    // 媛숈? riderId媛 ?щ윭 ?됱씤 寃쎌슦 ?⑹궛
    const mergedMap = new Map<string, typeof rawInputs[0]>()
    for (const input of rawInputs) {
      const existing = mergedMap.get(input.riderId)
      if (existing) {
        mergedMap.set(input.riderId, {
          ...existing,
          deliveryCount:            existing.deliveryCount            + input.deliveryCount,
          baseAmount:               existing.baseAmount               + input.baseAmount,
          deliveryFee:              existing.deliveryFee              + input.deliveryFee,
          additionalPay:            existing.additionalPay            + input.additionalPay,
          hourlyInsurance:          existing.hourlyInsurance          + input.hourlyInsurance,
          excelEmploymentInsurance: existing.excelEmploymentInsurance + input.excelEmploymentInsurance,
          excelAccidentInsurance:   existing.excelAccidentInsurance   + input.excelAccidentInsurance,
        })
      } else {
        mergedMap.set(input.riderId, { ...input })
      }
    }
    const inputs = Array.from(mergedMap.values())

    // ?낅줈?쒕맂 ?뚯씪 以?荑좏뙜?댁툩濡?媛먯????뚯씪???덉쑝硫?platform??'coupang'?쇰줈 override
    const hasCoupangFile = uploadedFiles.some(f => f.detectedPlatform === 'coupang')
    const effectivePlatform = hasCoupangFile ? 'coupang' : (platform ?? 'baemin')

    const calc = calculateSettlement(inputs, effectiveSettings, promotions, advances, managementFees, weekStart, weekEnd, insuranceFees, effectivePlatform)
    setResults(calc)
    setStep('confirm')
  }

  // ?? ?뺤궛 ?????
  const handleSave = async (status: 'draft' | 'confirmed') => {
    if (results.length === 0) { toast.error('??ν븷 ?뺤궛 ?곗씠?곌? ?놁뒿?덈떎.'); return }
    setSaving(true)
    const fileNames = uploadedFiles.filter(f => f.status === 'success').map(f => f.file.name).join(', ')

    const insertRow: Record<string, unknown> = {
      week_start: weekStart, week_end: weekEnd, status, raw_file_name: fileNames || null,
      settled_amount:                 summaryData?.settledAmount               ?? 0,
      branch_fee:                     summaryData?.branchFee                   ?? 0,
      vat_amount:                     summaryData?.vatAmount                   ?? 0,
      employer_employment_insurance:  summaryData?.employerEmploymentInsurance ?? 0,
      employer_accident_insurance:    summaryData?.employerAccidentInsurance   ?? 0,
    }
    if (userId) insertRow.user_id = userId
    const { data: settlement, error: settlementError } = await supabase
      .from('weekly_settlements')
      .insert(insertRow)
      .select().single()

    if (settlementError || !settlement) {
      toast.error('?뺤궛 ?앹꽦 ?ㅽ뙣: ' + settlementError?.message)
      setSaving(false); return
    }

    const details = results.map(r => ({
      settlement_id:                settlement.id,
      rider_id:                     r.riderId,
      delivery_count:               r.deliveryCount,
      base_amount:                  r.baseAmount,
      delivery_fee:                 r.deliveryFee,
      additional_pay:               r.additionalPay,
      hourly_insurance:             r.hourlyInsurance,
      excel_employment_insurance:   r.excelEmploymentInsurance,
      excel_accident_insurance:     r.excelAccidentInsurance,
      promotion_amount:             r.promotionAmount,
      insurance_deduction:          r.insuranceDeduction,
      income_tax_deduction:         r.incomeTaxDeduction,
      management_fee_deduction:     r.managementFeeDeduction,
      call_fee_deduction:           r.callFeeDeduction,
      employment_insurance_addition: r.employmentInsuranceAddition,
      accident_insurance_addition:   r.accidentInsuranceAddition,
      advance_deduction:            r.advanceDeduction,
      advance_recovery:             r.advanceRecovery,
      tax_base_amount:              r.taxBaseAmount,
      final_amount:                 r.finalAmount,
    }))

    const { error: detailError } = await supabase.from('settlement_details').insert(details)
    if (detailError) {
      toast.error('?곸꽭 ?곗씠??????ㅽ뙣: ' + detailError.message)
      await supabase.from('weekly_settlements').delete().eq('id', settlement.id)
      setSaving(false); return
    }

    for (const r of results) {
      if (r.advanceDeduction > 0) {
        await supabase.from('advance_payments').update({ deducted_settlement_id: settlement.id })
          .eq('rider_id', r.riderId).eq('type', 'advance').is('deducted_settlement_id', null)
      }
      if (r.advanceRecovery > 0) {
        await supabase.from('advance_payments').update({ deducted_settlement_id: settlement.id })
          .eq('rider_id', r.riderId).eq('type', 'recovery').is('deducted_settlement_id', null)
      }
    }

    toast.success('?뺤궛????λ릺?덉뒿?덈떎.')
    setSaving(false)
    router.push('/settlement/result')
  }

  const mappedCount = Object.values(riderMapping).filter(Boolean).length
  const successCount = uploadedFiles.filter(f => f.status === 'success').length
  const pendingCount = uploadedFiles.filter(f => f.status === 'parsing' || f.status === 'pending').length

  const statusIcon = (status: FileStatus) => {
    if (status === 'success') return <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
    if (status === 'parsing' || status === 'pending') return <Loader2 className="h-4 w-4 text-blue-400 animate-spin shrink-0" />
    return <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">?뺤궛?뚯씪 ?깅줉</h2>
        <p className="text-slate-400 text-sm mt-1">?뺤궛 湲곌컙???좏깮?섍퀬 ?묒? ?뚯씪???낅줈?쒗븯?몄슂</p>
      </div>

      {/* 吏꾪뻾 ?④퀎 */}
      <div className="flex items-center gap-2">
        {(['upload', 'preview', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${step === s ? 'bg-blue-600 text-white' : (step === 'confirm' || (step === 'preview' && s === 'upload')) ? 'bg-emerald-800 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
              {i + 1}. {s === 'upload' ? '?뚯씪 ?낅줈?? : s === 'preview' ? '?곗씠???뺤씤' : '?뺤궛 寃곌낵'}
            </div>
            {i < 2 && <ChevronRight className="h-4 w-4 text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ?? STEP 1: ?낅줈???? */}
      {step === 'upload' && (
        <div className="space-y-5">
          {/* ?뺤궛 湲곌컙 ?좏깮 */}
          <Card className="border-blue-700/40 bg-blue-900/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-blue-400 shrink-0" />
                <div className="flex-1">
                  <Label className="text-blue-300 text-sm font-medium block mb-1.5">?뺤궛 湲곌컙 ?좏깮 <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <select value={selectedWeek} onChange={e => setSelectedWeek(e.target.value)}
                      className="w-full px-3 py-2.5 bg-slate-800 border border-blue-700/50 rounded-md text-sm text-white appearance-none cursor-pointer hover:border-blue-600 pr-8 focus:outline-none focus:border-blue-500">
                      {weekOptions.map(w => (
                        <option key={w.value} value={w.value} className="bg-slate-800">{w.label}</option>
                      ))}
                    </select>
                    <ChevronRight className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ?뚯씪 ?낅줈???곸뿭 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardContent className="p-4 md:p-6 space-y-4">
              {/* ?쒕옒洹??쒕∼ 議?*/}
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setDragging(true) }}
                onDragLeave={() => setDragging(false)}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl py-8 text-center transition-all cursor-pointer
                  ${dragging ? 'border-blue-500 bg-blue-900/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/30'}`}
              >
                <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
                  multiple onChange={handleFileInput} />
                <FileSpreadsheet className="h-10 w-10 text-slate-500 mx-auto mb-3" />
                <p className="text-white text-sm font-medium mb-1">
                  ?뚯씪???쒕옒洹명븯嫄곕굹 ?대┃?섏뿬 ?낅줈??
                </p>
                <p className="text-slate-500 text-xs">?щ윭 ?뚯씪 ?숈떆 ?낅줈??媛??쨌 .xlsx, .xls, .csv</p>
              </div>

              {/* ?낅줈?쒕맂 ?뚯씪 紐⑸줉 */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map(uf => (
                    <div key={uf.id} className={`rounded-lg border p-3 space-y-2 transition-colors
                      ${uf.status === 'success' ? 'border-emerald-700/50 bg-emerald-900/10'
                        : uf.status === 'error' ? 'border-rose-700/50 bg-rose-900/10'
                        : 'border-slate-700 bg-slate-800/50'}`}>
                      {/* ?뚯씪 ?뺣낫 ??*/}
                      <div className="flex items-center gap-2">
                        {statusIcon(uf.status)}
                        <FileSpreadsheet className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-white text-sm flex-1 truncate">{uf.file.name}</span>
                        <span className="text-slate-500 text-xs shrink-0">{(uf.file.size / 1024).toFixed(0)}KB</span>
                        {uf.status === 'success' && (
                          <span className="text-emerald-400 text-xs shrink-0">{uf.rows.length}??/span>
                        )}
                        <button onClick={() => removeFile(uf.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* ?먮윭 硫붿떆吏 */}
                      {uf.errorMsg && (
                        <p className="text-rose-400 text-xs pl-6 flex items-center gap-1">
                          <Lock className="h-3 w-3 shrink-0" />{uf.errorMsg}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 異붽? ?낅줈??踰꾪듉 (?뚯씪 ?덉쓣 ?? */}
              {uploadedFiles.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />?뚯씪 異붽?
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ?ㅼ쓬 ?④퀎 踰꾪듉 */}
          {uploadedFiles.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                {successCount > 0 && <span className="text-emerald-400 font-medium">?뚯떛 ?꾨즺 {successCount}媛?/span>}
                {pendingCount > 0 && <span className="text-blue-400">泥섎━ 以?{pendingCount}媛?/span>}
              </div>
              <Button onClick={handleGoToPreview} disabled={successCount === 0 || pendingCount > 0}
                className="bg-blue-600 hover:bg-blue-700 ml-auto">
                {pendingCount > 0 ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />?뚯떛 以?..</> : '?곗씠???뺤씤 ??}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ?? STEP 2: ?곗씠???뺤씤 ?? */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* 湲곌컙 + ?뚯씪紐?*/}
          <Card className="border-blue-700/40 bg-blue-900/10">
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <CalendarDays className="h-5 w-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-blue-300 text-xs mb-0.5">?뺤궛 湲곌컙</p>
                <p className="text-white font-bold">{weekStart} ~ {weekEnd}</p>
              </div>
              <div className="ml-auto flex items-center gap-2 text-xs text-slate-400 flex-wrap">
                {uploadedFiles.filter(f => f.status === 'success').map(f => (
                  <span key={f.id} className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded">
                    <FileSpreadsheet className="h-3 w-3" />{f.file.name}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 媛묒? ?붿빟 */}
          {summaryData && (
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: '?뺤궛?덉젙湲덉븸 (P25)', value: summaryData.settledAmount,               color: 'violet' },
                { label: '吏?ш?由щ퉬 (F25)',   value: summaryData.branchFee,                   color: 'blue' },
                { label: '遺媛??(C31)',        value: summaryData.vatAmount,                   color: 'amber' },
                { label: '怨좎슜蹂댄뿕?ъ뾽二?(I25)',value: summaryData.employerEmploymentInsurance, color: 'cyan' },
                { label: '?곗옱蹂댄뿕?ъ뾽二?(K25)',value: summaryData.employerAccidentInsurance,   color: 'purple' },
              ].map(item => (
                <Card key={item.label} className={`border-${item.color}-700/40 bg-${item.color}-900/10`}>
                  <CardContent className="p-3">
                    <p className={`text-${item.color}-300 text-xs mb-1`}>{item.label}</p>
                    <p className="text-white font-bold">{formatKRW(item.value)}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* ?쇱씠???뺤궛 ?곗씠???뚯씠釉?*/}
          {(() => {
            const mappedRows   = parsedRows.filter(r => riderMapping[r.name] && riderMapping[r.name] !== 'none')
            const unmappedRows = parsedRows.filter(r => !riderMapping[r.name] || riderMapping[r.name] === 'none')

            const RiderRow = ({ row, i }: { row: typeof parsedRows[0]; i: number }) => {
              const mappedRider = riderMapping[row.name]
                ? riders.find(r => r.id === riderMapping[row.name])
                : null
              // User ID: ?ъ씠?몄뿉 ?깅줉??rider_username ?곗꽑, ?놁쑝硫??뚯씪??userId
              const displayUserId = mappedRider?.rider_username || row.userId || '-'
              return (
                <TableRow key={i} className="border-slate-700 hover:bg-slate-800/50">
                  <TableCell className="text-slate-400 text-sm whitespace-nowrap">{displayUserId}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {mappedRider ? (
                      <div>
                        <span className="text-white font-medium">{mappedRider.name}</span>
                        {mappedRider.name !== row.name && (
                          <span className="text-slate-500 text-xs ml-1.5">({row.name})</span>
                        )}
                      </div>
                    ) : (
                      <span className="text-amber-400 font-medium">{row.name}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-300 text-right whitespace-nowrap">{row.deliveryCount.toLocaleString()}</TableCell>
                  <TableCell className="text-slate-300 text-right whitespace-nowrap">{formatKRW(row.deliveryFee)}</TableCell>
                  <TableCell className="text-slate-300 text-right whitespace-nowrap">{formatKRW(row.additionalPay)}</TableCell>
                  <TableCell className="text-emerald-400 text-right font-medium whitespace-nowrap">{formatKRW(row.totalDeliveryFee)}</TableCell>
                  <TableCell className="text-amber-400 text-right whitespace-nowrap">{row.hourlyInsurance > 0 ? formatKRW(row.hourlyInsurance) : '-'}</TableCell>
                  <TableCell className="text-violet-400 text-right whitespace-nowrap">
                    {(() => {
                      const rid = riderMapping[row.name]
                      if (!rid || rid === 'none') return <span className="text-slate-600 text-xs">誘몄뿰寃?/span>
                      const amt = calcPreviewPromo(rid, row.deliveryCount)
                      return amt > 0 ? <span className="font-medium">+{formatKRW(amt)}</span> : '-'
                    })()}
                  </TableCell>
                  <TableCell className="text-cyan-400 text-right whitespace-nowrap">{row.employmentInsurance > 0 ? formatKRW(row.employmentInsurance) : '-'}</TableCell>
                  <TableCell className="text-purple-400 text-right whitespace-nowrap">{row.accidentInsurance > 0 ? formatKRW(row.accidentInsurance) : '-'}</TableCell>
                  <TableCell className="text-blue-400 text-right whitespace-nowrap">{formatKRW(row.settlementAmount)}</TableCell>
                  <TableCell className="text-rose-400 text-right whitespace-nowrap">{row.withholdingTax > 0 ? formatKRW(row.withholdingTax) : '-'}</TableCell>
                  <TableCell className="text-emerald-300 text-right font-bold whitespace-nowrap">{formatKRW(row.payAmount)}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    <Select value={riderMapping[row.name] ?? ''} onValueChange={v => setRiderMapping(prev => ({ ...prev, [row.name]: v }))}>
                      <SelectTrigger className={`w-40 h-8 text-sm ${riderMapping[row.name] && riderMapping[row.name] !== 'none' ? 'bg-emerald-900/20 border-emerald-700' : 'bg-slate-800 border-slate-600'} text-white`}>
                        <SelectValue placeholder="?쇱씠???좏깮" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="none" className="text-slate-400">?곌껐 ?덊븿</SelectItem>
                        {riders.map(r => <SelectItem key={r.id} value={r.id} className="text-white">{r.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                </TableRow>
              )
            }

            const TableColumns = () => (
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400 whitespace-nowrap">User ID</TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">?쇱씠?붾챸</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">諛곕떖嫄댁닔</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">諛곕떖猷?/TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">異붽?吏湲?/TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">珥앸같?щ즺</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?쒓컙?쒕낫?섎즺</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">吏?ы봽濡쒕え??/TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">怨좎슜蹂댄뿕</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?곗옱蹂댄뿕</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?쇱씠?붾퀎?뺤궛湲덉븸</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?먯쿇吏뺤닔??/TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?쇱씠?붾퀎吏湲됯툑??/TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">?쇱씠???곌껐 *</TableHead>
              </TableRow>
            )

            return (
              <>
                {/* 留ㅽ븨???쇱씠???뚯씠釉?*/}
                <Card className="border-slate-700 bg-slate-900">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center justify-between">
                      <span>?쇱씠???뺤궛 ?곗씠??({mappedRows.length}紐?</span>
                      <div className="flex items-center gap-2 text-sm font-normal">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />{mappedRows.length}紐?留ㅽ븨 ?꾨즺
                        </span>
                        {unmappedRows.length > 0 && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />{unmappedRows.length}紐?誘몃ℓ??
                          </span>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {mappedRows.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">
                        留ㅽ븨???쇱씠?붽? ?놁뒿?덈떎. ?꾨옒 誘몃ℓ???쇱씠?붾? ?곌껐?댁＜?몄슂.
                      </div>
                    ) : (
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader><TableColumns /></TableHeader>
                          <TableBody>
                            {mappedRows.map((row, i) => <RiderRow key={i} row={row} i={i} />)}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* 誘몃ℓ???쇱씠?????묒쓣 ???덈뒗 ?뱀뀡 */}
                {unmappedRows.length > 0 && (
                  <Card className="border-amber-700/30 bg-amber-900/5">
                    <CardHeader className="py-3">
                      <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        誘몃ℓ???쇱씠??({unmappedRows.length}紐? ???ъ씠?몄뿉 ?깅줉?섏? ?딆븯嫄곕굹 ?먮룞 ?곌껐???ㅽ뙣?덉뒿?덈떎. 吏곸젒 ?곌껐?섍굅??臾댁떆?섏꽭??
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader><TableColumns /></TableHeader>
                          <TableBody>
                            {unmappedRows.map((row, i) => <RiderRow key={i} row={row} i={i} />)}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )
          })()}

          <div className="flex gap-3 flex-wrap items-center">
            <Button variant="ghost" onClick={() => setStep('upload')} className="text-slate-400 hover:text-white">???뚯씪 ?낅줈??/Button>

            {/* 誘몄뿰寃??쇱씠????寃쎄퀬 */}
            {parsedRows.length > 0 && (() => {
              const unmapped = parsedRows.filter(r => !riderMapping[r.name] || riderMapping[r.name] === 'none').length
              if (unmapped === 0) return null
              return (
                <span className="text-amber-400 text-sm flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {unmapped}紐?誘몄뿰寃????곌껐 ??怨꾩궛?댁＜?몄슂
                </span>
              )
            })()}

            <Button
              onClick={handlePreviewConfirm}
              disabled={parsedRows.length === 0}
              className="bg-blue-600 hover:bg-blue-700 ml-auto disabled:opacity-50"
            >
              ?뺤궛 怨꾩궛?섍린 ??
            </Button>
          </div>
        </div>
      )}

      {/* ?? STEP 3: ?뺤궛 寃곌낵 ?? */}
      {step === 'confirm' && (
        <div className="space-y-4">
          {results.length === 0 ? (
            <Card className="border-amber-700/40 bg-amber-900/10">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">?뺤궛 怨꾩궛???쇱씠?붽? ?놁뒿?덈떎</p>
                <p className="text-slate-400 text-sm mb-4">
                  ?곗씠???뺤씤 ?④퀎?먯꽌 ?곗륫 <strong className="text-white">?쇱씠???곌껐</strong> ?쒕∼?ㅼ슫???듯빐<br />
                  ?뚯씪??湲곗궗? ?ъ씠???깅줉 ?쇱씠?붾? ?곌껐?????ㅼ떆 怨꾩궛?댁＜?몄슂.
                </p>
                <Button onClick={() => setStep('preview')} variant="outline" className="border-slate-600 text-slate-300">
                  ???곗씠???뺤씤?쇰줈 ?뚯븘媛湲?
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-slate-700 bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    ?뺤궛 怨꾩궛 ?꾨즺 ({weekStart} ~ {weekEnd})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">珥??쇱씠??/p>
                      <p className="text-white font-bold text-xl">{results.length}紐?/p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">珥??멸툑?좉퀬湲덉븸</p>
                      <p className="text-emerald-400 font-bold">{formatKRW(results.reduce((s, r) => s + r.taxBaseAmount, 0))}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">珥??먯쿇??/p>
                      <p className="text-rose-400 font-bold">-{formatKRW(results.reduce((s, r) => s + r.incomeTaxDeduction, 0))}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">珥?理쒖쥌?뺤궛湲덉븸</p>
                      <p className="text-blue-400 font-bold">{formatKRW(results.reduce((s, r) => s + r.finalAmount, 0))}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-slate-700 bg-slate-900">
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-slate-700 hover:bg-transparent">
                          <TableHead className="text-slate-400 whitespace-nowrap">?쇱씠??/TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">諛곕떖嫄댁닔</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">湲곕낯?뺤궛湲덉븸</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap text-xs opacity-70">?대같?щ즺</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap text-xs opacity-70">?댁텛媛吏湲?/TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?쒓컙?쒕낫?섎즺</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">怨좎슜蹂댄뿕</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?곗옱蹂댄뿕</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">吏?ы봽濡쒕え??/TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">肄쒓?由щ퉬</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?멸툑?좉퀬湲덉븸</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?먯쿇??3.3%)</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?좎?湲됯툑</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?좎?湲됯툑?뚯닔</TableHead>
                          <TableHead className="text-slate-400 text-right font-bold whitespace-nowrap">理쒖쥌?뺤궛湲덉븸</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {results.map(r => (
                          <TableRow key={r.riderId} className="border-slate-700 hover:bg-slate-800/50">
                            <TableCell className="text-white font-medium whitespace-nowrap">{r.riderName}</TableCell>
                            <TableCell className="text-slate-300 text-right whitespace-nowrap">{r.deliveryCount.toLocaleString()}</TableCell>
                            <TableCell className="text-blue-400 text-right whitespace-nowrap font-medium">{formatKRW(r.baseAmount)}</TableCell>
                            <TableCell className="text-slate-400 text-right whitespace-nowrap text-xs">{formatKRW(r.deliveryFee)}</TableCell>
                            <TableCell className="text-slate-400 text-right whitespace-nowrap text-xs">{formatKRW(r.additionalPay)}</TableCell>
                            <TableCell className="text-amber-400 text-right whitespace-nowrap">{r.hourlyInsurance > 0 ? `-${formatKRW(r.hourlyInsurance)}` : '-'}</TableCell>
                            <TableCell className="text-cyan-400 text-right whitespace-nowrap">{r.totalEmploymentInsurance > 0 ? `-${formatKRW(r.totalEmploymentInsurance)}` : '-'}</TableCell>
                            <TableCell className="text-purple-400 text-right whitespace-nowrap">{r.totalAccidentInsurance > 0 ? `-${formatKRW(r.totalAccidentInsurance)}` : '-'}</TableCell>
                            <TableCell className="text-violet-400 text-right whitespace-nowrap">{r.promotionAmount > 0 ? `+${formatKRW(r.promotionAmount)}` : '-'}</TableCell>
                            <TableCell className="text-orange-400 text-right whitespace-nowrap">{r.callFeeDeduction > 0 ? `-${formatKRW(r.callFeeDeduction)}` : '-'}</TableCell>
                            <TableCell className="text-emerald-400 text-right font-medium whitespace-nowrap">{formatKRW(r.taxBaseAmount)}</TableCell>
                            <TableCell className="text-rose-400 text-right whitespace-nowrap">-{formatKRW(r.incomeTaxDeduction)}</TableCell>
                            <TableCell className="text-amber-300 text-right whitespace-nowrap">{r.advanceDeduction > 0 ? `-${formatKRW(r.advanceDeduction)}` : '-'}</TableCell>
                            <TableCell className="text-teal-400 text-right whitespace-nowrap">{r.advanceRecovery > 0 ? `+${formatKRW(r.advanceRecovery)}` : '-'}</TableCell>
                            <TableCell className="text-emerald-400 font-bold text-right whitespace-nowrap">{formatKRW(r.finalAmount)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              <div className="flex gap-3">
                <Button variant="ghost" onClick={() => setStep('preview')} className="text-slate-400 hover:text-white">???댁쟾?쇰줈</Button>
                <Button onClick={() => handleSave('draft')} disabled={saving} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}?꾩떆???
                </Button>
                <Button onClick={() => handleSave('confirmed')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}?뺤궛 ?뺤젙 ???
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}