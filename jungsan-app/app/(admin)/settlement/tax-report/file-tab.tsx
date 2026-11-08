'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Rider } from '@/types'
import { allocateTaxReport, aggregateAmounts } from '@/lib/tax-report/allocate'
import { buildTaxInputs } from '@/lib/tax-report/inputs'
import { parseSettlementWorkbook, type ParsedSettlementFile } from '@/lib/tax-report/parse-settlement-excel'
import { downloadBusinessIncomeFile, filePeriod, periodOverlapsMonth } from '@/lib/tax-report/business-income'
import type { TaxReportSettingRow } from '@/app/(admin)/settlement/tax-report/change-tab'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { formatKRW } from '@/lib/utils'
import { Download, FileSpreadsheet, Save, Upload, X } from 'lucide-react'
import { toast } from 'sonner'

interface MonthSummary {
  month: string
  supplyAmount: number
  reportAmount: number
  difference: number
  weekCount: number
  saved?: boolean
}

interface SavedFiling {
  month: string
  savedAt: string
  supplyAmount: number
  files: ParsedSettlementFile[]
}

export function TaxReportFileTab({
  riders,
  settings,
  settingsLoaded,
  onReloadSettings,
}: {
  riders: Rider[]
  settings: TaxReportSettingRow[]
  settingsLoaded: boolean
  onReloadSettings: () => Promise<TaxReportSettingRow[] | null>
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [month, setMonth] = useState('')
  const [months, setMonths] = useState<MonthSummary[]>([])
  const [monthsLoading, setMonthsLoading] = useState(true)
  const [monthsRefresh, setMonthsRefresh] = useState(0)
  const [drafts, setDrafts] = useState<Record<string, ParsedSettlementFile[]>>({})
  const [filings, setFilings] = useState<Record<string, SavedFiling>>({})
  const [reading, setReading] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [saving, setSaving] = useState(false)

  const settingsKey = settings.map((row) => `${row.rider_id}:${row.mode}:${row.source_name ?? ''}`).join('|')

  useEffect(() => {
    if (!settingsLoaded) return
    let cancelled = false
    fetch('/api/tax-report/monthly', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          toast.error(typeof data.error === 'string' ? data.error : '월별 집계를 불러오지 못했습니다.')
          return
        }
        const list = Array.isArray(data.months) ? data.months as MonthSummary[] : []
        setMonths(list)
        setMonth((prev) => prev || list[0]?.month || currentMonth())
      })
      .catch(() => {
        if (!cancelled) toast.error('월별 집계를 불러오지 못했습니다.')
      })
      .finally(() => {
        if (!cancelled) setMonthsLoading(false)
      })
    return () => { cancelled = true }
  }, [settingsLoaded, settingsKey, monthsRefresh])

  useEffect(() => {
    if (!settingsLoaded) return
    let cancelled = false
    fetch('/api/tax-report/filings', { credentials: 'same-origin', cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          toast.error(typeof data.error === 'string' ? data.error : '저장된 신고 파일을 불러오지 못했습니다.')
          return
        }
        const next: Record<string, SavedFiling> = {}
        for (const row of Array.isArray(data.filings) ? data.filings : []) {
          if (!row || typeof row.month !== 'string' || !Array.isArray(row.files)) continue
          next[row.month] = row as SavedFiling
        }
        setFilings(next)
      })
      .catch(() => {
        if (!cancelled) toast.error('저장된 신고 파일을 불러오지 못했습니다.')
      })
    return () => { cancelled = true }
  }, [settingsLoaded, monthsRefresh])

  const files = drafts[month] ?? filings[month]?.files ?? []
  const dirty = drafts[month] != null

  const inputs = useMemo(() => buildTaxInputs(riders, settings), [riders, settings])

  const result = useMemo(() => {
    if (files.length === 0) return null
    const amounts = aggregateAmounts(files.flatMap((f) => f.rows))
    return allocateTaxReport(amounts, inputs)
  }, [files, inputs])

  const selected = months.find((item) => item.month === month) ?? null
  const outsideFiles = files.filter((file) => {
    const period = filePeriod(file.fileName, file.period)
    return month && period && !periodOverlapsMonth(period.start, period.end, month)
  })

  const addFiles = async (list: FileList | File[]) => {
    if (!month) {
      toast.error('신고월을 먼저 선택해 주세요.')
      return
    }
    const picked = [...list].filter((f) => /\.xlsx?$/i.test(f.name))
    if (picked.length === 0) {
      toast.error('xlsx 또는 xls 파일만 올릴 수 있습니다.')
      return
    }
    setReading(true)
    try {
      await onReloadSettings()
      const parsed = await Promise.all(
        picked.map(async (file) => parseSettlementWorkbook(await file.arrayBuffer(), file.name)),
      )
      for (const file of parsed.filter((item) => item.error)) toast.error(`${file.fileName}: ${file.error}`)
      const ok = parsed.filter((item) => !item.error)
      if (ok.length === 0) return
      setDrafts((prev) => {
        const base = prev[month] ?? filings[month]?.files ?? []
        const map = new Map(base.map((file) => [file.fileName, file]))
        for (const file of ok) map.set(file.fileName, file)
        return { ...prev, [month]: [...map.values()] }
      })
    } finally {
      setReading(false)
    }
  }

  const download = async () => {
    if (!month) {
      toast.error('신고월을 선택해 주세요.')
      return
    }
    if (files.length === 0) {
      toast.error('세금신고용 정산 파일을 먼저 등록해 주세요.')
      return
    }
    setDownloading(true)
    try {
      const fresh = await onReloadSettings()
      const allocated = allocateTaxReport(
        aggregateAmounts(files.flatMap((file) => file.rows)),
        buildTaxInputs(riders, fresh ?? settings),
      )
      if (allocated.lines.length === 0) {
        toast.error('신고할 금액이 없습니다.')
        return
      }
      await downloadBusinessIncomeFile(allocated.lines, month)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '파일 생성에 실패했습니다.')
    } finally {
      setDownloading(false)
    }
  }

  const saveFiling = async () => {
    if (!month) {
      toast.error('신고월을 선택해 주세요.')
      return
    }
    if (files.length === 0) {
      toast.error('저장할 정산 파일이 없습니다.')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/tax-report/filings', {
        method: 'PUT',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month,
          supplyAmount: selected?.supplyAmount ?? filings[month]?.supplyAmount ?? 0,
          files: files.map(({ fileName, sheetName, period, rows }) => ({ fileName, sheetName, period, rows })),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(typeof data.error === 'string' ? data.error : '저장에 실패했습니다.')
        return
      }
      if (data.filing?.month) {
        setFilings((prev) => ({ ...prev, [data.filing.month]: data.filing }))
      }
      setDrafts((prev) => {
        const next = { ...prev }
        delete next[month]
        return next
      })
      setMonthsRefresh((value) => value + 1)
      toast.success('저장했습니다. 다음에도 이 내역으로 엑셀을 받을 수 있습니다.')
    } catch {
      toast.error('저장에 실패했습니다.')
    } finally {
      setSaving(false)
    }
  }

  const removeFile = (fileName: string) => {
    setDrafts((prev) => {
      const base = prev[month] ?? filings[month]?.files ?? []
      return { ...prev, [month]: base.filter((item) => item.fileName !== fileName) }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="space-y-1">
          <span className="block text-xs text-slate-400">신고월</span>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-10 rounded-md border border-slate-700 bg-slate-900 px-3 text-white"
            style={{ colorScheme: 'dark' }}
          />
        </label>
        <p className="text-xs text-slate-500 pb-2">정산 종료일이 속한 달로 공급가액과 신고금액을 모읍니다.</p>
      </div>

      <p className="text-xs text-slate-400">
        저장된 금액 나누기 {settings.filter((row) => row.mode === 'split').length}명, 전체 신고 안 함 {settings.filter((row) => row.mode === 'exclude').length}명은 다시 바꾸기 전까지 모든 신고월에 적용됩니다.
      </p>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">월</TableHead>
              <TableHead className="text-slate-400 text-right">공급가액</TableHead>
              <TableHead className="text-slate-400 text-right">신고금액</TableHead>
              <TableHead className="text-slate-400 text-right">차이</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {monthsLoading && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-400 py-8">월별 금액을 불러오는 중입니다.</TableCell>
              </TableRow>
            )}
            {!monthsLoading && months.length === 0 && (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-slate-400 py-8">등록된 정산 파일이 없습니다.</TableCell>
              </TableRow>
            )}
            {months.map((item) => (
              <TableRow
                key={item.month}
                className={`border-slate-800 cursor-pointer ${item.month === month ? 'bg-teal-950/40' : ''}`}
                onClick={() => setMonth(item.month)}
              >
                <TableCell className="text-white">
                  {formatMonth(item.month)}
                  <span className="block text-xs text-slate-500">
                    {item.weekCount}주{item.saved ? ' · 저장됨' : ''}
                  </span>
                </TableCell>
                <TableCell className="text-right text-slate-200">{formatKRW(item.supplyAmount)}</TableCell>
                <TableCell className="text-right text-slate-200">{formatKRW(item.reportAmount)}</TableCell>
                <TableCell className={`text-right font-medium ${item.difference === 0 ? 'text-slate-300' : item.difference > 0 ? 'text-amber-300' : 'text-rose-300'}`}>
                  {formatKRW(item.difference)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {selected && result && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <SummaryCard label={`${formatMonth(month)} 공급가액`} value={formatKRW(selected.supplyAmount)} />
          <SummaryCard label="이번 파일 신고합계" value={formatKRW(result.finalTotal)} />
          <SummaryCard label="공급가액 − 신고합계" value={formatKRW(selected.supplyAmount - result.finalTotal)} />
        </div>
      )}

      <div
        className="rounded-xl border border-dashed border-slate-700 bg-slate-900/60 p-6 text-center"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void addFiles(e.dataTransfer.files)
        }}
      >
        <FileSpreadsheet className="h-8 w-8 text-teal-400 mx-auto mb-2" />
        <p className="text-white text-sm font-medium">선택한 신고월의 주간 정산 엑셀을 올리세요</p>
        <p className="text-slate-400 text-xs mt-1">전체정산 시트의 라이더명과 세금신고금액을 합쳐 세무사 제출 양식으로 만듭니다.</p>
        <Button
          type="button"
          className="mt-4 bg-teal-600 hover:bg-teal-700"
          disabled={reading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4" />
          {reading ? '읽는 중' : '파일 선택'}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((file) => {
            const period = filePeriod(file.fileName, file.period)
            const outside = month && period && !periodOverlapsMonth(period.start, period.end, month)
            return (
              <div key={file.fileName} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${outside ? 'border-amber-700 text-amber-200' : 'border-slate-800 text-slate-300 bg-slate-900'}`}>
                <span className="max-w-[240px] truncate">{file.fileName}</span>
                <span className="text-slate-500">{file.rows.length}명</span>
                <button type="button" className="text-slate-500 hover:text-white" onClick={() => removeFile(file.fileName)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
      {outsideFiles.length > 0 && (
        <p className="text-xs text-amber-300">선택한 신고월과 기간이 겹치지 않는 파일이 {outsideFiles.length}개 있습니다. 그대로 두면 이 신고월 파일에 포함됩니다.</p>
      )}

      {result && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <SummaryCard label="원본 합계" value={formatKRW(result.originalTotal)} />
            <SummaryCard label="정호걸 최종" value={result.jeongFinal == null ? '-' : formatKRW(result.jeongFinal)} />
            <SummaryCard label="10원 절사" value={formatKRW(result.discarded)} />
            <SummaryCard label="최종 신고 합계" value={formatKRW(result.finalTotal)} />
          </div>

          {result.notes.length > 0 && (
            <div className="rounded-xl border border-slate-800 bg-slate-900 p-4 space-y-1">
              {result.notes.map((note) => (
                <p key={note} className="text-sm text-slate-300">{note}</p>
              ))}
              {result.missingSsn.length > 0 && (
                <p className="text-sm text-amber-300">
                  주민번호가 없는 신고 대상 {result.missingSsn.length}명: {result.missingSsn.slice(0, 8).join(', ')}
                  {result.missingSsn.length > 8 ? ' 외' : ''}
                </p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" className="bg-teal-600 hover:bg-teal-700" disabled={downloading || result.lines.length === 0} onClick={() => { void download() }}>
              <Download className="h-4 w-4" />
              {downloading ? '만드는 중' : '세무사 제출 파일 다운로드'}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-slate-600 bg-slate-900 text-white hover:bg-slate-800"
              disabled={saving || !dirty || result.lines.length === 0}
              onClick={() => { void saveFiling() }}
            >
              <Save className="h-4 w-4" />
              {saving ? '저장 중' : dirty ? '저장' : '저장됨'}
            </Button>
          </div>

          <div className="rounded-xl border border-slate-800 overflow-hidden">
            <div className="max-h-[56vh] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">성명</TableHead>
                    <TableHead className="text-slate-400">주민등록번호</TableHead>
                    <TableHead className="text-slate-400 text-right">원본</TableHead>
                    <TableHead className="text-slate-400 text-right">배분</TableHead>
                    <TableHead className="text-slate-400 text-right">차감</TableHead>
                    <TableHead className="text-slate-400 text-right">세금신고금액</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {result.lines.map((line) => (
                    <TableRow key={`${line.sourceName}-${line.reportName}`} className="border-slate-800">
                      <TableCell className={line.isJeong ? 'text-amber-300 font-semibold' : 'text-white'}>
                        {line.reportName}
                        {line.reportName !== line.sourceName && (
                          <span className="block text-xs text-slate-500">원본 {line.sourceName}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-300">{line.ssn || '-'}</TableCell>
                      <TableCell className="text-right text-slate-400">{line.originalAmount.toLocaleString('ko-KR')}</TableCell>
                      <TableCell className="text-right text-slate-300">{line.distributed ? line.distributed.toLocaleString('ko-KR') : '-'}</TableCell>
                      <TableCell className="text-right text-slate-300">{line.deducted ? line.deducted.toLocaleString('ko-KR') : '-'}</TableCell>
                      <TableCell className="text-right text-white font-medium">{line.finalAmount.toLocaleString('ko-KR')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function formatMonth(month: string) {
  const [year, mon] = month.split('-')
  return `${year}년 ${Number(mon)}월`
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="bg-slate-900 border-slate-800">
      <CardContent className="p-4">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-white font-semibold mt-1">{value}</p>
      </CardContent>
    </Card>
  )
}
