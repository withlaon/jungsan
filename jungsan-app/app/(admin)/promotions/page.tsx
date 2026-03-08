'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useRiders } from '@/hooks/useRiders'
import { Promotion, PromoRange, Rider } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Card, CardContent } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Gift, Trash2, Users, Search, ChevronDown, X, PlusCircle, RefreshCw, ChevronRight, UserCircle } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { toast } from 'sonner'

type PromotionWithRider = Promotion & { riders: Rider | null }

// ?? 媛숈? ?ㅼ젙???꾨줈紐⑥뀡???섎굹濡?臾띠? 洹몃９ ??
interface PromoGroup {
  key: string
  promos: PromotionWithRider[]   // 媛숈? ?ㅼ젙, ?쇱씠?붾쭔 ?ㅻⅨ ?덉퐫?쒕뱾
  // ????꾨뱶 (紐⑤뱺 硫ㅻ쾭媛 怨듯넻)
  promo_kind: 'fixed' | 'range' | 'per_count'
  amount: number
  ranges: PromoRange[] | null
  per_count_min: number | null
  date_mode: 'week' | 'deadline' | 'none'
  week_start: string | null
  deadline_date: string | null
  description: string | null
  type: 'global' | 'individual'
  created_at: string
}

// ?? 二쇨컙 ?듭뀡 ??
function getWeekOptions() {
  const options: { label: string; value: string }[] = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysBack = (today.getDay() - 3 + 7) % 7
  const baseWed = new Date(today); baseWed.setDate(today.getDate() - daysBack)
  const fmt = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
  const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const dl = ['??,'??,'??,'??,'紐?,'湲?,'??]
  for (let i = 0; i < 24; i++) {
    const wed = new Date(baseWed); wed.setDate(baseWed.getDate() - i * 7)
    const tue = new Date(wed); tue.setDate(wed.getDate() + 6)
    options.push({ label: `${fmt(wed)}(${dl[wed.getDay()]}) ~ ${fmt(tue)}(${dl[tue.getDay()]})`, value: fmtISO(wed) })
  }
  return options
}
const weekOptions = getWeekOptions()
const weekLabel = (v: string | null) => v ? (weekOptions.find(w => w.value === v)?.label ?? v) : null

// ?? 硫???쇱씠??泥댄겕諛뺤뒪 ??됲듃 ??
function RiderMultiSelect({ riders, values, onChange }: { riders: Rider[]; values: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState('')
  const filtered = useMemo(() => riders.filter(r => r.name.includes(search) || (r.rider_username??'').includes(search)), [riders, search])
  const toggle = (id: string) => onChange(values.includes(id) ? values.filter(v => v !== id) : [...values, id])
  const toggleAll = () => {
    const allIds = filtered.map(r => r.id)
    const allSel = allIds.every(id => values.includes(id))
    onChange(allSel ? values.filter(id => !allIds.includes(id)) : [...new Set([...values, ...allIds])])
  }
  const selectedRiders = riders.filter(r => values.includes(r.id))
  const allFilteredSel = filtered.length > 0 && filtered.every(r => values.includes(r.id))
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white hover:border-slate-500 transition-colors min-h-[38px]">
        <span className="flex-1 text-left">{selectedRiders.length === 0
          ? <span className="text-slate-500">?쇱씠???좏깮 (誘몄꽑?????꾩껜 ?곸슜)</span>
          : <span className="text-blue-300 font-medium">{selectedRiders.length}紐??좏깮?? {selectedRiders.map(r => r.name).join(', ')}</span>}
        </span>
        <ChevronDown className="h-4 w-4 text-slate-400 shrink-0 ml-2" />
      </button>
      {selectedRiders.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {selectedRiders.map(r => (
            <span key={r.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-900/40 text-blue-300 text-xs rounded-full border border-blue-700/50">
              {r.name}<button type="button" onClick={() => toggle(r.id)}><X className="h-3 w-3" /></button>
            </span>
          ))}
          <button type="button" onClick={() => onChange([])} className="text-slate-500 hover:text-slate-300 text-xs px-1">?꾩껜 ?댁젣</button>
        </div>
      )}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-xl">
          <div className="p-2 border-b border-slate-700">
            <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="?대쫫쨌?꾩씠??寃?? className="pl-7 h-8 text-sm bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
            </div>
          </div>
          {filtered.length > 0 && (
            <button type="button" onClick={toggleAll} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 border-b border-slate-700">
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${allFilteredSel ? 'bg-blue-600 border-blue-500' : 'border-slate-500 bg-slate-700'}`}>
                {allFilteredSel && <span className="text-white text-xs font-bold">??/span>}
              </span>
              <span className="text-xs font-medium">{search ? `寃?됰맂 ${filtered.length}紐??꾩껜 ?좏깮` : `?꾩껜 ?좏깮 (${riders.length}紐?`}</span>
            </button>
          )}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-slate-500 text-sm text-center py-3">寃??寃곌낵 ?놁쓬</p>
              : filtered.map(r => {
                const checked = values.includes(r.id)
                return (
                  <button key={r.id} type="button" onClick={() => toggle(r.id)} className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-700 ${checked ? 'bg-blue-900/20' : ''}`}>
                    <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${checked ? 'bg-blue-600 border-blue-500' : 'border-slate-500 bg-slate-700'}`}>
                      {checked && <span className="text-white text-xs font-bold">??/span>}
                    </span>
                    <span className={`font-medium ${checked ? 'text-blue-300' : 'text-white'}`}>{r.name}</span>
                    {r.rider_username && <span className="text-slate-400 text-xs">@{r.rider_username}</span>}
                  </button>
                )
              })}
          </div>
          <div className="p-2 border-t border-slate-700 flex justify-between items-center">
            <span className="text-slate-500 text-xs">{values.length}紐??좏깮??/span>
            <Button type="button" size="sm" onClick={() => setOpen(false)} className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700">?뺤씤</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ?? 援ш컙 ?먮뵒????
interface RangeFormItem { min_count: string; max_count: string; amount: string }
function RangeEditor({ ranges, onChange }: { ranges: RangeFormItem[]; onChange: (r: RangeFormItem[]) => void }) {
  const update = (i: number, f: keyof RangeFormItem, v: string) => { const n=[...ranges]; n[i]={...n[i],[f]:v}; onChange(n) }
  return (
    <div className="space-y-2">
      {ranges.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input value={r.min_count} onChange={e => update(i,'min_count',e.target.value)} placeholder="理쒖냼" type="number" min="0" className="w-20 bg-slate-800 border-slate-600 text-white text-sm h-8 px-2" />
          <span className="text-slate-500 text-sm">~</span>
          <Input value={r.max_count} onChange={e => update(i,'max_count',e.target.value)} placeholder="理쒕?(?묐퉬?)" type="number" min="0" className="w-24 bg-slate-800 border-slate-600 text-white text-sm h-8 px-2" />
          <span className="text-slate-500 text-sm">嫄?</span>
          <Input value={r.amount} onChange={e => update(i,'amount',e.target.value)} placeholder="湲덉븸" type="number" min="0" className="w-24 bg-slate-800 border-slate-600 text-white text-sm h-8 px-2" />
          <span className="text-slate-500 text-sm">??/span>
          {ranges.length > 1 && <button onClick={() => onChange(ranges.filter((_,idx)=>idx!==i))} className="text-slate-500 hover:text-rose-400"><X className="h-3.5 w-3.5" /></button>}
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...ranges,{min_count:'',max_count:'',amount:''}])} className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-7 text-xs px-2">
        <PlusCircle className="h-3.5 w-3.5 mr-1" />援ш컙 異붽?
      </Button>
    </div>
  )
}

function formatRanges(ranges: PromoRange[]) {
  return ranges.map(r => r.max_count !== null ? `${r.min_count}~${r.max_count}嫄? ${formatKRW(r.amount)}` : `${r.min_count}嫄??댁긽: ${formatKRW(r.amount)}`).join(' / ')
}

function promoAutoName(p: PromotionWithRider): string {
  if (p.promo_kind === 'fixed') return `怨좎젙 ${formatKRW(p.amount)}`
  if (p.promo_kind === 'per_count') return `${p.per_count_min ?? 0}嫄??댁긽 嫄댁닔蹂?
  return '諛곕떖嫄댁닔援ш컙 ?꾨줈紐⑥뀡'
}

function groupKey(p: PromotionWithRider): string {
  return [
    p.promo_kind, p.amount, p.per_count_min ?? '',
    p.date_mode, p.week_start ?? '', p.deadline_date ?? '',
    p.description ?? '', JSON.stringify(p.ranges ?? []),
    p.type,
  ].join('||')
}

const initForm = () => ({
  target_type: 'global' as 'global' | 'individual',
  promo_kind: 'fixed' as 'fixed' | 'range' | 'per_count',
  date_mode: 'week' as 'week' | 'deadline' | 'none',
  week_start: weekOptions[0]?.value ?? '',
  deadline_date: '',
  amount: '',
  per_count_amount: '',
  per_count_min: '',
  ranges: [{ min_count: '', max_count: '', amount: '' }] as RangeFormItem[],
  rider_id: '',
  rider_ids: [] as string[],
  description: '',
})

export default function PromotionsPage() {
  const supabase = createClient()
  const { userId, isAdmin, loading: userLoading } = useUser()
  const { riders: allRiders } = useRiders()
  const riders = allRiders.filter(r => r.status === 'active')
  const [promotions, setPromotions] = useState<PromotionWithRider[]>([])
  const [loading, setLoading] = useState(true)
  const [regOpen, setRegOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(initForm)
  const [detailGroup, setDetailGroup] = useState<PromoGroup | null>(null)
  const setF = (patch: Partial<ReturnType<typeof initForm>>) => setForm(f => ({ ...f, ...patch }))

  // ?곸꽭 ?ㅼ씠?쇰줈洹????섏젙/異붽? ?곹깭
  const [detailTab, setDetailTab] = useState<'info' | 'add' | 'edit'>('info')
  const [detailAddIds, setDetailAddIds] = useState<string[]>([])
  const [detailEditForm, setDetailEditForm] = useState(initForm())
  const [detailSaving, setDetailSaving] = useState(false)
  const setDE = (patch: Partial<ReturnType<typeof initForm>>) => setDetailEditForm(f => ({ ...f, ...patch }))

  useEffect(() => {
    if (isAdmin || userId) fetchData()
  }, [userId, isAdmin])

  const fetchData = async () => {
    if (!userId && !isAdmin) return
    setLoading(true)
    let q = supabase.from('promotions').select('*, riders(*)').order('created_at', { ascending: false })
    if (!isAdmin && userId) q = q.eq('user_id', userId)
    const promoRes = await q
    if (promoRes.data) setPromotions(promoRes.data as PromotionWithRider[])
    setLoading(false)
  }

  // ?? ?꾨줈紐⑥뀡 洹몃９????
  const groups = useMemo<PromoGroup[]>(() => {
    const map = new Map<string, PromotionWithRider[]>()
    promotions.forEach(p => {
      const k = groupKey(p)
      if (!map.has(k)) map.set(k, [])
      map.get(k)!.push(p)
    })
    return Array.from(map.entries()).map(([key, promos]) => {
      const rep = promos[0]
      return {
        key, promos,
        promo_kind: rep.promo_kind ?? 'fixed',
        amount: rep.amount,
        ranges: rep.ranges,
        per_count_min: rep.per_count_min ?? null,
        date_mode: rep.date_mode ?? 'week',
        week_start: rep.week_start ?? null,
        deadline_date: rep.deadline_date ?? null,
        description: rep.description ?? null,
        type: rep.type as 'global' | 'individual',
        created_at: rep.created_at,
      }
    })
  }, [promotions])

  const openDetail = (g: PromoGroup) => {
    setDetailTab('info')
    setDetailAddIds([])
    setDetailEditForm({
      ...initForm(),
      target_type: g.type,
      promo_kind: g.promo_kind,
      date_mode: g.date_mode,
      week_start: g.week_start ?? weekOptions[0]?.value ?? '',
      deadline_date: g.deadline_date ?? '',
      amount: g.promo_kind === 'fixed' ? String(g.amount) : '',
      per_count_amount: g.promo_kind === 'per_count' ? String(g.amount) : '',
      per_count_min: g.promo_kind === 'per_count' ? String(g.per_count_min ?? '') : '',
      ranges: g.ranges
        ? g.ranges.map(r => ({ min_count: String(r.min_count), max_count: r.max_count !== null ? String(r.max_count) : '', amount: String(r.amount) }))
        : [{ min_count: '', max_count: '', amount: '' }],
      description: g.description ?? '',
      rider_ids: [],
      rider_id: '',
    })
    const fresh = promotions.filter(p => groupKey(p) === g.key)
    setDetailGroup({ ...g, promos: fresh })
  }

  const handleSave = async () => {
    const { target_type, promo_kind, date_mode, week_start, deadline_date, amount, per_count_amount, per_count_min, ranges, rider_ids, description } = form
    if (target_type === 'individual' && rider_ids.length === 0) { toast.error('?쇱씠?붾? ?좏깮?댁＜?몄슂.'); return }
    if (date_mode === 'deadline' && !deadline_date) { toast.error('留덇컧?쇱쓣 ?낅젰?댁＜?몄슂.'); return }
    if (!description.trim()) { toast.error('?꾨줈紐⑥뀡 ?대쫫(?ㅻ챸)???낅젰?댁＜?몄슂.'); return }

    let finalAmount = 0, finalRanges: PromoRange[] | null = null, finalPerCountMin: number | null = null
    if (promo_kind === 'fixed') {
      const a = parseInt(amount.replace(/,/g, ''))
      if (isNaN(a) || a <= 0) { toast.error('?щ컮瑜?湲덉븸???낅젰?댁＜?몄슂.'); return }
      finalAmount = a
    } else if (promo_kind === 'per_count') {
      const a = parseInt(per_count_amount.replace(/,/g, ''))
      if (isNaN(a) || a <= 0) { toast.error('珥덇낵 嫄대떦 湲덉븸???낅젰?댁＜?몄슂.'); return }
      finalAmount = a
      const m = parseInt(per_count_min)
      if (isNaN(m) || m < 1) { toast.error('?щ컮瑜?理쒖냼 嫄댁닔瑜??낅젰?댁＜?몄슂.'); return }
      finalPerCountMin = m
    } else {
      const parsed = ranges.map(r => ({ min_count: parseInt(r.min_count)||0, max_count: r.max_count.trim() ? parseInt(r.max_count) : null, amount: parseInt(r.amount)||0 }))
      if (parsed.some(r => r.amount <= 0)) { toast.error('媛?援ш컙??湲덉븸???낅젰?댁＜?몄슂.'); return }
      finalRanges = parsed
    }

    const base: Record<string, unknown> = { type: target_type, promo_kind, amount: finalAmount, ranges: finalRanges, per_count_min: finalPerCountMin, date_mode, week_start: date_mode==='week'?week_start:null, deadline_date: date_mode==='deadline'?deadline_date:null, description: description.trim(), settlement_id: null }
    if (userId) base.user_id = userId
    setSaving(true)
    if (rider_ids.length > 0) {
      const { error } = await supabase.from('promotions').insert(rider_ids.map(id => ({ ...base, rider_id: id })))
      if (error) { toast.error('?깅줉 ?ㅽ뙣: ' + error.message); setSaving(false); return }
      toast.success(`${rider_ids.length}紐낆뿉寃??꾨줈紐⑥뀡???깅줉?섏뿀?듬땲??`)
    } else {
      const { error } = await supabase.from('promotions').insert({ ...base, rider_id: null })
      if (error) { toast.error('?깅줉 ?ㅽ뙣: ' + error.message); setSaving(false); return }
      toast.success('?꾨줈紐⑥뀡???깅줉?섏뿀?듬땲??')
    }
    setSaving(false); setRegOpen(false); fetchData()
  }

  const handleDeleteOne = async (id: string) => {
    if (!confirm('????ぉ????젣?섏떆寃좎뒿?덇퉴?')) return
    const { error } = await supabase.from('promotions').delete().eq('id', id)
    if (error) { toast.error('??젣 ?ㅽ뙣'); return }
    toast.success('??젣?섏뿀?듬땲??')
    const updated = promotions.filter(p => p.id !== id)
    setPromotions(updated)
    // ?곸꽭 ?ㅼ씠?쇰줈洹?媛깆떊
    if (detailGroup) {
      const fresh = updated.filter(p => groupKey(p) === detailGroup.key)
      if (fresh.length === 0) setDetailGroup(null)
      else setDetailGroup(g => g ? { ...g, promos: fresh } : null)
    }
  }

  const handleAddRidersToGroup = async (g: PromoGroup) => {
    if (detailAddIds.length === 0) { toast.error('異붽????쇱씠?붾? ?좏깮?댁＜?몄슂.'); return }
    setDetailSaving(true)
    const existing = new Set(g.promos.map(p => p.rider_id).filter(Boolean))
    const newIds = detailAddIds.filter(id => !existing.has(id))
    if (newIds.length === 0) { toast.error('?좏깮???쇱씠?붾뒗 ?대? 紐⑤몢 ?곸슜?섏뼱 ?덉뒿?덈떎.'); setDetailSaving(false); return }
    const base: Record<string, unknown> = {
      type: g.type, promo_kind: g.promo_kind, amount: g.amount, ranges: g.ranges,
      per_count_min: g.per_count_min, date_mode: g.date_mode,
      week_start: g.week_start, deadline_date: g.deadline_date,
      description: g.description, settlement_id: null,
    }
    if (userId) base.user_id = userId
    const { error } = await supabase.from('promotions').insert(newIds.map(id => ({ ...base, rider_id: id })))
    if (error) { toast.error('異붽? ?ㅽ뙣: ' + error.message); setDetailSaving(false); return }
    toast.success(`${newIds.length}紐??쇱씠?붽? 異붽??섏뿀?듬땲??`)
    setDetailAddIds([])
    setDetailSaving(false)
    setDetailTab('info')
    fetchData()
  }

  const handleEditGroup = async (g: PromoGroup) => {
    const f = detailEditForm
    if (!f.description.trim()) { toast.error('?꾨줈紐⑥뀡 ?대쫫???낅젰?댁＜?몄슂.'); return }
    let finalAmount = 0, finalRanges: PromoRange[] | null = null, finalPerCountMin: number | null = null
    if (f.promo_kind === 'fixed') {
      const a = parseInt(f.amount.replace(/,/g, ''))
      if (isNaN(a) || a <= 0) { toast.error('?щ컮瑜?湲덉븸???낅젰?댁＜?몄슂.'); return }
      finalAmount = a
    } else if (f.promo_kind === 'per_count') {
      const a = parseInt(f.per_count_amount.replace(/,/g, ''))
      if (isNaN(a) || a <= 0) { toast.error('珥덇낵 嫄대떦 湲덉븸???낅젰?댁＜?몄슂.'); return }
      finalAmount = a
      const m = parseInt(f.per_count_min)
      if (isNaN(m) || m < 1) { toast.error('?щ컮瑜?理쒖냼 嫄댁닔瑜??낅젰?댁＜?몄슂.'); return }
      finalPerCountMin = m
    } else {
      const parsed = f.ranges.map(r => ({ min_count: parseInt(r.min_count) || 0, max_count: r.max_count.trim() ? parseInt(r.max_count) : null, amount: parseInt(r.amount) || 0 }))
      if (parsed.some(r => r.amount <= 0)) { toast.error('媛?援ш컙??湲덉븸???낅젰?댁＜?몄슂.'); return }
      finalRanges = parsed
    }
    setDetailSaving(true)
    const updates = {
      promo_kind: f.promo_kind, amount: finalAmount, ranges: finalRanges,
      per_count_min: finalPerCountMin, date_mode: f.date_mode,
      week_start: f.date_mode === 'week' ? f.week_start : null,
      deadline_date: f.date_mode === 'deadline' ? f.deadline_date : null,
      description: f.description.trim(),
    }
    const { error } = await supabase.from('promotions').update(updates).in('id', g.promos.map(p => p.id))
    if (error) { toast.error('?섏젙 ?ㅽ뙣: ' + error.message); setDetailSaving(false); return }
    toast.success('?꾨줈紐⑥뀡???섏젙?섏뿀?듬땲??')
    setDetailTab('info')
    setDetailSaving(false)
    fetchData()
  }

  const handleDeleteGroup = async (g: PromoGroup) => {
    if (!confirm(`"${g.description || promoAutoName(g.promos[0])}" ?꾨줈紐⑥뀡 ?꾩껜瑜???젣?섏떆寃좎뒿?덇퉴?`)) return
    const ids = g.promos.map(p => p.id)
    const { error } = await supabase.from('promotions').delete().in('id', ids)
    if (error) { toast.error('??젣 ?ㅽ뙣'); return }
    toast.success('??젣?섏뿀?듬땲??')
    setDetailGroup(null)
    fetchData()
  }

  // 湲덉븸 ?띿뒪??
  const amountText = (g: PromoGroup) => {
    if (g.promo_kind === 'range' && g.ranges) return formatRanges(g.ranges)
    if (g.promo_kind === 'per_count') return `${g.per_count_min}嫄??댁긽, 珥덇낵嫄대떦 ${formatKRW(g.amount)}`
    return formatKRW(g.amount)
  }
  // 湲곌컙 ?띿뒪??
  const periodText = (g: PromoGroup) => {
    if (g.date_mode === 'none') return '留ㅼ＜ ?먮룞 ?곸슜'
    if (g.date_mode === 'week') return weekLabel(g.week_start) ?? g.week_start ?? '-'
    return `留덇컧 ${g.deadline_date}`
  }
  // ?쇱씠???띿뒪??
  const riderText = (g: PromoGroup) => {
    const named = g.promos.filter(p => p.riders?.name).map(p => p.riders!.name)
    if (named.length === 0) return '?꾩껜 ?쇱씠??
    if (named.length <= 3) return named.join(', ')
    return `${named.slice(0, 3).join(', ')} ??${named.length - 3}紐?
  }

  const kindColor = (k: string) => k === 'fixed' ? 'bg-blue-900/40 text-blue-300' : k === 'range' ? 'bg-violet-900/40 text-violet-300' : 'bg-amber-900/40 text-amber-300'
  const kindLabel = (k: string) => k === 'fixed' ? '怨좎젙湲덉븸' : k === 'range' ? '嫄댁닔援ш컙' : '嫄댁닔蹂?

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ?ㅻ뜑 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">?꾨줈紐⑥뀡 ?ㅼ젙</h2>
          <p className="text-slate-400 text-sm mt-1">?꾨줈紐⑥뀡 ?깅줉 諛??곸슜 ?쇱씠??愿由?/p>
        </div>
        <Button onClick={() => { setForm(initForm()); setRegOpen(true) }} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-2" />?꾨줈紐⑥뀡 ?깅줉
        </Button>
      </div>

      {/* ?붿빟 */}
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span>珥?<span className="text-white font-semibold">{groups.length}</span>媛??꾨줈紐⑥뀡</span>
        <span>쨌</span>
        <span>?곸슜 嫄댁닔 <span className="text-white font-semibold">{promotions.length}</span>嫄?/span>
      </div>

      {/* ?꾨줈紐⑥뀡 移대뱶 紐⑸줉 */}
      {loading ? (
        <div className="text-slate-500 py-16 text-center">濡쒕뵫 以?..</div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <Gift className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">?깅줉???꾨줈紐⑥뀡???놁뒿?덈떎.</p>
          <p className="text-sm mt-1">?곗륫 ?곷떒 踰꾪듉?쇰줈 ?깅줉??二쇱꽭??</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map(g => (
            <Card
              key={g.key}
              onClick={() => openDetail(g)}
              className="border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-blue-700/50 cursor-pointer transition-all group"
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <Gift className="h-4 w-4 text-violet-400 shrink-0" />
                    <h3 className="text-white font-semibold text-sm truncate">
                      {g.description || promoAutoName(g.promos[0])}
                    </h3>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors" />
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  <Badge className={`text-xs ${kindColor(g.promo_kind)}`}>{kindLabel(g.promo_kind)}</Badge>
                  {g.type === 'global'
                    ? <Badge className="text-xs bg-emerald-900/40 text-emerald-300">?꾩껜</Badge>
                    : <Badge className="text-xs bg-blue-900/40 text-blue-300">?쇱씠?붾퀎</Badge>}
                  {g.date_mode === 'none' && (
                    <Badge className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/40 flex items-center gap-1">
                      <RefreshCw className="h-2.5 w-2.5" />留ㅼ＜
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-10 shrink-0">湲덉븸</span>
                    <span className="text-violet-300 font-medium truncate">{amountText(g)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-10 shrink-0">湲곌컙</span>
                    <span className="text-slate-300 truncate">{periodText(g)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-10 shrink-0">???/span>
                    <span className="text-slate-300 truncate">{riderText(g)}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-slate-600 text-xs">{g.created_at.split('T')[0]}</span>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleDeleteGroup(g) }}
                    className="text-slate-600 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-900/20"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ?? ?곸꽭 ?ㅼ씠?쇰줈洹??? */}
      <Dialog open={!!detailGroup} onOpenChange={() => setDetailGroup(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          {detailGroup && (() => {
            const g = detailGroup
            const title = g.description || promoAutoName(g.promos[0])
            const namedPromos = g.promos.filter(p => p.riders?.name)
            const unnamedPromos = g.promos.filter(p => !p.riders?.name)
            const alreadyAppliedIds = new Set(g.promos.map(p => p.rider_id).filter(Boolean))
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <Gift className="h-4 w-4 text-violet-400" />{title}
                  </DialogTitle>
                </DialogHeader>

                {/* ??*/}
                <div className="flex gap-0 border-b border-slate-700 mb-2">
                  {([['info', '?곸꽭 ?뺣낫'], ['add', '?쇱씠??異붽?'], ['edit', '?댁슜 ?섏젙']] as const).map(([tab, label]) => (
                    <button key={tab} type="button" onClick={() => setDetailTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${detailTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* ?? ?곸꽭 ?뺣낫 */}
                {detailTab === 'info' && (
                  <div className="space-y-5 py-2">
                    <div className="bg-slate-800/60 rounded-xl p-4 space-y-2.5">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">?꾨줈紐⑥뀡 ?댁슜</p>
                      <InfoRow label="醫낅쪟" value={<Badge className={`text-xs ${kindColor(g.promo_kind)}`}>{kindLabel(g.promo_kind)}</Badge>} />
                      <InfoRow label="湲덉븸/議곌굔" value={<span className="text-violet-300 font-medium text-sm">{amountText(g)}</span>} />
                      <InfoRow label="???湲곌컙" value={
                        g.date_mode === 'none'
                          ? <span className="flex items-center gap-1 text-emerald-400 text-sm"><RefreshCw className="h-3.5 w-3.5" />留ㅼ＜ ?먮룞 ?곸슜</span>
                          : <span className="text-slate-300 text-sm">{periodText(g)}</span>
                      } />
                      <InfoRow label="?곸슜 ??? value={
                        g.type === 'global'
                          ? <Badge className="text-xs bg-emerald-900/40 text-emerald-300">?꾩껜</Badge>
                          : <Badge className="text-xs bg-blue-900/40 text-blue-300">?쇱씠?붾퀎</Badge>
                      } />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />?곸슜 ?쇱씠??
                        </p>
                        <span className="text-slate-500 text-xs">{g.promos.length}嫄?/span>
                      </div>
                      {unnamedPromos.length > 0 && (
                        <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-900/20 border border-emerald-700/40 rounded-lg mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-emerald-400" />
                            <span className="text-emerald-300 text-sm font-medium">?꾩껜 ?쇱씠???곸슜</span>
                          </div>
                          {unnamedPromos.map(p => (
                            <button key={p.id} type="button" onClick={() => handleDeleteOne(p.id)}
                              className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-900/20">
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          ))}
                        </div>
                      )}
                      {namedPromos.length > 0 && (
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {namedPromos.map(p => (
                            <div key={p.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                              <div className="flex items-center gap-2">
                                <UserCircle className="h-4 w-4 text-slate-500" />
                                <span className="text-white text-sm font-medium">{p.riders!.name}</span>
                                {p.riders!.rider_username && <span className="text-slate-500 text-xs">@{p.riders!.rider_username}</span>}
                              </div>
                              <button type="button" onClick={() => handleDeleteOne(p.id)}
                                className="text-slate-500 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-900/20">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                      {namedPromos.length === 0 && unnamedPromos.length === 0 && (
                        <p className="text-slate-500 text-sm text-center py-4">?곸슜 ?쇱씠???놁쓬</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ?? ?쇱씠??異붽? */}
                {detailTab === 'add' && (
                  <div className="space-y-4 py-2">
                    <p className="text-slate-400 text-sm">???꾨줈紐⑥뀡??異붽?濡??곸슜???쇱씠?붾? ?좏깮?섏꽭??</p>
                    <RiderMultiSelect
                      riders={riders.filter(r => !alreadyAppliedIds.has(r.id))}
                      values={detailAddIds}
                      onChange={setDetailAddIds}
                    />
                    {detailAddIds.length > 0 && (
                      <p className="text-blue-400 text-xs">{detailAddIds.length}紐??좏깮??/p>
                    )}
                    <Button
                      onClick={() => handleAddRidersToGroup(g)}
                      disabled={detailSaving || detailAddIds.length === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {detailSaving ? '異붽? 以?..' : `?쇱씠??${detailAddIds.length}紐?異붽?`}
                    </Button>
                  </div>
                )}

                {/* ?? ?댁슜 ?섏젙 */}
                {detailTab === 'edit' && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">?꾨줈紐⑥뀡 ?대쫫 <span className="text-red-400">*</span></Label>
                      <input value={detailEditForm.description} onChange={e => setDE({ description: e.target.value })}
                        placeholder="?꾨줈紐⑥뀡 ?대쫫" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">?꾨줈紐⑥뀡 醫낅쪟</Label>
                      <div className="flex gap-2">
                        {([{ value: 'fixed', label: '怨좎젙湲덉븸' }, { value: 'range', label: '嫄댁닔援ш컙' }, { value: 'per_count', label: '嫄댁닔蹂? }] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setDE({ promo_kind: opt.value })}
                            className={`flex-1 py-2 px-2 rounded-md text-sm font-medium border transition-all ${detailEditForm.promo_kind === opt.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {detailEditForm.promo_kind === 'fixed' && (
                      <div className="space-y-1.5">
                        <Label className="text-slate-300">湲덉븸</Label>
                        <input type="number" value={detailEditForm.amount} onChange={e => setDE({ amount: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                      </div>
                    )}
                    {detailEditForm.promo_kind === 'per_count' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-slate-300">理쒖냼 嫄댁닔</Label>
                          <input type="number" value={detailEditForm.per_count_min} onChange={e => setDE({ per_count_min: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-slate-300">嫄대떦 湲덉븸</Label>
                          <input type="number" value={detailEditForm.per_count_amount} onChange={e => setDE({ per_count_amount: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                      </div>
                    )}
                    {detailEditForm.promo_kind === 'range' && (
                      <div className="space-y-1.5">
                        <Label className="text-slate-300">嫄댁닔 援ш컙蹂?湲덉븸</Label>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                          <RangeEditor ranges={detailEditForm.ranges} onChange={r => setDE({ ranges: r })} />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-slate-300">???湲곌컙</Label>
                      <div className="flex gap-2">
                        {([{ value: 'week', label: '二쇨컙 ?좏깮' }, { value: 'deadline', label: '留덇컧??吏?? }, { value: 'none', label: '誘몄???(留ㅼ＜)' }] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setDE({ date_mode: opt.value })}
                            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border transition-all ${detailEditForm.date_mode === opt.value ? 'bg-violet-700 border-violet-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      {detailEditForm.date_mode === 'week' && (
                        <select value={detailEditForm.week_start} onChange={e => setDE({ week_start: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white appearance-none">
                          {weekOptions.map(w => <option key={w.value} value={w.value} className="bg-slate-800">{w.label}</option>)}
                        </select>
                      )}
                      {detailEditForm.date_mode === 'deadline' && (
                        <input type="date" value={detailEditForm.deadline_date} onChange={e => setDE({ deadline_date: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                      )}
                    </div>
                    <Button onClick={() => handleEditGroup(g)} disabled={detailSaving} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      {detailSaving ? '?섏젙 以?..' : '?섏젙 ???}
                    </Button>
                  </div>
                )}

                <DialogFooter className="border-t border-slate-700 pt-4 flex justify-between">
                  <Button variant="ghost" onClick={() => handleDeleteGroup(g)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20">
                    <Trash2 className="h-4 w-4 mr-2" />?꾩껜 ??젣
                  </Button>
                  <Button variant="ghost" onClick={() => setDetailGroup(null)} className="text-slate-400 hover:text-white">?リ린</Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ?? ?깅줉 ?ㅼ씠?쇰줈洹??? */}
      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gift className="h-4 w-4 text-violet-400" />?꾨줈紐⑥뀡 ?깅줉
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ?꾨줈紐⑥뀡 ?대쫫 */}
            <div className="space-y-1.5">
              <Label className="text-slate-300">?꾨줈紐⑥뀡 ?대쫫 <span className="text-red-400">*</span></Label>
              <Input value={form.description} onChange={e => setF({ description: e.target.value })}
                placeholder="?? ?대깽???꾨줈紐⑥뀡, ?좉퇋 ?쇱씠???밸퀎 蹂대꼫?? className="bg-slate-800 border-slate-600 text-white" />
            </div>

            {/* ?곸슜 ???*/}
            <div className="space-y-1.5">
              <Label className="text-slate-300">?곸슜 ???*</Label>
              <div className="flex gap-2">
                {([{ value: 'global', label: '?꾩껜 ?쇱씠??, icon: '?뫁' }, { value: 'individual', label: '?뱀젙 ?쇱씠??, icon: '?뫀' }] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setF({ target_type: opt.value, rider_id: '', rider_ids: [] })}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-all flex items-center justify-center gap-2 ${form.target_type === opt.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    <span>{opt.icon}</span>{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ?쇱씠???좏깮 */}
            <div className="space-y-1.5">
              {form.target_type === 'global' ? (
                <>
                  <Label className="text-slate-300">?쇱씠???좏깮 <span className="text-slate-500 text-xs">(誘몄꽑?????꾩껜 ?곸슜)</span></Label>
                  <RiderMultiSelect riders={riders} values={form.rider_ids} onChange={ids => setF({ rider_ids: ids })} />
                </>
              ) : (
                <>
                  <Label className="text-slate-300">?쇱씠???좏깮 <span className="text-red-400">*</span> <span className="text-slate-500 text-xs">(蹂듭닔 ?좏깮 媛??</span></Label>
                  <RiderMultiSelect riders={riders} values={form.rider_ids} onChange={ids => setF({ rider_ids: ids })} />
                </>
              )}
            </div>

            {/* ?꾨줈紐⑥뀡 醫낅쪟 */}
            <div className="space-y-1.5">
              <Label className="text-slate-300">?꾨줈紐⑥뀡 醫낅쪟 *</Label>
              <div className="flex gap-2">
                {([{ value: 'fixed', label: '怨좎젙湲덉븸' }, { value: 'range', label: '諛곕떖嫄댁닔援ш컙' }, { value: 'per_count', label: '諛곕떖嫄댁닔蹂? }] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setF({ promo_kind: opt.value })}
                    className={`flex-1 py-2 px-2 rounded-md text-sm font-medium border transition-all ${form.promo_kind === opt.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.promo_kind === 'fixed' && (
              <div className="space-y-1.5">
                <Label className="text-slate-300">湲덉븸 *</Label>
                <Input type="number" value={form.amount} onChange={e => setF({ amount: e.target.value })} placeholder="?? 10000" className="bg-slate-800 border-slate-600 text-white" />
              </div>
            )}
            {form.promo_kind === 'per_count' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">理쒖냼 嫄댁닔 <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Input type="number" value={form.per_count_min} onChange={e => setF({ per_count_min: e.target.value })} placeholder="?? 151" min="1" className="bg-slate-800 border-slate-600 text-white pr-16" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">嫄??댁긽</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">珥덇낵 嫄대떦 湲덉븸 <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Input type="number" value={form.per_count_amount} onChange={e => setF({ per_count_amount: e.target.value })} placeholder="?? 1000" className="bg-slate-800 border-slate-600 text-white pr-10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">??嫄?/span>
                  </div>
                </div>
                {form.per_count_min && form.per_count_amount && (
                  <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">?? {Number(form.per_count_min)+9}嫄??ъ꽦 ??<span className="text-emerald-400">(?ъ꽦嫄댁닔 ??{Number(form.per_count_min)-1}) 횞 {Number(form.per_count_amount).toLocaleString()}??/span></p>
                  </div>
                )}
              </div>
            )}
            {form.promo_kind === 'range' && (
              <div className="space-y-1.5">
                <Label className="text-slate-300">諛곕떖嫄댁닔 援ш컙蹂?湲덉븸 *</Label>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <RangeEditor ranges={form.ranges} onChange={r => setF({ ranges: r })} />
                </div>
              </div>
            )}

            {/* ???湲곌컙 */}
            <div className="space-y-2">
              <Label className="text-slate-300">???湲곌컙</Label>
              <div className="flex gap-2">
                {([{ value: 'week', label: '二쇨컙 ?좏깮' }, { value: 'deadline', label: '留덇컧??吏?? }, { value: 'none', label: '誘몄???(留ㅼ＜)' }] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setF({ date_mode: opt.value })}
                    className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border transition-all ${form.date_mode === opt.value ? 'bg-violet-700 border-violet-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              {form.date_mode === 'week' && (
                <div className="relative">
                  <select value={form.week_start} onChange={e => setF({ week_start: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white appearance-none cursor-pointer pr-8">
                    {weekOptions.map(w => <option key={w.value} value={w.value} className="bg-slate-800">{w.label}</option>)}
                  </select>
                  <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                </div>
              )}
              {form.date_mode === 'deadline' && (
                <Input type="date" value={form.deadline_date} onChange={e => setF({ deadline_date: e.target.value })} className="bg-slate-800 border-slate-600 text-white" />
              )}
              {form.date_mode === 'none' && (
                <div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/20 border border-emerald-700/40 rounded-md">
                  <RefreshCw className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  <p className="text-emerald-300 text-xs">??젣?섍린 ?꾧퉴吏 留ㅼ＜ ?뺤궛 ???먮룞?쇰줈 ?곸슜?⑸땲??</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegOpen(false)} className="text-slate-400 hover:text-white">痍⑥냼</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? '???以?..' : '?깅줉'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-700/40 last:border-0">
      <span className="text-slate-500 text-sm w-20 shrink-0">{label}</span>
      <span className="flex-1 text-right">{value}</span>
    </div>
  )
}