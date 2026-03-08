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

// ?€?€ ì£¼ê°„ ?µì…˜ (???? ?€?€
function getWeekOptions() {
  const options: { label: string; value: string; endValue: string }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysBack = (today.getDay() - 3 + 7) % 7
  const baseWed = new Date(today)
  baseWed.setDate(today.getDate() - daysBack)
  const dl = ['??, '??, '??, '??, 'ëª?, 'ê¸?, '??]
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

  // ?¬ì—…?ë“±ë¡ë²ˆ???«ìë§? - ?”í˜¸???Œì¼ ?ë™ ë¹„ë?ë²ˆí˜¸ (refë¡???ƒ ìµœì‹ ê°?? ì?)
  const autoPasswordRef = useRef<string>('')

  // ê¸°ê°„ ? íƒ
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0]?.value ?? '')
  const weekStart = selectedWeek
  const weekEnd = weekOptions.find(w => w.value === selectedWeek)?.endValue ?? ''

  // ?Œì¼ ëª©ë¡
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

  // ?¬ì—…?ë“±ë¡ë²ˆ???ë³¸ ref (?œë²„ API???„ë‹¬??
  const rawBizNumRef = useRef<string>('')

  // ?„ë¡œ?„ì—???¬ì—…?ë“±ë¡ë²ˆ??ìºì‹œ
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
    // ? ì?ë³??¤ì • ?°ì„  ì¡°íšŒ, ?†ìœ¼ë©?ê¸€ë¡œë²Œ(user_id IS NULL) ?¤ì • ?¬ìš©
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

  // ?€?€ ?„ë¡œëª¨ì…˜ ë¯¸ë¦¬ë³´ê¸° ê³„ì‚° ?€?€
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

  // ?€?€ ?µì‹¬ ?Œì‹± ë¡œì§ (?œë²„ API ?¸ì¶œ) ?€?€
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
        // ?”ë²„ê·? ?¤ì œ ?Œì¼ ?œíŠ¸/?¤ë” êµ¬ì¡° ì½˜ì†” ì¶œë ¥ (ì¿ íŒ¡?´ì¸  ?Œì‹± ë¬¸ì œ ë¶„ì„??
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
        errorMsg: data.error ?? '?Œì‹± ?¤íŒ¨',
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, rows: [], isPasswordRequired: false, errorMsg: '?”ì²­ ?¤íŒ¨: ' + msg }
    }
  }

  // ?€?€ ?¨ì¼ ?Œì¼ ?Œì‹± (state ?…ë°?´íŠ¸) ?€?€
  // ?œë²„(API)?ì„œ ?¬ì—…?ë“±ë¡ë²ˆ???¬ëŸ¬ ?•ì‹?¼ë¡œ ?ë™ ?œë„?˜ë?ë¡??´ë¼?´ì–¸?¸ëŠ” 1???¸ì¶œë§?
  const parseFile = async (id: string, file: File) => {
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'parsing', errorMsg: undefined } : f))
    // bizNum???„ì§ ëª?ê°€?¸ì™”?¼ë©´ ë¨¼ì? ì¡°íšŒ
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

  // ?€?€ ?Œì¼ ì¶”ê? ?€?€
  const addFiles = useCallback((files: File[]) => {
    const newEntries: UploadedFile[] = files
      .filter(f => /\.(xlsx|xls|csv)$/i.test(f.name))
      .map(f => ({
        id: `${Date.now()}_${Math.random()}`,
        file: f,
        status: 'pending' as FileStatus,
        rows: [],
      }))
    if (newEntries.length === 0) { toast.error('.xlsx, .xls, .csv ?Œì¼ë§??…ë¡œ??ê°€?¥í•©?ˆë‹¤.'); return }
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

  // ?€?€ ?Œì¼ ëª©ë¡?¼ë¡œ preview ?´ë™ ?€?€
  const goToPreviewWithFiles = (files: UploadedFile[]) => {
    const successFiles = files.filter(f => f.status === 'success')
    if (successFiles.length === 0) return

    // ?€?€ 1?¨ê³„: ?´ë¦„ ??userId ??°©???¸ë±??êµ¬ì¶• ?€?€
    // ?´ë–¤ ?Œì¼?´ë“  userId ê°€ ?ˆëŠ” ?‰ì´ ?ˆìœ¼ë©?ê·?userId ë¥??•ê·œ ?¤ë¡œ ?¬ìš©
    const nameToUserId = new Map<string, string>()
    for (const uf of successFiles) {
      for (const row of uf.rows) {
        const uid = (row.userId ?? '').trim().toLowerCase()
        const nm  = row.name.replace(/\s/g, '').toLowerCase()
        if (uid) nameToUserId.set(nm, uid)
      }
    }

    // ?€?€ 2?¨ê³„: ?¼ì´?”ë³„ ?©ì‚° (?¬ëŸ¬ ?Œì¼ ?™ì¼ ?¼ì´???°ì´??ë³‘í•©) ?€?€
    // ?•ê·œ ?? userId > ?´ë¦„?¼ë¡œ ??¡°?Œëœ userId > ?•ê·œ?”ëœ ?´ë¦„
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

    // ê°‘ì? summary ?©ì‚°
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

    // ?¼ì´???ë™ ë§¤í•‘ ?°ì„ ?œìœ„:
    // 1) ?Œì¼ userId(?¼ì´? ìŠ¤ID/ë°°ë?ID) ???¬ì´??rider_username
    // 2) ?Œì¼ ê¸°ì‚¬?´ë¦„ ???¬ì´???¼ì´?”ëª…
    // 3) ?Œì¼ ê¸°ì‚¬?´ë¦„ ???¬ì´??rider_username (??°©??
    const mapping: Record<string, string> = {}
    for (const row of merged) {
      const rowNameNorm = row.name.replace(/\s/g, '').toLowerCase()
      const rowUidNorm  = (row.userId ?? '').replace(/\s/g, '').toLowerCase()

      const matched = riders.find(r => {
        const rNameNorm = r.name.replace(/\s/g, '').toLowerCase()
        const rUserNorm = (r.rider_username ?? '').replace(/\s/g, '').toLowerCase()

        // 1) ?Œì¼ userId(?¼ì´? ìŠ¤ID) ???¬ì´??rider_username ?¼ì¹˜ (ì¿ íŒ¡?´ì¸  ?µì‹¬ ë§¤í•‘)
        if (rowUidNorm && rUserNorm && rUserNorm === rowUidNorm) return true
        // 2) ?Œì¼ ê¸°ì‚¬?´ë¦„ ???¬ì´???¼ì´?”ëª… ?¼ì¹˜
        if (rNameNorm === rowNameNorm) return true
        // 3) ?Œì¼ ê¸°ì‚¬?´ë¦„ ???¬ì´??rider_username ?¼ì¹˜ (??°©??ë³´ì¡°)
        if (rUserNorm && rUserNorm === rowNameNorm) return true
        return false
      })
      if (matched) mapping[row.name] = matched.id
    }
    setRiderMapping(mapping)
    setStep('preview')
  }

  // ?€?€ ?¤ìŒ ?¨ê³„ ë²„íŠ¼ ?€?€
  const handleGoToPreview = () => {
    if (uploadedFiles.filter(f => f.status === 'success').length === 0) {
      toast.error('?Œì‹± ?„ë£Œ???Œì¼???†ìŠµ?ˆë‹¤.'); return
    }
    goToPreviewWithFiles(uploadedFiles)
  }

  // ?€?€ ?•ì‚° ê³„ì‚° ?€?€
  const handlePreviewConfirm = async () => {
    // settingsê°€ ?†ìœ¼ë©?ê¸°ë³¸ ?¸ìœ¨ë¡?fallback (3.3% ?ì²œ??
    const effectiveSettings = settings ?? {
      id: 'default', user_id: null,
      insurance_rate: 0, income_tax_rate: 0.033,
      management_fee_type: 'fixed' as const, management_fee_value: 0,
      effective_from: '', note: null, created_at: '',
    }
    if (!settings) {
      toast('?¤ì •ê°’ì´ ?†ì–´ ê¸°ë³¸ ?¸ìœ¨(?ì²œ??3.3%)ë¡?ê³„ì‚°?©ë‹ˆ??', { icon: '? ï¸' })
    }

    const [promoRes, advanceRes] = await Promise.all([
      (() => { let q = supabase.from('promotions').select('*').or('settlement_id.is.null'); if (!isAdmin && userId) q = q.eq('user_id', userId); return q })(),
      (() => { let q = supabase.from('advance_payments').select('*').is('deducted_settlement_id', null); if (!isAdmin && userId) q = q.eq('user_id', userId); return q })(),
    ])
    const promotions: Promotion[] = promoRes.data ?? []
    const advances: AdvancePayment[] = advanceRes.data ?? []

    // ?¼ì´???°ê²°???‰ë§Œ ì¶”ì¶œ
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
        toast.error('?Œì‹±???¼ì´???°ì´?°ê? ?†ìŠµ?ˆë‹¤. ?Œì¼???¤ì‹œ ?…ë¡œ?œí•´ì£¼ì„¸??')
      } else {
        toast.error(`${unmapped}ëª…ì˜ ?¼ì´?”ê? ëª¨ë‘ ë¯¸ì—°ê²??íƒœ?…ë‹ˆ?? ?°ì¸¡ "?¼ì´???°ê²°" ?œë¡­?¤ìš´?ì„œ ?°ê²°?´ì£¼?¸ìš”.`)
      }
      return
    }

    // ê°™ì? riderIdê°€ ?¬ëŸ¬ ?‰ì¸ ê²½ìš° ?©ì‚°
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

    // ?…ë¡œ?œëœ ?Œì¼ ì¤?ì¿ íŒ¡?´ì¸ ë¡?ê°ì????Œì¼???ˆìœ¼ë©?platform??'coupang'?¼ë¡œ override
    const hasCoupangFile = uploadedFiles.some(f => f.detectedPlatform === 'coupang')
    const effectivePlatform = hasCoupangFile ? 'coupang' : (platform ?? 'baemin')

    const calc = calculateSettlement(inputs, effectiveSettings, promotions, advances, managementFees, weekStart, weekEnd, insuranceFees, effectivePlatform)
    setResults(calc)
    setStep('confirm')
  }

  // ?€?€ ?•ì‚° ?€???€?€
  const handleSave = async (status: 'draft' | 'confirmed') => {
    if (results.length === 0) { toast.error('?€?¥í•  ?•ì‚° ?°ì´?°ê? ?†ìŠµ?ˆë‹¤.'); return }
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
      toast.error('?•ì‚° ?ì„± ?¤íŒ¨: ' + settlementError?.message)
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
      toast.error('?ì„¸ ?°ì´???€???¤íŒ¨: ' + detailError.message)
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

    toast.success('?•ì‚°???€?¥ë˜?ˆìŠµ?ˆë‹¤.')
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
        <h2 className="text-2xl font-bold text-white">?•ì‚°?Œì¼ ?±ë¡</h2>
        <p className="text-slate-400 text-sm mt-1">?•ì‚° ê¸°ê°„??? íƒ?˜ê³  ?‘ì? ?Œì¼???…ë¡œ?œí•˜?¸ìš”</p>
      </div>

      {/* ì§„í–‰ ?¨ê³„ */}
      <div className="flex items-center gap-2">
        {(['upload', 'preview', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${step === s ? 'bg-blue-600 text-white' : (step === 'confirm' || (step === 'preview' && s === 'upload')) ? 'bg-emerald-800 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
              {i + 1}. {s === 'upload' ? '?Œì¼ ?…ë¡œ?? : s === 'preview' ? '?°ì´???•ì¸' : '?•ì‚° ê²°ê³¼'}
            </div>
            {i < 2 && <ChevronRight className="h-4 w-4 text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ?€?€ STEP 1: ?…ë¡œ???€?€ */}
      {step === 'upload' && (
        <div className="space-y-5">
          {/* ?•ì‚° ê¸°ê°„ ? íƒ */}
          <Card className="border-blue-700/40 bg-blue-900/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-blue-400 shrink-0" />
                <div className="flex-1">
                  <Label className="text-blue-300 text-sm font-medium block mb-1.5">?•ì‚° ê¸°ê°„ ? íƒ <span className="text-red-400">*</span></Label>
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

          {/* ?Œì¼ ?…ë¡œ???ì—­ */}
          <Card className="border-slate-700 bg-slate-900">
            <CardContent className="p-4 md:p-6 space-y-4">
              {/* ?œë˜ê·??œë¡­ ì¡?*/}
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
                  ?Œì¼???œë˜ê·¸í•˜ê±°ë‚˜ ?´ë¦­?˜ì—¬ ?…ë¡œ??
                </p>
                <p className="text-slate-500 text-xs">?¬ëŸ¬ ?Œì¼ ?™ì‹œ ?…ë¡œ??ê°€??Â· .xlsx, .xls, .csv</p>
              </div>

              {/* ?…ë¡œ?œëœ ?Œì¼ ëª©ë¡ */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map(uf => (
                    <div key={uf.id} className={`rounded-lg border p-3 space-y-2 transition-colors
                      ${uf.status === 'success' ? 'border-emerald-700/50 bg-emerald-900/10'
                        : uf.status === 'error' ? 'border-rose-700/50 bg-rose-900/10'
                        : 'border-slate-700 bg-slate-800/50'}`}>
                      {/* ?Œì¼ ?•ë³´ ??*/}
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

                      {/* ?ëŸ¬ ë©”ì‹œì§€ */}
                      {uf.errorMsg && (
                        <p className="text-rose-400 text-xs pl-6 flex items-center gap-1">
                          <Lock className="h-3 w-3 shrink-0" />{uf.errorMsg}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* ì¶”ê? ?…ë¡œ??ë²„íŠ¼ (?Œì¼ ?ˆì„ ?? */}
              {uploadedFiles.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />?Œì¼ ì¶”ê?
                </Button>
              )}
            </CardContent>
          </Card>

          {/* ?¤ìŒ ?¨ê³„ ë²„íŠ¼ */}
          {uploadedFiles.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                {successCount > 0 && <span className="text-emerald-400 font-medium">?Œì‹± ?„ë£Œ {successCount}ê°?/span>}
                {pendingCount > 0 && <span className="text-blue-400">ì²˜ë¦¬ ì¤?{pendingCount}ê°?/span>}
              </div>
              <Button onClick={handleGoToPreview} disabled={successCount === 0 || pendingCount > 0}
                className="bg-blue-600 hover:bg-blue-700 ml-auto">
                {pendingCount > 0 ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />?Œì‹± ì¤?..</> : '?°ì´???•ì¸ ??}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ?€?€ STEP 2: ?°ì´???•ì¸ ?€?€ */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* ê¸°ê°„ + ?Œì¼ëª?*/}
          <Card className="border-blue-700/40 bg-blue-900/10">
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <CalendarDays className="h-5 w-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-blue-300 text-xs mb-0.5">?•ì‚° ê¸°ê°„</p>
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

          {/* ê°‘ì? ?”ì•½ */}
          {summaryData && (
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: '?•ì‚°?ˆì •ê¸ˆì•¡ (P25)', value: summaryData.settledAmount,               color: 'violet' },
                { label: 'ì§€?¬ê?ë¦¬ë¹„ (F25)',   value: summaryData.branchFee,                   color: 'blue' },
                { label: 'ë¶€ê°€??(C31)',        value: summaryData.vatAmount,                   color: 'amber' },
                { label: 'ê³ ìš©ë³´í—˜?¬ì—…ì£?(I25)',value: summaryData.employerEmploymentInsurance, color: 'cyan' },
                { label: '?°ì¬ë³´í—˜?¬ì—…ì£?(K25)',value: summaryData.employerAccidentInsurance,   color: 'purple' },
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

          {/* ?¼ì´???•ì‚° ?°ì´???Œì´ë¸?*/}
          {(() => {
            const mappedRows   = parsedRows.filter(r => riderMapping[r.name] && riderMapping[r.name] !== 'none')
            const unmappedRows = parsedRows.filter(r => !riderMapping[r.name] || riderMapping[r.name] === 'none')

            const RiderRow = ({ row, i }: { row: typeof parsedRows[0]; i: number }) => {
              const mappedRider = riderMapping[row.name]
                ? riders.find(r => r.id === riderMapping[row.name])
                : null
              // User ID: ?¬ì´?¸ì— ?±ë¡??rider_username ?°ì„ , ?†ìœ¼ë©??Œì¼??userId
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
                      if (!rid || rid === 'none') return <span className="text-slate-600 text-xs">ë¯¸ì—°ê²?/span>
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
                        <SelectValue placeholder="?¼ì´??? íƒ" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-600">
                        <SelectItem value="none" className="text-slate-400">?°ê²° ?ˆí•¨</SelectItem>
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
                <TableHead className="text-slate-400 whitespace-nowrap">?¼ì´?”ëª…</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">ë°°ë‹¬ê±´ìˆ˜</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">ë°°ë‹¬ë£?/TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">ì¶”ê?ì§€ê¸?/TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">ì´ë°°?¬ë£Œ</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?œê°„?œë³´?˜ë£Œ</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">ì§€?¬í”„ë¡œëª¨??/TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">ê³ ìš©ë³´í—˜</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?°ì¬ë³´í—˜</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?¼ì´?”ë³„?•ì‚°ê¸ˆì•¡</TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?ì²œì§•ìˆ˜??/TableHead>
                <TableHead className="text-slate-400 text-right whitespace-nowrap">?¼ì´?”ë³„ì§€ê¸‰ê¸ˆ??/TableHead>
                <TableHead className="text-slate-400 whitespace-nowrap">?¼ì´???°ê²° *</TableHead>
              </TableRow>
            )

            return (
              <>
                {/* ë§¤í•‘???¼ì´???Œì´ë¸?*/}
                <Card className="border-slate-700 bg-slate-900">
                  <CardHeader>
                    <CardTitle className="text-white text-base flex items-center justify-between">
                      <span>?¼ì´???•ì‚° ?°ì´??({mappedRows.length}ëª?</span>
                      <div className="flex items-center gap-2 text-sm font-normal">
                        <span className="text-emerald-400 flex items-center gap-1">
                          <CheckCircle className="h-4 w-4" />{mappedRows.length}ëª?ë§¤í•‘ ?„ë£Œ
                        </span>
                        {unmappedRows.length > 0 && (
                          <span className="text-amber-400 flex items-center gap-1">
                            <AlertTriangle className="h-4 w-4" />{unmappedRows.length}ëª?ë¯¸ë§¤??
                          </span>
                        )}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    {mappedRows.length === 0 ? (
                      <div className="p-6 text-center text-slate-500 text-sm">
                        ë§¤í•‘???¼ì´?”ê? ?†ìŠµ?ˆë‹¤. ?„ë˜ ë¯¸ë§¤???¼ì´?”ë? ?°ê²°?´ì£¼?¸ìš”.
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

                {/* ë¯¸ë§¤???¼ì´?????‘ì„ ???ˆëŠ” ?¹ì…˜ */}
                {unmappedRows.length > 0 && (
                  <Card className="border-amber-700/30 bg-amber-900/5">
                    <CardHeader className="py-3">
                      <CardTitle className="text-amber-400 text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        ë¯¸ë§¤???¼ì´??({unmappedRows.length}ëª? ???¬ì´?¸ì— ?±ë¡?˜ì? ?Šì•˜ê±°ë‚˜ ?ë™ ?°ê²°???¤íŒ¨?ˆìŠµ?ˆë‹¤. ì§ì ‘ ?°ê²°?˜ê±°??ë¬´ì‹œ?˜ì„¸??
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
            <Button variant="ghost" onClick={() => setStep('upload')} className="text-slate-400 hover:text-white">???Œì¼ ?…ë¡œ??/Button>

            {/* ë¯¸ì—°ê²??¼ì´????ê²½ê³  */}
            {parsedRows.length > 0 && (() => {
              const unmapped = parsedRows.filter(r => !riderMapping[r.name] || riderMapping[r.name] === 'none').length
              if (unmapped === 0) return null
              return (
                <span className="text-amber-400 text-sm flex items-center gap-1">
                  <AlertTriangle className="h-4 w-4" />
                  {unmapped}ëª?ë¯¸ì—°ê²????°ê²° ??ê³„ì‚°?´ì£¼?¸ìš”
                </span>
              )
            })()}

            <Button
              onClick={handlePreviewConfirm}
              disabled={parsedRows.length === 0}
              className="bg-blue-600 hover:bg-blue-700 ml-auto disabled:opacity-50"
            >
              ?•ì‚° ê³„ì‚°?˜ê¸° ??
            </Button>
          </div>
        </div>
      )}

      {/* ?€?€ STEP 3: ?•ì‚° ê²°ê³¼ ?€?€ */}
      {step === 'confirm' && (
        <div className="space-y-4">
          {results.length === 0 ? (
            <Card className="border-amber-700/40 bg-amber-900/10">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-10 w-10 text-amber-400 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">?•ì‚° ê³„ì‚°???¼ì´?”ê? ?†ìŠµ?ˆë‹¤</p>
                <p className="text-slate-400 text-sm mb-4">
                  ?°ì´???•ì¸ ?¨ê³„?ì„œ ?°ì¸¡ <strong className="text-white">?¼ì´???°ê²°</strong> ?œë¡­?¤ìš´???µí•´<br />
                  ?Œì¼??ê¸°ì‚¬?€ ?¬ì´???±ë¡ ?¼ì´?”ë? ?°ê²°?????¤ì‹œ ê³„ì‚°?´ì£¼?¸ìš”.
                </p>
                <Button onClick={() => setStep('preview')} variant="outline" className="border-slate-600 text-slate-300">
                  ???°ì´???•ì¸?¼ë¡œ ?Œì•„ê°€ê¸?
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card className="border-slate-700 bg-slate-900">
                <CardHeader>
                  <CardTitle className="text-white text-base flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-emerald-400" />
                    ?•ì‚° ê³„ì‚° ?„ë£Œ ({weekStart} ~ {weekEnd})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3 mb-4">
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">ì´??¼ì´??/p>
                      <p className="text-white font-bold text-xl">{results.length}ëª?/p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">ì´??¸ê¸ˆ? ê³ ê¸ˆì•¡</p>
                      <p className="text-emerald-400 font-bold">{formatKRW(results.reduce((s, r) => s + r.taxBaseAmount, 0))}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">ì´??ì²œ??/p>
                      <p className="text-rose-400 font-bold">-{formatKRW(results.reduce((s, r) => s + r.incomeTaxDeduction, 0))}</p>
                    </div>
                    <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                      <p className="text-slate-400 text-xs">ì´?ìµœì¢…?•ì‚°ê¸ˆì•¡</p>
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
                          <TableHead className="text-slate-400 whitespace-nowrap">?¼ì´??/TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">ë°°ë‹¬ê±´ìˆ˜</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">ê¸°ë³¸?•ì‚°ê¸ˆì•¡</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap text-xs opacity-70">?´ë°°?¬ë£Œ</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap text-xs opacity-70">?´ì¶”ê°€ì§€ê¸?/TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?œê°„?œë³´?˜ë£Œ</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">ê³ ìš©ë³´í—˜</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?°ì¬ë³´í—˜</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">ì§€?¬í”„ë¡œëª¨??/TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">ì½œê?ë¦¬ë¹„</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?¸ê¸ˆ? ê³ ê¸ˆì•¡</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">?ì²œ??3.3%)</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">? ì?ê¸‰ê¸ˆ</TableHead>
                          <TableHead className="text-slate-400 text-right whitespace-nowrap">? ì?ê¸‰ê¸ˆ?Œìˆ˜</TableHead>
                          <TableHead className="text-slate-400 text-right font-bold whitespace-nowrap">ìµœì¢…?•ì‚°ê¸ˆì•¡</TableHead>
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
                <Button variant="ghost" onClick={() => setStep('preview')} className="text-slate-400 hover:text-white">???´ì „?¼ë¡œ</Button>
                <Button onClick={() => handleSave('draft')} disabled={saving} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}?„ì‹œ?€??
                </Button>
                <Button onClick={() => handleSave('confirmed')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}?•ì‚° ?•ì • ?€??
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
