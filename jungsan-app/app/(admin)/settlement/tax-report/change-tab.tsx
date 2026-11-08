'use client'

import { useMemo, useState } from 'react'
import { Rider } from '@/types'
import type { TaxReportMode } from '@/lib/tax-report/allocate'
import { formatSsn } from '@/lib/tax-report/allocate'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Search, Loader2 } from 'lucide-react'

export interface TaxReportSettingRow {
  id?: string
  rider_id: string
  tax_name: string | null
  tax_ssn: string | null
  mode: TaxReportMode
}

interface Draft {
  taxName: string
  taxSsn: string
  mode: TaxReportMode
}

const MODE_LABEL: Record<TaxReportMode, string> = {
  report: '정상 신고',
  split: '금액 나누기',
  exclude: '전체 신고 안 함',
}

export function TaxReportChangeTab({
  riders,
  ridersLoading,
  settings,
  saving,
  onSave,
  onReset,
}: {
  riders: Rider[]
  ridersLoading: boolean
  settings: TaxReportSettingRow[]
  saving: boolean
  onSave: (riderId: string, draft: { taxName: string; taxSsn: string; mode: TaxReportMode }) => Promise<boolean>
  onReset: (riderId: string) => Promise<boolean>
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>({ taxName: '', taxSsn: '', mode: 'report' })

  const settingByRider = useMemo(() => {
    const map = new Map<string, TaxReportSettingRow>()
    for (const row of settings) map.set(row.rider_id, row)
    return map
  }, [settings])

  const rows = useMemo(() => {
    const q = query.replace(/\s+/g, '').toLowerCase()
    const list = riders.map((rider) => ({ rider, setting: settingByRider.get(rider.id) }))
    const filtered = q
      ? list.filter(({ rider, setting }) => {
          const hay = [rider.name, rider.rider_username, rider.id_number, setting?.tax_name, setting?.tax_ssn]
            .filter(Boolean)
            .join(' ')
            .replace(/\s+/g, '')
            .toLowerCase()
          return hay.includes(q)
        })
      : list
    return filtered.sort((a, b) => {
      const aSet = a.setting ? 1 : 0
      const bSet = b.setting ? 1 : 0
      if (aSet !== bSet) return bSet - aSet
      return a.rider.name.localeCompare(b.rider.name, 'ko')
    })
  }, [riders, query, settingByRider])

  const selected = riders.find((r) => r.id === selectedId) ?? null

  const openRider = (rider: Rider) => {
    const setting = settingByRider.get(rider.id)
    setSelectedId(rider.id)
    setDraft({
      taxName: setting?.tax_name ?? '',
      taxSsn: setting?.tax_ssn ?? '',
      mode: setting?.mode ?? 'report',
    })
  }

  const toggleMode = (mode: 'split' | 'exclude') => {
    setDraft((prev) => ({ ...prev, mode: prev.mode === mode ? 'report' : mode }))
  }

  const counts = useMemo(() => ({
    rename: settings.filter((s) => s.mode === 'report' && (s.tax_name || s.tax_ssn)).length,
    split: settings.filter((s) => s.mode === 'split').length,
    exclude: settings.filter((s) => s.mode === 'exclude').length,
  }), [settings])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Badge variant="secondary" className="bg-slate-800 text-slate-200">이름·주민번호 변경 {counts.rename}</Badge>
        <Badge variant="secondary" className="bg-amber-950 text-amber-200">금액 나누기 {counts.split}</Badge>
        <Badge variant="secondary" className="bg-rose-950 text-rose-200">전체 신고 안 함 {counts.exclude}</Badge>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="라이더명, 아이디, 주민번호 검색"
          className="pl-9 bg-slate-900 border-slate-700 text-white"
        />
      </div>

      <div className="rounded-xl border border-slate-800 overflow-hidden">
        <div className="max-h-[62vh] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-800 hover:bg-transparent">
                <TableHead className="text-slate-400">라이더명</TableHead>
                <TableHead className="text-slate-400">기존 주민번호</TableHead>
                <TableHead className="text-slate-400">세금신고 이름</TableHead>
                <TableHead className="text-slate-400">세금신고 주민번호</TableHead>
                <TableHead className="text-slate-400">처리</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {ridersLoading && (
                <TableRow>
                  <TableCell colSpan={5} className="text-slate-400 text-center py-10">라이더를 불러오는 중입니다.</TableCell>
                </TableRow>
              )}
              {!ridersLoading && rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-slate-400 text-center py-10">검색 결과가 없습니다.</TableCell>
                </TableRow>
              )}
              {rows.map(({ rider, setting }) => (
                <TableRow
                  key={rider.id}
                  className="border-slate-800 cursor-pointer hover:bg-slate-900"
                  onClick={() => openRider(rider)}
                >
                  <TableCell className="text-white font-medium">{rider.name}</TableCell>
                  <TableCell className="text-slate-300">{formatSsn(rider.id_number) || '-'}</TableCell>
                  <TableCell className="text-slate-300">{setting?.tax_name || '-'}</TableCell>
                  <TableCell className="text-slate-300">{setting?.tax_ssn ? formatSsn(setting.tax_ssn) : '-'}</TableCell>
                  <TableCell>
                    <ModeBadge mode={setting?.mode ?? 'report'} changed={!!(setting?.tax_name || setting?.tax_ssn)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null) }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">세금신고 변경 · {selected?.name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <p className="text-xs text-slate-400">
                기존 주민번호 {formatSsn(selected.id_number) || '없음'}. 세금신고 이름·주민번호를 비우면 라이더 정보의 이름과 주민번호를 그대로 씁니다.
              </p>
              {selected.name.replace(/\s+/g, '') === '정호걸' && (
                <p className="text-xs text-amber-300">
                  정호걸은 세무서 신고 파일에서 합계가 항상 6,750,000원으로 맞춰집니다.
                </p>
              )}
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">세금신고 이름</Label>
                <Input
                  value={draft.taxName}
                  onChange={(e) => setDraft((d) => ({ ...d, taxName: e.target.value }))}
                  placeholder={selected.name}
                  disabled={draft.mode !== 'report'}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">세금신고 주민번호</Label>
                <Input
                  value={draft.taxSsn}
                  onChange={(e) => setDraft((d) => ({ ...d, taxSsn: e.target.value }))}
                  placeholder="000000-0000000"
                  disabled={draft.mode !== 'report'}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <p className="text-slate-300 text-sm font-medium">세금신고 안 함</p>
                <ModeCheck
                  checked={draft.mode === 'split'}
                  title="세금신고금액 라이더에 나누기"
                  desc="이 라이더는 신고 파일에 넣지 않고, 금액을 신고하는 라이더에게 10원 단위로 나눕니다."
                  onToggle={() => toggleMode('split')}
                />
                <ModeCheck
                  checked={draft.mode === 'exclude'}
                  title="전체신고안하기"
                  desc="이 라이더는 신고 파일에 나오지 않고, 금액도 버려집니다."
                  onToggle={() => toggleMode('exclude')}
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-300 border border-slate-700"
                  disabled={saving || !settingByRider.get(selected.id)}
                  onClick={() => { void onReset(selected.id).then((ok) => { if (ok) setSelectedId(null) }) }}
                >
                  기본값
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-teal-600 hover:bg-teal-700"
                  disabled={saving}
                  onClick={() => { void onSave(selected.id, draft).then((ok) => { if (ok) setSelectedId(null) }) }}
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  저장
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ModeBadge({ mode, changed }: { mode: TaxReportMode; changed: boolean }) {
  if (mode === 'split') return <Badge className="bg-amber-600 hover:bg-amber-600">금액 나누기</Badge>
  if (mode === 'exclude') return <Badge className="bg-rose-600 hover:bg-rose-600">신고 안 함</Badge>
  if (changed) return <Badge className="bg-teal-700 hover:bg-teal-700">이름·주민 변경</Badge>
  return <span className="text-slate-500 text-sm">{MODE_LABEL.report}</span>
}

function ModeCheck({
  checked,
  title,
  desc,
  onToggle,
}: {
  checked: boolean
  title: string
  desc: string
  onToggle: () => void
}) {
  return (
    <label className={`flex items-start gap-3 rounded-lg border p-3 cursor-pointer ${checked ? 'border-teal-600 bg-teal-950/40' : 'border-slate-700'}`}>
      <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 accent-teal-500" />
      <span>
        <span className="block text-sm text-white">{title}</span>
        <span className="block text-xs text-slate-400 mt-1">{desc}</span>
      </span>
    </label>
  )
}
