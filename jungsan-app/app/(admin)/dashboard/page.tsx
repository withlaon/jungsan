'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useSettlements } from '@/hooks/useSettlements'
import { readAggCache, writeAggCache, readDetailsCache, writeDetailsCache, type AggDetailRow } from '@/hooks/settlementViewCache'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarDays, TrendingUp, Building2, Percent, ShieldCheck, Gift, Phone, Users, Receipt, BarChart2, Wallet } from 'lucide-react'
import { SettlementDetail } from '@/types'
import { formatKRW } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid,
} from 'recharts'

export default function DashboardPage() {
  const { settlements, loading: settlementsLoading } = useSettlements()
  const [selectedId, setSelectedId] = useState<string>('')
  const [details, setDetails] = useState<SettlementDetail[]>([])
  const [allAgg, setAllAgg] = useState<AggDetailRow[]>([])
  const [aggLoading, setAggLoading] = useState(false)

  // settlements 로드 후 첫 번째 항목 자동 선택
  useEffect(() => {
    if (settlements.length > 0 && !selectedId) {
      setSelectedId(settlements[0].id)
    }
  }, [settlements, selectedId])

  // 차트용 집계 데이터 — 동일 ID 집합이면 모듈 캐시 재사용(탭 이동 시 즉시 표시)
  const idsSortedKey = useMemo(
    () => [...settlements.map((s) => s.id)].sort().join(','),
    [settlements],
  )

  useEffect(() => {
    if (settlements.length === 0) {
      setAllAgg([])
      return
    }
    const cached = readAggCache(idsSortedKey)
    if (cached) {
      setAllAgg(cached)
      setAggLoading(false)
      return
    }
    setAggLoading(true)
    const supabase = createClient()
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('settlement_details')
          .select('settlement_id, promotion_amount, call_fee_deduction, income_tax_deduction, employment_insurance_addition, accident_insurance_addition')
          .in('settlement_id', settlements.map((s) => s.id))
        if (!error && data) {
          const rows = data as AggDetailRow[]
          writeAggCache(idsSortedKey, rows)
          setAllAgg(rows)
        }
      } catch { /* ignore */ }
      setAggLoading(false)
    })()
  }, [idsSortedKey, settlements.length])

  // 선택된 주차 상세 데이터 조회 (캐시 우선)
  useEffect(() => {
    if (!selectedId) return
    const cached = readDetailsCache<SettlementDetail>(selectedId, 'dash')
    if (cached) {
      setDetails(cached)
      return
    }
    const supabase = createClient()
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('settlement_details')
          .select('promotion_amount, call_fee_deduction, final_amount, delivery_count, income_tax_deduction, employment_insurance_addition, accident_insurance_addition')
          .eq('settlement_id', selectedId)
        if (!error && data) {
          const rows = data as SettlementDetail[]
          writeDetailsCache(selectedId, 'dash', rows)
          setDetails(rows)
        }
      } catch { /* ignore */ }
    })()
  }, [selectedId])

  const loading = settlementsLoading || aggLoading

  // 차트 데이터: 최근 12주치 순이익 (오래된→최신 순)
  const chartData = useMemo(() => {
    const recent = [...settlements].reverse().slice(-12)
    return recent.map(s => {
      const rows = allAgg.filter(a => a.settlement_id === s.id)
      const promoTotal  = rows.reduce((acc, r) => acc + (r.promotion_amount ?? 0), 0)
      const callTotal   = rows.reduce((acc, r) => acc + (r.call_fee_deduction ?? 0), 0)
      const insAddTotal = rows.reduce((acc, r) => acc + (r.employment_insurance_addition ?? 0) + (r.accident_insurance_addition ?? 0), 0)
      const profit =
        (s.branch_fee ?? 0)
        - (s.employer_employment_insurance ?? 0)
        - (s.employer_accident_insurance ?? 0)
        - promoTotal + callTotal + insAddTotal
      const [, mm1, dd1] = (s.week_start ?? '').split('-')
      const [, mm2, dd2] = (s.week_end   ?? '').split('-')
      const label = `${mm1}/${dd1}~${mm2}/${dd2}`
      return { label, profit, id: s.id }
    })
  }, [settlements, allAgg])

  const currentSettlement = settlements.find(s => s.id === selectedId)

  const settledAmount  = currentSettlement?.settled_amount                ?? 0
  const branchFee      = currentSettlement?.branch_fee                   ?? 0
  const vatAmount      = currentSettlement?.vat_amount                   ?? 0
  const empInsurance   = currentSettlement?.employer_employment_insurance ?? 0
  const accInsurance   = currentSettlement?.employer_accident_insurance   ?? 0

  const promotionTotal   = details.reduce((s, d) => s + (d.promotion_amount ?? 0), 0)
  const callFeeTotal     = details.reduce((s, d) => s + (d.call_fee_deduction ?? 0), 0)
  const riderPayTotal    = details.reduce((s, d) => s + (d.final_amount ?? 0), 0)
  const incomeTaxTotal   = details.reduce((s, d) => s + (d.income_tax_deduction ?? 0), 0)
  const insAdditionTotal = details.reduce((s, d) => s + (d.employment_insurance_addition ?? 0) + (d.accident_insurance_addition ?? 0), 0)
  const riderCount       = details.length

  const branchProfit = branchFee - empInsurance - accInsurance - promotionTotal + callFeeTotal + insAdditionTotal

  const items = [
    { label: '정산예정금액',      value: settledAmount,    icon: TrendingUp,  color: 'text-violet-400', bg: 'border-violet-700/40 bg-violet-900/10', sign: '' },
    { label: '지사관리비',        value: branchFee,        icon: Building2,   color: 'text-blue-400',   bg: 'border-blue-700/40 bg-blue-900/10',   sign: '+' },
    { label: '부가세',            value: vatAmount,        icon: Percent,     color: 'text-amber-400',  bg: 'border-amber-700/40 bg-amber-900/10', sign: '-' },
    { label: '고용보험사업주',    value: empInsurance,     icon: ShieldCheck, color: 'text-cyan-400',   bg: 'border-cyan-700/40 bg-cyan-900/10',   sign: '-' },
    { label: '산재보험사업주',    value: accInsurance,     icon: ShieldCheck, color: 'text-purple-400', bg: 'border-purple-700/40 bg-purple-900/10',sign: '-' },
    { label: '프로모션비',        value: promotionTotal,   icon: Gift,        color: 'text-rose-400',   bg: 'border-rose-700/40 bg-rose-900/10',   sign: '-' },
    { label: '콜관리비',          value: callFeeTotal,     icon: Phone,       color: 'text-orange-400', bg: 'border-orange-700/40 bg-orange-900/10',sign: '+' },
    { label: '원천세',            value: incomeTaxTotal,   icon: Receipt,     color: 'text-red-400',    bg: 'border-red-700/40 bg-red-900/10',     sign: '-' },
    { label: '고용산재관리비',    value: insAdditionTotal, icon: ShieldCheck, color: 'text-teal-400',   bg: 'border-teal-700/40 bg-teal-900/10',   sign: '+' },
    { label: '라이더 최종정산금액', value: riderPayTotal,  icon: Wallet,      color: 'text-slate-300',  bg: 'border-slate-600 bg-slate-800/50',    sign: '' },
  ]

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 animate-pulse">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-slate-800 rounded-lg" />
            <div className="h-4 w-36 bg-slate-800 rounded" />
          </div>
          <div className="h-10 w-64 bg-slate-800 rounded-lg" />
        </div>
        <div className="h-28 w-full bg-slate-800 rounded-2xl" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-20 bg-slate-800 rounded-xl" />
          ))}
        </div>
        <div className="h-64 w-full bg-slate-800 rounded-2xl" />
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">주간 정산 현황</h2>
          <p className="text-slate-400 text-sm mt-1">주차별 지사 순이익 대시보드</p>
        </div>
        <div className="flex items-center gap-3">
          <CalendarDays className="h-5 w-5 text-slate-400" />
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-64 bg-slate-800 border-slate-600 text-white">
              <SelectValue placeholder="주차 선택" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {settlements.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-white hover:bg-slate-700">
                  {s.week_start} ~ {s.week_end}
                  {s.status === 'confirmed' && ' ✓'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {settlements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <CalendarDays className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">등록된 정산 데이터가 없습니다.</p>
          <p className="text-sm mt-1">정산파일 등록 탭에서 엑셀 파일을 업로드해 주세요.</p>
        </div>
      ) : (
        <>
          {/* 주차 배지 */}
          {currentSettlement && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-slate-600 text-slate-300">
                {currentSettlement.week_start} ~ {currentSettlement.week_end}
              </Badge>
              <Badge className={currentSettlement.status === 'confirmed' ? 'bg-emerald-700' : 'bg-amber-700'}>
                {currentSettlement.status === 'confirmed' ? '확정' : '임시저장'}
              </Badge>
              <span className="text-slate-500 text-sm flex items-center gap-1">
                <Users className="h-4 w-4" />{riderCount}명
              </span>
            </div>
          )}

          {/* 지사 순이익 메인 카드 */}
          <Card className={`border-2 ${branchProfit >= 0 ? 'border-emerald-600/60 bg-emerald-900/15' : 'border-rose-600/60 bg-rose-900/15'}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium mb-1">주간 지사 순이익</p>
                  <p className={`text-4xl font-bold ${branchProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {branchProfit >= 0 ? '+' : ''}{formatKRW(branchProfit)}
                  </p>
                  <p className="text-slate-500 text-xs mt-2">
                    지사관리비 - 고용보험사업주 - 산재보험사업주 - 프로모션비 + 콜관리비 + 고용산재관리비
                  </p>
                </div>
                <div className={`rounded-2xl p-4 ${branchProfit >= 0 ? 'bg-emerald-900/30' : 'bg-rose-900/30'}`}>
                  <TrendingUp className={`h-10 w-10 ${branchProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 항목별 카드 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white text-base">지사 순이익 구성 항목</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {items.map(item => {
                  const Icon = item.icon
                  return (
                    <div key={item.label} className={`rounded-xl border p-4 ${item.bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-400 text-xs font-medium">{item.label}</p>
                        <Icon className={`h-4 w-4 ${item.color}`} />
                      </div>
                      <p className={`text-base font-bold ${item.color}`}>
                        {item.sign && item.value > 0 ? item.sign : ''}{formatKRW(item.value)}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* 순이익 계산식 요약 */}
              <div className="mt-4 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
                <p className="text-slate-500 text-xs mb-3 font-medium">순이익 계산식</p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-blue-400 font-medium">{formatKRW(branchFee)}</span>
                  <span className="text-slate-500">(지사관리비)</span>
                  <span className="text-slate-600">-</span>
                  <span className="text-cyan-400">{formatKRW(empInsurance)}</span>
                  <span className="text-slate-500">(고용보험)</span>
                  <span className="text-slate-600">-</span>
                  <span className="text-purple-400">{formatKRW(accInsurance)}</span>
                  <span className="text-slate-500">(산재보험)</span>
                  <span className="text-slate-600">-</span>
                  <span className="text-rose-400">{formatKRW(promotionTotal)}</span>
                  <span className="text-slate-500">(프로모션)</span>
                  <span className="text-slate-600">+</span>
                  <span className="text-orange-400">{formatKRW(callFeeTotal)}</span>
                  <span className="text-slate-500">(콜관리비)</span>
                  <span className="text-slate-600">+</span>
                  <span className="text-teal-400">{formatKRW(insAdditionTotal)}</span>
                  <span className="text-slate-500">(고용산재관리비)</span>
                  <span className="text-slate-600">=</span>
                  <span className={`font-bold text-base ${branchProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {branchProfit >= 0 ? '+' : ''}{formatKRW(branchProfit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 주별 지사 순이익 막대그래프 */}
          {chartData.length > 1 && (
            <Card className="border-slate-700 bg-slate-900">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-emerald-400" />
                  주별 지사 순이익 추이
                  <span className="text-slate-500 text-xs font-normal ml-1">(최근 {chartData.length}주)</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 8, right: 16, left: 8, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={{ stroke: '#475569' }}
                      tickLine={false}
                    />
                    <YAxis
                      tickFormatter={v => {
                        const abs = Math.abs(v)
                        if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}백만`
                        if (abs >= 10_000)   return `${(v / 10_000).toFixed(0)}만`
                        return String(v)
                      }}
                      tick={{ fill: '#94a3b8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={64}
                    />
                    <Tooltip
                      cursor={{ fill: 'rgba(148,163,184,0.07)' }}
                      contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 8 }}
                      labelStyle={{ color: '#cbd5e1', fontSize: 12, marginBottom: 4 }}
                      formatter={(value: number | undefined) => [
                        `${(value ?? 0) >= 0 ? '+' : ''}${formatKRW(value ?? 0)}`,
                        '지사 순이익',
                      ]}
                    />
                    <ReferenceLine y={0} stroke="#475569" strokeWidth={1.5} />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={48}>
                      {chartData.map((entry) => (
                        <Cell
                          key={entry.id}
                          fill={entry.id === selectedId
                            ? (entry.profit >= 0 ? '#34d399' : '#f87171')
                            : (entry.profit >= 0 ? '#059669' : '#dc2626')}
                          opacity={entry.id === selectedId ? 1 : 0.65}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-slate-600 text-xs text-center mt-1">현재 선택 주차는 밝게 표시됩니다</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
