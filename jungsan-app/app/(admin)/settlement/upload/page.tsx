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

// ── 주간 옵션 (수~화) ──
function getWeekOptions() {
  const options: { label: string; value: string; endValue: string }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const daysBack = (today.getDay() - 3 + 7) % 7
  const baseWed = new Date(today)
  baseWed.setDate(today.getDate() - daysBack)
  const dl = ['일', '월', '화', '수', '목', '금', '토']
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

  // 사업자등록번호(숫자만) - 암호화 파일 자동 비밀번호 (ref로 항상 최신값 유지)
  const autoPasswordRef = useRef<string>('')

  // 기간 선택
  const [selectedWeek, setSelectedWeek] = useState(weekOptions[0]?.value ?? '')
  const weekStart = selectedWeek
  const weekEnd = weekOptions.find(w => w.value === selectedWeek)?.endValue ?? ''

  // 파일 목록
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

  // 사업자등록번호 원본 ref (서버 API에 전달용)
  const rawBizNumRef = useRef<string>('')

  // 프로필에서 사업자등록번호 캐시
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
    // 유저별 설정 우선 조회, 없으면 글로벌(user_id IS NULL) 설정 사용
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

  // ── 프로모션 미리보기 계산 ──
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

  // ── 핵심 파싱 로직 (서버 API 호출) ──
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
        return {
          success: true, rows: data.rows, summary: data.summary,
          detectedPlatform: data.detectedPlatform,
          isPasswordRequired: false,
        }
      }
      return {
        success: false, rows: [],
        isPasswordRequired: !!data.isPasswordRequired,
        errorMsg: data.error ?? '파싱 실패',
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e)
      return { success: false, rows: [], isPasswordRequired: false, errorMsg: '요청 실패: ' + msg }
    }
  }

  // ── 단일 파일 파싱 (state 업데이트) ──
  // 서버(API)에서 사업자등록번호 여러 형식으로 자동 시도하므로 클라이언트는 1회 호출만
  const parseFile = async (id: string, file: File) => {
    setUploadedFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'parsing', errorMsg: undefined } : f))
    // bizNum을 아직 못 가져왔으면 먼저 조회
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

  // ── 파일 추가 ──
  const addFiles = useCallback((files: File[]) => {
    const newEntries: UploadedFile[] = files
      .filter(f => /\.(xlsx|xls|csv)$/i.test(f.name))
      .map(f => ({
        id: `${Date.now()}_${Math.random()}`,
        file: f,
        status: 'pending' as FileStatus,
        rows: [],
      }))
    if (newEntries.length === 0) { toast.error('.xlsx, .xls, .csv 파일만 업로드 가능합니다.'); return }
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

  // ── 파일 목록으로 preview 이동 ──
  const goToPreviewWithFiles = (files: UploadedFile[]) => {
    const successFiles = files.filter(f => f.status === 'success')
    if (successFiles.length === 0) return

    // ── 1단계: 이름 → userId 역방향 인덱스 구축 ──
    // 어떤 파일이든 userId 가 있는 행이 있으면 그 userId 를 정규 키로 사용
    const nameToUserId = new Map<string, string>()
    for (const uf of successFiles) {
      for (const row of uf.rows) {
        const uid = (row.userId ?? '').trim().toLowerCase()
        const nm  = row.name.replace(/\s/g, '').toLowerCase()
        if (uid) nameToUserId.set(nm, uid)
      }
    }

    // ── 2단계: 라이더별 합산 (여러 파일 동일 라이더 데이터 병합) ──
    // 정규 키: userId > 이름으로 역조회된 userId > 정규화된 이름
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

    // 갑지 summary 합산
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

    // 라이더 자동 매핑 (이름 또는 userId로)
    const mapping: Record<string, string> = {}
    for (const row of merged) {
      const matched = riders.find(r =>
        r.name === row.name ||
        r.name.replace(/\s/g, '') === row.name.replace(/\s/g, '') ||
        (row.userId && (r.rider_username === row.userId || r.rider_username?.replace(/\s/g, '') === row.userId.replace(/\s/g, '')))
      )
      if (matched) mapping[row.name] = matched.id
    }
    setRiderMapping(mapping)
    setStep('preview')
  }

  // ── 다음 단계 버튼 ──
  const handleGoToPreview = () => {
    if (uploadedFiles.filter(f => f.status === 'success').length === 0) {
      toast.error('파싱 완료된 파일이 없습니다.'); return
    }
    goToPreviewWithFiles(uploadedFiles)
  }

  // ── 정산 계산 ──
  const handlePreviewConfirm = async () => {
    if (!settings) { toast.error('보험/세금 설정이 없습니다. 설정 탭에서 먼저 등록해주세요.'); return }
    const [promoRes, advanceRes] = await Promise.all([
      (() => { let q = supabase.from('promotions').select('*').or('settlement_id.is.null'); if (!isAdmin && userId) q = q.eq('user_id', userId); return q })(),
      (() => { let q = supabase.from('advance_payments').select('*').is('deducted_settlement_id', null); if (!isAdmin && userId) q = q.eq('user_id', userId); return q })(),
    ])
    const promotions: Promotion[] = promoRes.data ?? []
    const advances: AdvancePayment[] = advanceRes.data ?? []

    // 라이더 연결된 행만 추출
    const rawInputs = parsedRows
      .filter(r => riderMapping[r.name] && riderMapping[r.name] !== 'none')
      .map(r => {
        const rId = riderMapping[r.name]
        // DB 라이더 목록에서 공식 이름 조회 (없으면 파일의 이름 사용)
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

    // 같은 riderId 가 여러 행에 연결된 경우(파일 중복 등) riderId 기준으로 합산
    // → 합산된 배달건수·금액을 기준으로 프로모션/관리비가 올바르게 적용됨
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

    // 업로드된 파일 중 쿠팡이츠로 감지된 파일이 있으면 platform을 'coupang'으로 override
    const hasCoupangFile = uploadedFiles.some(f => f.detectedPlatform === 'coupang')
    const effectivePlatform = hasCoupangFile ? 'coupang' : (platform ?? 'baemin')

    const calc = calculateSettlement(inputs, settings, promotions, advances, managementFees, weekStart, weekEnd, insuranceFees, effectivePlatform)
    setResults(calc)
    setStep('confirm')
  }

  // ── 정산 저장 ──
  const handleSave = async (status: 'draft' | 'confirmed') => {
    if (results.length === 0) { toast.error('저장할 정산 데이터가 없습니다.'); return }
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
      toast.error('정산 생성 실패: ' + settlementError?.message)
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
      toast.error('상세 데이터 저장 실패: ' + detailError.message)
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

    toast.success('정산이 저장되었습니다.')
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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">정산파일 등록</h2>
        <p className="text-slate-400 text-sm mt-1">정산 기간을 선택하고 엑셀 파일을 업로드하세요</p>
      </div>

      {/* 진행 단계 */}
      <div className="flex items-center gap-2">
        {(['upload', 'preview', 'confirm'] as Step[]).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors
              ${step === s ? 'bg-blue-600 text-white' : (step === 'confirm' || (step === 'preview' && s === 'upload')) ? 'bg-emerald-800 text-emerald-300' : 'bg-slate-800 text-slate-500'}`}>
              {i + 1}. {s === 'upload' ? '파일 업로드' : s === 'preview' ? '데이터 확인' : '정산 결과'}
            </div>
            {i < 2 && <ChevronRight className="h-4 w-4 text-slate-600" />}
          </div>
        ))}
      </div>

      {/* ── STEP 1: 업로드 ── */}
      {step === 'upload' && (
        <div className="space-y-5">
          {/* 정산 기간 선택 */}
          <Card className="border-blue-700/40 bg-blue-900/10">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <CalendarDays className="h-5 w-5 text-blue-400 shrink-0" />
                <div className="flex-1">
                  <Label className="text-blue-300 text-sm font-medium block mb-1.5">정산 기간 선택 <span className="text-red-400">*</span></Label>
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

          {/* 파일 업로드 영역 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardContent className="p-6 space-y-4">
              {/* 드래그&드롭 존 */}
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
                  파일을 드래그하거나 클릭하여 업로드
                </p>
                <p className="text-slate-500 text-xs">여러 파일 동시 업로드 가능 · .xlsx, .xls, .csv</p>
              </div>

              {/* 업로드된 파일 목록 */}
              {uploadedFiles.length > 0 && (
                <div className="space-y-2">
                  {uploadedFiles.map(uf => (
                    <div key={uf.id} className={`rounded-lg border p-3 space-y-2 transition-colors
                      ${uf.status === 'success' ? 'border-emerald-700/50 bg-emerald-900/10'
                        : uf.status === 'error' ? 'border-rose-700/50 bg-rose-900/10'
                        : 'border-slate-700 bg-slate-800/50'}`}>
                      {/* 파일 정보 행 */}
                      <div className="flex items-center gap-2">
                        {statusIcon(uf.status)}
                        <FileSpreadsheet className="h-4 w-4 text-slate-400 shrink-0" />
                        <span className="text-white text-sm flex-1 truncate">{uf.file.name}</span>
                        <span className="text-slate-500 text-xs shrink-0">{(uf.file.size / 1024).toFixed(0)}KB</span>
                        {uf.status === 'success' && (
                          <span className="text-emerald-400 text-xs shrink-0">{uf.rows.length}행</span>
                        )}
                        <button onClick={() => removeFile(uf.id)} className="text-slate-500 hover:text-rose-400 transition-colors p-0.5 shrink-0">
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {/* 에러 메시지 */}
                      {uf.errorMsg && (
                        <p className="text-rose-400 text-xs pl-6 flex items-center gap-1">
                          <Lock className="h-3 w-3 shrink-0" />{uf.errorMsg}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* 추가 업로드 버튼 (파일 있을 때) */}
              {uploadedFiles.length > 0 && (
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}
                  className="border-slate-600 text-slate-300 hover:bg-slate-800 h-8 text-xs">
                  <Plus className="h-3.5 w-3.5 mr-1" />파일 추가
                </Button>
              )}
            </CardContent>
          </Card>

          {/* 다음 단계 버튼 */}
          {uploadedFiles.length > 0 && (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm">
                {successCount > 0 && <span className="text-emerald-400 font-medium">파싱 완료 {successCount}개</span>}
                {pendingCount > 0 && <span className="text-blue-400">처리 중 {pendingCount}개</span>}
              </div>
              <Button onClick={handleGoToPreview} disabled={successCount === 0 || pendingCount > 0}
                className="bg-blue-600 hover:bg-blue-700 ml-auto">
                {pendingCount > 0 ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />파싱 중...</> : '데이터 확인 →'}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── STEP 2: 데이터 확인 ── */}
      {step === 'preview' && (
        <div className="space-y-4">
          {/* 기간 + 파일명 */}
          <Card className="border-blue-700/40 bg-blue-900/10">
            <CardContent className="p-4 flex items-center gap-3 flex-wrap">
              <CalendarDays className="h-5 w-5 text-blue-400 shrink-0" />
              <div>
                <p className="text-blue-300 text-xs mb-0.5">정산 기간</p>
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

          {/* 갑지 요약 */}
          {summaryData && (
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: '정산예정금액 (P25)', value: summaryData.settledAmount,               color: 'violet' },
                { label: '지사관리비 (F25)',   value: summaryData.branchFee,                   color: 'blue' },
                { label: '부가세 (C31)',        value: summaryData.vatAmount,                   color: 'amber' },
                { label: '고용보험사업주 (I25)',value: summaryData.employerEmploymentInsurance, color: 'cyan' },
                { label: '산재보험사업주 (K25)',value: summaryData.employerAccidentInsurance,   color: 'purple' },
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

          {/* 을지 라이더 데이터 테이블 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center justify-between">
                <span>라이더 정산 데이터 ({parsedRows.length}명)</span>
                <div className="flex items-center gap-2 text-sm font-normal">
                  {mappedCount === parsedRows.length
                    ? <span className="text-emerald-400 flex items-center gap-1"><CheckCircle className="h-4 w-4" />{mappedCount}명 전체 매핑</span>
                    : <span className="text-amber-400 flex items-center gap-1"><AlertTriangle className="h-4 w-4" />{mappedCount}/{parsedRows.length}명 매핑</span>}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400 whitespace-nowrap">User ID</TableHead>
                      <TableHead className="text-slate-400 whitespace-nowrap">라이더명</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">배달건수</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">배달료</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">추가지급</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">총배달료</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">시간제보험료</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">지사프로모션</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">고용보험</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">산재보험</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">라이더별정산금액</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">원천징수액</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">라이더별지급금액</TableHead>
                      <TableHead className="text-slate-400 whitespace-nowrap">라이더 연결 *</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.map((row, i) => (
                      <TableRow key={i} className="border-slate-700 hover:bg-slate-800/50">
                        <TableCell className="text-slate-400 text-sm whitespace-nowrap">{row.userId || '-'}</TableCell>
                        <TableCell className="text-white font-medium whitespace-nowrap">{row.name}</TableCell>
                        <TableCell className="text-slate-300 text-right whitespace-nowrap">{row.deliveryCount.toLocaleString()}</TableCell>
                        <TableCell className="text-slate-300 text-right whitespace-nowrap">{formatKRW(row.deliveryFee)}</TableCell>
                        <TableCell className="text-slate-300 text-right whitespace-nowrap">{formatKRW(row.additionalPay)}</TableCell>
                        <TableCell className="text-emerald-400 text-right font-medium whitespace-nowrap">{formatKRW(row.totalDeliveryFee)}</TableCell>
                        <TableCell className="text-amber-400 text-right whitespace-nowrap">{row.hourlyInsurance > 0 ? formatKRW(row.hourlyInsurance) : '-'}</TableCell>
                        <TableCell className="text-violet-400 text-right whitespace-nowrap">
                          {(() => {
                            const rid = riderMapping[row.name]
                            if (!rid) return <span className="text-slate-600 text-xs">미연결</span>
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
                            <SelectTrigger className={`w-40 h-8 text-sm ${riderMapping[row.name] ? 'bg-emerald-900/20 border-emerald-700' : 'bg-slate-800 border-slate-600'} text-white`}>
                              <SelectValue placeholder="라이더 선택" />
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-600">
                              <SelectItem value="none" className="text-slate-400">연결 안함</SelectItem>
                              {riders.map(r => <SelectItem key={r.id} value={r.id} className="text-white">{r.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button variant="ghost" onClick={() => setStep('upload')} className="text-slate-400 hover:text-white">← 파일 업로드</Button>
            <Button onClick={handlePreviewConfirm} className="bg-blue-600 hover:bg-blue-700">정산 계산하기 →</Button>
          </div>
        </div>
      )}

      {/* ── STEP 3: 정산 결과 ── */}
      {step === 'confirm' && (
        <div className="space-y-4">
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-emerald-400" />
                정산 계산 완료 ({weekStart} ~ {weekEnd})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-3 mb-4">
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-slate-400 text-xs">총 라이더</p>
                  <p className="text-white font-bold text-xl">{results.length}명</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-slate-400 text-xs">총 세금신고금액</p>
                  <p className="text-emerald-400 font-bold">{formatKRW(results.reduce((s, r) => s + r.taxBaseAmount, 0))}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-slate-400 text-xs">총 원천세</p>
                  <p className="text-rose-400 font-bold">-{formatKRW(results.reduce((s, r) => s + r.incomeTaxDeduction, 0))}</p>
                </div>
                <div className="bg-slate-800/50 rounded-lg p-3 text-center">
                  <p className="text-slate-400 text-xs">총 최종정산금액</p>
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
                      <TableHead className="text-slate-400 whitespace-nowrap">라이더</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">배달건수</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">기본정산금액</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap text-xs opacity-70">ㄴ배달료</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap text-xs opacity-70">ㄴ추가지급</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">시간제보험료</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">고용보험</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">산재보험</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">지사프로모션</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">콜관리비</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">세금신고금액</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">원천세(3.3%)</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">선지급금</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">선지급금회수</TableHead>
                      <TableHead className="text-slate-400 text-right font-bold whitespace-nowrap">최종정산금액</TableHead>
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
            <Button variant="ghost" onClick={() => setStep('preview')} className="text-slate-400 hover:text-white">← 이전으로</Button>
            <Button onClick={() => handleSave('draft')} disabled={saving} variant="outline" className="border-slate-600 text-slate-300 hover:bg-slate-800">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}임시저장
            </Button>
            <Button onClick={() => handleSave('confirmed')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}정산 확정 저장
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
