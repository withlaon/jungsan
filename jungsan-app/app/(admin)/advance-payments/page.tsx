'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useRiders } from '@/hooks/useRiders'
import { AdvancePayment, Rider } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Wallet, AlertCircle, Trash2, RotateCcw, Search, ChevronDown } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { toast } from 'sonner'

type PaymentWithRider = AdvancePayment & { riders: Rider }

// ?섏슂???붿슂??湲곗? 二쇨컙 紐⑸줉 ?앹꽦 (理쒓렐 24二?
function getWeekOptions() {
  const options: { label: string; value: string }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 媛??理쒓렐 ?섏슂??李얘린 (0=?? 1=?? 2=?? 3=?? 4=紐? 5=湲? 6=??
  const daysBack = (today.getDay() - 3 + 7) % 7
  const baseWed = new Date(today)
  baseWed.setDate(today.getDate() - daysBack)

  const fmt = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}.${m}.${day}`
  }
  const fmtISO = (d: Date) => {
    const y = d.getFullYear()
    const m = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${y}-${m}-${day}`
  }
  const dayLabel = ['??, '??, '??, '??, '紐?, '湲?, '??]

  for (let i = 0; i < 24; i++) {
    const wed = new Date(baseWed)
    wed.setDate(baseWed.getDate() - i * 7)
    const tue = new Date(wed)
    tue.setDate(wed.getDate() + 6)
    options.push({
      label: `${fmt(wed)}(${dayLabel[wed.getDay()]}) ~ ${fmt(tue)}(${dayLabel[tue.getDay()]})`,
      value: fmtISO(wed),
    })
  }
  return options
}

const weekOptions = getWeekOptions()

const emptyForm = { rider_id: '', amount: '', week: weekOptions[0]?.value ?? '', memo: '' }

// ?쇱씠??寃??Select 而댄룷?뚰듃
function RiderSearchSelect({
  riders,
  value,
  onChange,
}: {
  riders: Rider[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const filtered = useMemo(
    () =>
      riders.filter(
        r =>
          r.name.includes(search) ||
          (r.rider_username ?? '').includes(search) ||
          (r.phone ?? '').includes(search),
      ),
    [riders, search],
  )

  const selected = riders.find(r => r.id === value)

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white hover:border-slate-500 transition-colors"
      >
        <span className={selected ? 'text-white' : 'text-slate-500'}>
          {selected ? `${selected.name}${selected.rider_username ? ` (${selected.rider_username})` : ''}` : '?쇱씠??寃?????좏깮'}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-xl">
          <div className="p-2 border-b border-slate-700">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="?대쫫쨌?꾩씠?붋룹뿰?쎌쿂 寃??
                className="pl-7 h-8 text-sm bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-3">寃??寃곌낵 ?놁쓬</p>
            ) : (
              filtered.map(r => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => { onChange(r.id); setOpen(false); setSearch('') }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors ${value === r.id ? 'bg-blue-900/40 text-blue-300' : 'text-white'}`}
                >
                  <span className="font-medium">{r.name}</span>
                  {r.rider_username && <span className="text-slate-400 ml-2 text-xs">@{r.rider_username}</span>}
                  {r.phone && <span className="text-slate-500 ml-2 text-xs">{r.phone}</span>}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdvancePaymentsPage() {
  const supabase = createClient()
  const { userId, isAdmin, loading: userLoading } = useUser()
  const { riders: allRiders } = useRiders()
  const riders = allRiders.filter(r => r.status === 'active')
  const [payments, setPayments] = useState<PaymentWithRider[]>([])
  const [loading, setLoading] = useState(true)

  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [recoveryOpen, setRecoveryOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const [advanceForm, setAdvanceForm] = useState(emptyForm)
  const [recoveryForm, setRecoveryForm] = useState(emptyForm)

  useEffect(() => {
    if (isAdmin || userId) fetchData()
  }, [userId, isAdmin])

  const fetchData = async () => {
    if (!userId && !isAdmin) return
    setLoading(true)
    let q = supabase.from('advance_payments').select('*, riders(*)').order('paid_date', { ascending: false })
    if (!isAdmin && userId) q = q.eq('user_id', userId)
    const [paymentsRes] = await Promise.all([q])
    if (paymentsRes.data) setPayments(paymentsRes.data as PaymentWithRider[])
    setLoading(false)
  }

  const handleSave = async (type: 'advance' | 'recovery') => {
    const form = type === 'advance' ? advanceForm : recoveryForm
    if (!form.rider_id || !form.amount || !form.week) {
      toast.error('?쇱씠?? 湲덉븸, 二쇨컙??紐⑤몢 ?낅젰?댁＜?몄슂.')
      return
    }
    const amount = parseInt(form.amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      toast.error('?щ컮瑜?湲덉븸???낅젰?댁＜?몄슂.')
      return
    }

    setSaving(true)
    const insertRow: Record<string, unknown> = {
      rider_id: form.rider_id,
      amount,
      paid_date: form.week,
      memo: form.memo || null,
      type,
    }
    if (userId) insertRow.user_id = userId
    const { error } = await supabase.from('advance_payments').insert(insertRow)

    if (error) { toast.error('?깅줉 ?ㅽ뙣: ' + error.message); setSaving(false); return }

    toast.success(type === 'advance' ? '?좎?湲됯툑???깅줉?섏뿀?듬땲??' : '?뚯닔 ?댁뿭???깅줉?섏뿀?듬땲??')
    setSaving(false)
    if (type === 'advance') { setAdvanceOpen(false); setAdvanceForm(emptyForm) }
    else { setRecoveryOpen(false); setRecoveryForm(emptyForm) }
    fetchData()
  }

  const handleDelete = async (id: string, riderName: string, type: 'advance' | 'recovery') => {
    const target = payments.find(p => p.id === id)
    const label = type === 'advance' ? '?좎?湲됯툑' : '?뚯닔 ?댁뿭'
    const extraWarning = target?.deducted_settlement_id
      ? '\n???대? ?뺤궛??怨듭젣????ぉ?낅땲?? ??젣?대룄 湲곗〈 ?뺤궛 寃곌낵??蹂寃쎈릺吏 ?딆뒿?덈떎.'
      : ''
    if (!confirm(`${riderName}??${label}????젣?섏떆寃좎뒿?덇퉴?${extraWarning}`)) return
    const { error } = await supabase.from('advance_payments').delete().eq('id', id)
    if (error) { toast.error('??젣 ?ㅽ뙣'); return }
    toast.success('??젣?섏뿀?듬땲??')
    fetchData()
  }

  const advances = payments.filter(p => p.type !== 'recovery')
  const recoveries = payments.filter(p => p.type === 'recovery')

  const totalAdvance = advances.filter(p => !p.deducted_settlement_id).reduce((s, p) => s + p.amount, 0)
  const totalRecovery = recoveries.reduce((s, p) => s + p.amount, 0)

  const undeductedByRider = riders.map(r => {
    const total = advances.filter(p => p.rider_id === r.id && !p.deducted_settlement_id).reduce((s, p) => s + p.amount, 0)
    return { rider: r, total }
  }).filter(x => x.total > 0)

  // 二쇨컙 ?쇰꺼 李얘린
  const weekLabel = (dateStr: string) => weekOptions.find(w => w.value === dateStr)?.label ?? dateStr

  // 怨듯넻 ?ㅼ씠?쇰줈洹????뚮뜑留?
  const renderForm = (
    type: 'advance' | 'recovery',
    form: typeof emptyForm,
    setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>,
  ) => (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label className="text-slate-300">?쇱씠??*</Label>
        <RiderSearchSelect riders={riders} value={form.rider_id} onChange={id => setForm(f => ({ ...f, rider_id: id }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300">湲덉븸 *</Label>
        <Input
          type="number"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          placeholder="50000"
          className="bg-slate-800 border-slate-600 text-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300">{type === 'advance' ? '吏湲?二쇨컙' : '?뚯닔 二쇨컙'} *</Label>
        <div className="relative">
          <select
            value={form.week}
            onChange={e => setForm(f => ({ ...f, week: e.target.value }))}
            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white appearance-none cursor-pointer hover:border-slate-500 transition-colors pr-8"
          >
            {weekOptions.map(w => (
              <option key={w.value} value={w.value} className="bg-slate-800">{w.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300">硫붾え</Label>
        <Textarea
          value={form.memo}
          onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
          placeholder={type === 'advance' ? '?좎?湲??ъ쑀...' : '?뚯닔 ?ъ쑀...'}
          className="bg-slate-800 border-slate-600 text-white resize-none"
          rows={2}
        />
      </div>
    </div>
  )

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">?좎?湲됯툑 愿由?/h2>
          <p className="text-slate-400 text-sm mt-1">?쇱씠?붾퀎 ?좎?湲됯툑 ?깅줉 諛?怨듭젣 ?꾪솴</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setRecoveryForm(emptyForm); setRecoveryOpen(true) }}
            variant="outline" className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20">
            <RotateCcw className="h-4 w-4 mr-2" />
            ?뚯닔 ?깅줉
          </Button>
          <Button onClick={() => { setAdvanceForm(emptyForm); setAdvanceOpen(true) }}
            className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            ?좎?湲됯툑 ?깅줉
          </Button>
        </div>
      </div>

      {/* ?붿빟 移대뱶 */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-700 bg-orange-900/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-slate-400 text-xs">誘멸났???좎?湲됯툑 ?⑷퀎</p>
              <p className="text-orange-400 text-2xl font-bold">{formatKRW(totalAdvance)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-700 bg-slate-900">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-slate-400 text-xs">誘멸났??????쇱씠??/p>
              <p className="text-blue-400 text-2xl font-bold">{undeductedByRider.length}紐?/p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-700 bg-emerald-900/20">
          <CardContent className="p-4 flex items-center gap-3">
            <RotateCcw className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-slate-400 text-xs">?뚯닔 ?⑷퀎</p>
              <p className="text-emerald-400 text-2xl font-bold">{formatKRW(totalRecovery)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 誘멸났??諭껋? */}
      {undeductedByRider.length > 0 && (
        <Card className="border-orange-700/50 bg-orange-900/10">
          <CardHeader>
            <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              誘멸났???좎?湲됯툑 ?꾪솴
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {undeductedByRider.map(({ rider, total }) => (
                <Badge key={rider.id} className="bg-orange-900/40 text-orange-300 border border-orange-700/50 px-3 py-1.5 text-sm">
                  {rider.name}: {formatKRW(total)}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ?좎?湲됯툑 ?댁뿭 ?뚯씠釉?*/}
      <Card className="border-slate-700 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white text-base">?좎?湲됯툑 ?댁뿭 ({advances.length}嫄?</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">?쇱씠??/TableHead>
                <TableHead className="text-slate-400">湲덉븸</TableHead>
                <TableHead className="text-slate-400">吏湲?二쇨컙</TableHead>
                <TableHead className="text-slate-400">硫붾え</TableHead>
                <TableHead className="text-slate-400">怨듭젣 ?щ?</TableHead>
                <TableHead className="text-slate-400 text-right">愿由?/TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">濡쒕뵫 以?..</TableCell></TableRow>
              ) : advances.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">?깅줉???좎?湲됯툑???놁뒿?덈떎.</TableCell></TableRow>
              ) : (
                advances.map(p => (
                  <TableRow key={p.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="text-white font-medium">{p.riders?.name}</TableCell>
                    <TableCell className="text-orange-400 font-bold">{formatKRW(p.amount)}</TableCell>
                    <TableCell className="text-slate-300 text-sm">{weekLabel(p.paid_date)}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{p.memo ?? '-'}</TableCell>
                    <TableCell>
                      <Badge className={p.deducted_settlement_id ? 'bg-emerald-800 text-emerald-300' : 'bg-orange-800 text-orange-300'}>
                        {p.deducted_settlement_id ? '怨듭젣 ?꾨즺' : '誘멸났??}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost"
                        onClick={() => handleDelete(p.id, p.riders?.name, 'advance')}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 h-8 px-3">
                        <Trash2 className="h-3.5 w-3.5 mr-1" />??젣
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ?뚯닔 ?댁뿭 ?뚯씠釉?*/}
      <Card className="border-emerald-700/40 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-emerald-400 text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            ?뚯닔 ?댁뿭 ({recoveries.length}嫄?
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">?쇱씠??/TableHead>
                <TableHead className="text-slate-400">湲덉븸</TableHead>
                <TableHead className="text-slate-400">?뚯닔 二쇨컙</TableHead>
                <TableHead className="text-slate-400">硫붾え</TableHead>
                <TableHead className="text-slate-400 text-right">愿由?/TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">濡쒕뵫 以?..</TableCell></TableRow>
              ) : recoveries.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">?뚯닔 ?댁뿭???놁뒿?덈떎.</TableCell></TableRow>
              ) : (
                recoveries.map(p => (
                  <TableRow key={p.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="text-white font-medium">{p.riders?.name}</TableCell>
                    <TableCell className="text-emerald-400 font-bold">{formatKRW(p.amount)}</TableCell>
                    <TableCell className="text-slate-300 text-sm">{weekLabel(p.paid_date)}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{p.memo ?? '-'}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost"
                        onClick={() => handleDelete(p.id, p.riders?.name, 'recovery')}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 h-8 px-3">
                        <Trash2 className="h-3.5 w-3.5 mr-1" />??젣
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ?좎?湲됯툑 ?깅줉 ?ㅼ씠?쇰줈洹?*/}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-400" />?좎?湲됯툑 ?깅줉
            </DialogTitle>
          </DialogHeader>
          {renderForm('advance', advanceForm, setAdvanceForm)}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdvanceOpen(false)} className="text-slate-400 hover:text-white">痍⑥냼</Button>
            <Button onClick={() => handleSave('advance')} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? '???以?..' : '?깅줉'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ?뚯닔 ?깅줉 ?ㅼ씠?쇰줈洹?*/}
      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-400" />?뚯닔 ?깅줉
            </DialogTitle>
          </DialogHeader>
          {renderForm('recovery', recoveryForm, setRecoveryForm)}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecoveryOpen(false)} className="text-slate-400 hover:text-white">痍⑥냼</Button>
            <Button onClick={() => handleSave('recovery')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? '???以?..' : '?깅줉'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}