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

// ?òÏöî???îÏöî??Í∏∞Ï? Ï£ºÍ∞Ñ Î™©Î°ù ?ùÏÑ± (ÏµúÍ∑º 24Ï£?
function getWeekOptions() {
  const options: { label: string; value: string }[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Í∞Ä??ÏµúÍ∑º ?òÏöî??Ï∞æÍ∏∞ (0=?? 1=?? 2=?? 3=?? 4=Î™? 5=Í∏? 6=??
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
  const dayLabel = ['??, '??, '??, '??, 'Î™?, 'Í∏?, '??]

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

// ?ºÏù¥??Í≤Ä??Select Ïª¥Ìè¨?åÌä∏
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
          {selected ? `${selected.name}${selected.rider_username ? ` (${selected.rider_username})` : ''}` : '?ºÏù¥??Í≤Ä?????†ÌÉù'}
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
                placeholder="?¥Î¶Ñ¬∑?ÑÏù¥?î¬∑Ïó∞?ΩÏ≤ò Í≤Ä??
                className="pl-7 h-8 text-sm bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-3">Í≤Ä??Í≤∞Í≥º ?ÜÏùå</p>
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
      toast.error('?ºÏù¥?? Í∏àÏï°, Ï£ºÍ∞Ñ??Î™®Îëê ?ÖÎ†•?¥Ï£º?∏Ïöî.')
      return
    }
    const amount = parseInt(form.amount.replace(/,/g, ''))
    if (isNaN(amount) || amount <= 0) {
      toast.error('?¨Î∞îÎ•?Í∏àÏï°???ÖÎ†•?¥Ï£º?∏Ïöî.')
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

    if (error) { toast.error('?±Î°ù ?§Ìå®: ' + error.message); setSaving(false); return }

    toast.success(type === 'advance' ? '?†Ï?Í∏âÍ∏à???±Î°ù?òÏóà?µÎãà??' : '?åÏàò ?¥Ïó≠???±Î°ù?òÏóà?µÎãà??')
    setSaving(false)
    if (type === 'advance') { setAdvanceOpen(false); setAdvanceForm(emptyForm) }
    else { setRecoveryOpen(false); setRecoveryForm(emptyForm) }
    fetchData()
  }

  const handleDelete = async (id: string, riderName: string, type: 'advance' | 'recovery') => {
    const target = payments.find(p => p.id === id)
    const label = type === 'advance' ? '?†Ï?Í∏âÍ∏à' : '?åÏàò ?¥Ïó≠'
    const extraWarning = target?.deducted_settlement_id
      ? '\n???¥Î? ?ïÏÇ∞??Í≥µÏ†ú????™©?ÖÎãà?? ??†ú?¥ÎèÑ Í∏∞Ï°¥ ?ïÏÇ∞ Í≤∞Í≥º??Î≥ÄÍ≤ΩÎêòÏßÄ ?äÏäµ?àÎã§.'
      : ''
    if (!confirm(`${riderName}??${label}????†ú?òÏãúÍ≤†Ïäµ?àÍπå?${extraWarning}`)) return
    const { error } = await supabase.from('advance_payments').delete().eq('id', id)
    if (error) { toast.error('??†ú ?§Ìå®'); return }
    toast.success('??†ú?òÏóà?µÎãà??')
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

  // Ï£ºÍ∞Ñ ?ºÎ≤® Ï∞æÍ∏∞
  const weekLabel = (dateStr: string) => weekOptions.find(w => w.value === dateStr)?.label ?? dateStr

  // Í≥µÌÜµ ?§Ïù¥?ºÎ°úÍ∑????åÎçîÎß?
  const renderForm = (
    type: 'advance' | 'recovery',
    form: typeof emptyForm,
    setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>,
  ) => (
    <div className="space-y-4 py-2">
      <div className="space-y-1.5">
        <Label className="text-slate-300">?ºÏù¥??*</Label>
        <RiderSearchSelect riders={riders} value={form.rider_id} onChange={id => setForm(f => ({ ...f, rider_id: id }))} />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300">Í∏àÏï° *</Label>
        <Input
          type="number"
          value={form.amount}
          onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
          placeholder="50000"
          className="bg-slate-800 border-slate-600 text-white"
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-slate-300">{type === 'advance' ? 'ÏßÄÍ∏?Ï£ºÍ∞Ñ' : '?åÏàò Ï£ºÍ∞Ñ'} *</Label>
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
        <Label className="text-slate-300">Î©îÎ™®</Label>
        <Textarea
          value={form.memo}
          onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
          placeholder={type === 'advance' ? '?†Ï?Í∏??¨Ïú†...' : '?åÏàò ?¨Ïú†...'}
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
          <h2 className="text-2xl font-bold text-white">?†Ï?Í∏âÍ∏à Í¥ÄÎ¶?/h2>
          <p className="text-slate-400 text-sm mt-1">?ºÏù¥?îÎ≥Ñ ?†Ï?Í∏âÍ∏à ?±Î°ù Î∞?Í≥µÏ†ú ?ÑÌô©</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setRecoveryForm(emptyForm); setRecoveryOpen(true) }}
            variant="outline" className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20">
            <RotateCcw className="h-4 w-4 mr-2" />
            ?åÏàò ?±Î°ù
          </Button>
          <Button onClick={() => { setAdvanceForm(emptyForm); setAdvanceOpen(true) }}
            className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            ?†Ï?Í∏âÍ∏à ?±Î°ù
          </Button>
        </div>
      </div>

      {/* ?îÏïΩ Ïπ¥Îìú */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-slate-700 bg-orange-900/20">
          <CardContent className="p-4 flex items-center gap-3">
            <AlertCircle className="h-8 w-8 text-orange-400" />
            <div>
              <p className="text-slate-400 text-xs">ÎØ∏Í≥µ???†Ï?Í∏âÍ∏à ?©Í≥Ñ</p>
              <p className="text-orange-400 text-2xl font-bold">{formatKRW(totalAdvance)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-700 bg-slate-900">
          <CardContent className="p-4 flex items-center gap-3">
            <Wallet className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-slate-400 text-xs">ÎØ∏Í≥µ???Ä???ºÏù¥??/p>
              <p className="text-blue-400 text-2xl font-bold">{undeductedByRider.length}Î™?/p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-slate-700 bg-emerald-900/20">
          <CardContent className="p-4 flex items-center gap-3">
            <RotateCcw className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-slate-400 text-xs">?åÏàò ?©Í≥Ñ</p>
              <p className="text-emerald-400 text-2xl font-bold">{formatKRW(totalRecovery)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ÎØ∏Í≥µ??Î±ÉÏ? */}
      {undeductedByRider.length > 0 && (
        <Card className="border-orange-700/50 bg-orange-900/10">
          <CardHeader>
            <CardTitle className="text-orange-400 text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              ÎØ∏Í≥µ???†Ï?Í∏âÍ∏à ?ÑÌô©
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

      {/* ?†Ï?Í∏âÍ∏à ?¥Ïó≠ ?åÏù¥Î∏?*/}
      <Card className="border-slate-700 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white text-base">?†Ï?Í∏âÍ∏à ?¥Ïó≠ ({advances.length}Í±?</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">?ºÏù¥??/TableHead>
                <TableHead className="text-slate-400">Í∏àÏï°</TableHead>
                <TableHead className="text-slate-400">ÏßÄÍ∏?Ï£ºÍ∞Ñ</TableHead>
                <TableHead className="text-slate-400">Î©îÎ™®</TableHead>
                <TableHead className="text-slate-400">Í≥µÏ†ú ?¨Î?</TableHead>
                <TableHead className="text-slate-400 text-right">Í¥ÄÎ¶?/TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">Î°úÎî© Ï§?..</TableCell></TableRow>
              ) : advances.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center text-slate-500 py-8">?±Î°ù???†Ï?Í∏âÍ∏à???ÜÏäµ?àÎã§.</TableCell></TableRow>
              ) : (
                advances.map(p => (
                  <TableRow key={p.id} className="border-slate-700 hover:bg-slate-800/50">
                    <TableCell className="text-white font-medium">{p.riders?.name}</TableCell>
                    <TableCell className="text-orange-400 font-bold">{formatKRW(p.amount)}</TableCell>
                    <TableCell className="text-slate-300 text-sm">{weekLabel(p.paid_date)}</TableCell>
                    <TableCell className="text-slate-400 text-sm">{p.memo ?? '-'}</TableCell>
                    <TableCell>
                      <Badge className={p.deducted_settlement_id ? 'bg-emerald-800 text-emerald-300' : 'bg-orange-800 text-orange-300'}>
                        {p.deducted_settlement_id ? 'Í≥µÏ†ú ?ÑÎ£å' : 'ÎØ∏Í≥µ??}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost"
                        onClick={() => handleDelete(p.id, p.riders?.name, 'advance')}
                        className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 h-8 px-3">
                        <Trash2 className="h-3.5 w-3.5 mr-1" />??†ú
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ?åÏàò ?¥Ïó≠ ?åÏù¥Î∏?*/}
      <Card className="border-emerald-700/40 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-emerald-400 text-base flex items-center gap-2">
            <RotateCcw className="h-4 w-4" />
            ?åÏàò ?¥Ïó≠ ({recoveries.length}Í±?
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-slate-700 hover:bg-transparent">
                <TableHead className="text-slate-400">?ºÏù¥??/TableHead>
                <TableHead className="text-slate-400">Í∏àÏï°</TableHead>
                <TableHead className="text-slate-400">?åÏàò Ï£ºÍ∞Ñ</TableHead>
                <TableHead className="text-slate-400">Î©îÎ™®</TableHead>
                <TableHead className="text-slate-400 text-right">Í¥ÄÎ¶?/TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">Î°úÎî© Ï§?..</TableCell></TableRow>
              ) : recoveries.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-slate-500 py-8">?åÏàò ?¥Ïó≠???ÜÏäµ?àÎã§.</TableCell></TableRow>
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
                        <Trash2 className="h-3.5 w-3.5 mr-1" />??†ú
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* ?†Ï?Í∏âÍ∏à ?±Î°ù ?§Ïù¥?ºÎ°úÍ∑?*/}
      <Dialog open={advanceOpen} onOpenChange={setAdvanceOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-blue-400" />?†Ï?Í∏âÍ∏à ?±Î°ù
            </DialogTitle>
          </DialogHeader>
          {renderForm('advance', advanceForm, setAdvanceForm)}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAdvanceOpen(false)} className="text-slate-400 hover:text-white">Ï∑®ÏÜå</Button>
            <Button onClick={() => handleSave('advance')} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? '?Ä??Ï§?..' : '?±Î°ù'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ?åÏàò ?±Î°ù ?§Ïù¥?ºÎ°úÍ∑?*/}
      <Dialog open={recoveryOpen} onOpenChange={setRecoveryOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <RotateCcw className="h-5 w-5 text-emerald-400" />?åÏàò ?±Î°ù
            </DialogTitle>
          </DialogHeader>
          {renderForm('recovery', recoveryForm, setRecoveryForm)}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecoveryOpen(false)} className="text-slate-400 hover:text-white">Ï∑®ÏÜå</Button>
            <Button onClick={() => handleSave('recovery')} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">
              {saving ? '?Ä??Ï§?..' : '?±Î°ù'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
