'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CalendarDays, TrendingUp, Building2, Percent, ShieldCheck, Gift, Phone, Users, Receipt, BarChart2, Wallet } from 'lucide-react'
import { WeeklySettlement, SettlementDetail } from '@/types'
import { formatKRW } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, CartesianGrid,
} from 'recharts'

interface AggDetail {
  settlement_id: string
  promotion_amount: number
  call_fee_deduction: number
  income_tax_deduction: number
  employment_insurance_addition: number
  accident_insurance_addition: number
}

export default function DashboardPage() {
  const supabase = createClient()
  const { userId, isAdmin, loading: userLoading } = useUser()
  const [settlements, setSettlements] = useState<WeeklySettlement[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [details, setDetails] = useState<SettlementDetail[]>([])
  const [allAgg, setAllAgg] = useState<AggDetail[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isAdmin || userId) fetchSettlements()
  }, [userId, isAdmin])
  useEffect(() => { if (selectedId) fetchDetails(selectedId) }, [selectedId])

  const fetchSettlements = async () => {
    if (!userId && !isAdmin) return
    let q = supabase.from('weekly_settlements').select('*').order('week_start', { ascending: false })
    if (!isAdmin && userId) q = q.eq('user_id', userId)
    const { data } = await q
    if (data) {
      setSettlements(data)
      if (data.length > 0) setSelectedId(data[0].id)
    }
    const ids = (data ?? []).map(s => s.id)
    let aggQ = supabase.from('settlement_details').select('settlement_id, promotion_amount, call_fee_deduction, income_tax_deduction, employment_insurance_addition, accident_insurance_addition')
    if (ids.length > 0) aggQ = aggQ.in('settlement_id', ids)
    const { data: aggData } = await aggQ
    if (aggData) setAllAgg(aggData as AggDetail[])
    setLoading(false)
  }

  const fetchDetails = async (settlementId: string) => {
    const { data } = await supabase
      .from('settlement_details')
      .select('promotion_amount, call_fee_deduction, final_amount, delivery_count, income_tax_deduction, employment_insurance_addition, accident_insurance_addition')
      .eq('settlement_id', settlementId)
    if (data) setDetails(data as SettlementDetail[])
  }

  // 李⑦듃 ?곗씠?? 理쒓렐 12二쇱튂 ?쒖씠??(?ㅻ옒?쒋넂理쒖떊 ??
  const chartData = useMemo(() => {
    const recent = [...settlements].reverse().slice(-12)
    return recent.map(s => {
      const rows = allAgg.filter(a => a.settlement_id === s.id)
      const promoTotal   = rows.reduce((acc, r) => acc + (r.promotion_amount ?? 0), 0)
      const callTotal    = rows.reduce((acc, r) => acc + (r.call_fee_deduction ?? 0), 0)
      const insAddTotal  = rows.reduce((acc, r) => acc + (r.employment_insurance_addition ?? 0) + (r.accident_insurance_addition ?? 0), 0)
      const profit =
        (s.branch_fee ?? 0)
        - (s.employer_employment_insurance ?? 0)
        - (s.employer_accident_insurance ?? 0)
        - promoTotal + callTotal + insAddTotal
      // 二쇱감 ?쇰꺼: "25/02/05~02/11" ?뺥깭濡??뺤텞
      const [, mm1, dd1] = (s.week_start ?? '').split('-')
      const [, mm2, dd2] = (s.week_end   ?? '').split('-')
      const label = `${mm1}/${dd1}~${mm2}/${dd2}`
      return { label, profit, id: s.id }
    })
  }, [settlements, allAgg])

  const currentSettlement = settlements.find(s => s.id === selectedId)

  // 媛묒? ?붿빟 (weekly_settlements ??κ컪)
  const settledAmount   = currentSettlement?.settled_amount                ?? 0
  const branchFee       = currentSettlement?.branch_fee                   ?? 0
  const vatAmount       = currentSettlement?.vat_amount                   ?? 0
  const empInsurance    = currentSettlement?.employer_employment_insurance ?? 0
  const accInsurance    = currentSettlement?.employer_accident_insurance   ?? 0

  // settlement_details 吏묎퀎
  const promotionTotal  = details.reduce((s, d) => s + (d.promotion_amount ?? 0), 0)
  const callFeeTotal    = details.reduce((s, d) => s + (d.call_fee_deduction ?? 0), 0)
  const riderPayTotal   = details.reduce((s, d) => s + (d.final_amount ?? 0), 0)
  const incomeTaxTotal  = details.reduce((s, d) => s + (d.income_tax_deduction ?? 0), 0)
  const insAdditionTotal = details.reduce((s, d) => s + (d.employment_insurance_addition ?? 0) + (d.accident_insurance_addition ?? 0), 0)
  const riderCount      = details.length

  // 吏?ъ닚?댁씡 = 吏?ш?由щ퉬 - 怨좎슜蹂댄뿕?ъ뾽二?- ?곗옱蹂댄뿕?ъ뾽二?- ?꾨줈紐⑥뀡鍮?+ 肄쒓?由щ퉬 + 怨좎슜?곗옱愿由щ퉬
  const branchProfit    = branchFee - empInsurance - accInsurance - promotionTotal + callFeeTotal + insAdditionTotal

  const items = [
    {
      label: '?뺤궛?덉젙湲덉븸',
      value: settledAmount,
      icon: TrendingUp,
      color: 'text-violet-400',
      bg: 'border-violet-700/40 bg-violet-900/10',
      sign: '',
    },
    {
      label: '吏?ш?由щ퉬',
      value: branchFee,
      icon: Building2,
      color: 'text-blue-400',
      bg: 'border-blue-700/40 bg-blue-900/10',
      sign: '+',
    },
    {
      label: '遺媛??,
      value: vatAmount,
      icon: Percent,
      color: 'text-amber-400',
      bg: 'border-amber-700/40 bg-amber-900/10',
      sign: '-',
    },
    {
      label: '怨좎슜蹂댄뿕?ъ뾽二?,
      value: empInsurance,
      icon: ShieldCheck,
      color: 'text-cyan-400',
      bg: 'border-cyan-700/40 bg-cyan-900/10',
      sign: '-',
    },
    {
      label: '?곗옱蹂댄뿕?ъ뾽二?,
      value: accInsurance,
      icon: ShieldCheck,
      color: 'text-purple-400',
      bg: 'border-purple-700/40 bg-purple-900/10',
      sign: '-',
    },
    {
      label: '?꾨줈紐⑥뀡鍮?,
      value: promotionTotal,
      icon: Gift,
      color: 'text-rose-400',
      bg: 'border-rose-700/40 bg-rose-900/10',
      sign: '-',
    },
    {
      label: '肄쒓?由щ퉬',
      value: callFeeTotal,
      icon: Phone,
      color: 'text-orange-400',
      bg: 'border-orange-700/40 bg-orange-900/10',
      sign: '+',
    },
    {
      label: '?먯쿇??,
      value: incomeTaxTotal,
      icon: Receipt,
      color: 'text-red-400',
      bg: 'border-red-700/40 bg-red-900/10',
      sign: '-',
    },
    {
      label: '怨좎슜?곗옱愿由щ퉬',
      value: insAdditionTotal,
      icon: ShieldCheck,
      color: 'text-teal-400',
      bg: 'border-teal-700/40 bg-teal-900/10',
      sign: '+',
    },
    {
      label: '?쇱씠??理쒖쥌?뺤궛湲덉븸',
      value: riderPayTotal,
      icon: Wallet,
      color: 'text-slate-300',
      bg: 'border-slate-600 bg-slate-800/50',
      sign: '',
    },
  ]

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-screen text-slate-400">
        <div className="animate-pulse text-lg">?곗씠??濡쒕뵫 以?..</div>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ?ㅻ뜑 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">二쇨컙 ?뺤궛 ?꾪솴</h2>
          <p className="text-slate-400 text-sm mt-1">二쇱감蹂?吏???쒖씠????쒕낫??/p>
        </div>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-slate-400 shrink-0" />
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full sm:w-64 bg-slate-800 border-slate-600 text-white">
              <SelectValue placeholder="二쇱감 ?좏깮" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {settlements.map(s => (
                <SelectItem key={s.id} value={s.id} className="text-white hover:bg-slate-700">
                  {s.week_start} ~ {s.week_end}
                  {s.status === 'confirmed' && ' ??}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {settlements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <CalendarDays className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">?깅줉???뺤궛 ?곗씠?곌? ?놁뒿?덈떎.</p>
          <p className="text-sm mt-1">?뺤궛?뚯씪 ?깅줉 ??뿉???묒? ?뚯씪???낅줈?쒗빐 二쇱꽭??</p>
        </div>
      ) : (
        <>
          {/* 二쇱감 諛곗? */}
          {currentSettlement && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-slate-600 text-slate-300">
                {currentSettlement.week_start} ~ {currentSettlement.week_end}
              </Badge>
              <Badge className={currentSettlement.status === 'confirmed' ? 'bg-emerald-700' : 'bg-amber-700'}>
                {currentSettlement.status === 'confirmed' ? '?뺤젙' : '?꾩떆???}
              </Badge>
              <span className="text-slate-500 text-sm flex items-center gap-1">
                <Users className="h-4 w-4" />{riderCount}紐?
              </span>
            </div>
          )}

          {/* 吏???쒖씠??硫붿씤 移대뱶 */}
          <Card className={`border-2 ${branchProfit >= 0 ? 'border-emerald-600/60 bg-emerald-900/15' : 'border-rose-600/60 bg-rose-900/15'}`}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm font-medium mb-1">二쇨컙 吏???쒖씠??/p>
                  <p className={`text-4xl font-bold ${branchProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {branchProfit >= 0 ? '+' : ''}{formatKRW(branchProfit)}
                  </p>
                  <p className="text-slate-500 text-xs mt-2">
                    吏?ш?由щ퉬 - 怨좎슜蹂댄뿕?ъ뾽二?- ?곗옱蹂댄뿕?ъ뾽二?- ?꾨줈紐⑥뀡鍮?+ 肄쒓?由щ퉬 + 怨좎슜?곗옱愿由щ퉬
                  </p>
                </div>
                <div className={`rounded-2xl p-4 ${branchProfit >= 0 ? 'bg-emerald-900/30' : 'bg-rose-900/30'}`}>
                  <TrendingUp className={`h-10 w-10 ${branchProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ??ぉ蹂?移대뱶 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white text-base">吏???쒖씠??援ъ꽦 ??ぉ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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

              {/* ?쒖씠??怨꾩궛???붿빟 */}
              <div className="mt-4 rounded-xl bg-slate-800/50 border border-slate-700 p-4">
                <p className="text-slate-500 text-xs mb-3 font-medium">?쒖씠??怨꾩궛??/p>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-blue-400 font-medium">{formatKRW(branchFee)}</span>
                  <span className="text-slate-500">(吏?ш?由щ퉬)</span>
                  <span className="text-slate-600">-</span>
                  <span className="text-cyan-400">{formatKRW(empInsurance)}</span>
                  <span className="text-slate-500">(怨좎슜蹂댄뿕)</span>
                  <span className="text-slate-600">-</span>
                  <span className="text-purple-400">{formatKRW(accInsurance)}</span>
                  <span className="text-slate-500">(?곗옱蹂댄뿕)</span>
                  <span className="text-slate-600">-</span>
                  <span className="text-rose-400">{formatKRW(promotionTotal)}</span>
                  <span className="text-slate-500">(?꾨줈紐⑥뀡)</span>
                  <span className="text-slate-600">+</span>
                  <span className="text-orange-400">{formatKRW(callFeeTotal)}</span>
                  <span className="text-slate-500">(肄쒓?由щ퉬)</span>
                  <span className="text-slate-600">+</span>
                  <span className="text-teal-400">{formatKRW(insAdditionTotal)}</span>
                  <span className="text-slate-500">(怨좎슜?곗옱愿由щ퉬)</span>
                  <span className="text-slate-600">=</span>
                  <span className={`font-bold text-base ${branchProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {branchProfit >= 0 ? '+' : ''}{formatKRW(branchProfit)}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 二쇰퀎 吏???쒖씠??留됰?洹몃옒??*/}
          {chartData.length > 1 && (
            <Card className="border-slate-700 bg-slate-900">
              <CardHeader>
                <CardTitle className="text-white text-base flex items-center gap-2">
                  <BarChart2 className="h-4 w-4 text-emerald-400" />
                  二쇰퀎 吏???쒖씠??異붿씠
                  <span className="text-slate-500 text-xs font-normal ml-1">(理쒓렐 {chartData.length}二?</span>
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
                        if (abs >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}諛깅쭔`
                        if (abs >= 10_000)   return `${(v / 10_000).toFixed(0)}留?
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
                        '吏???쒖씠??,
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
                <p className="text-slate-600 text-xs text-center mt-1">?꾩옱 ?좏깮 二쇱감??諛앷쾶 ?쒖떆?⑸땲??/p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}