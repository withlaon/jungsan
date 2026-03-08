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

// ?€?€ ê°™ì? ?¤ì •???„ë¡œëª¨ì…˜???˜ë‚˜ë¡?ë¬¶ì? ê·¸ë£¹ ?€?€
interface PromoGroup {
  key: string
  promos: PromotionWithRider[]   // ê°™ì? ?¤ì •, ?¼ì´?”ë§Œ ?¤ë¥¸ ?ˆì½”?œë“¤
  // ?€???„ë“œ (ëª¨ë“  ë©¤ë²„ê°€ ê³µí†µ)
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

// ?€?€ ì£¼ê°„ ?µì…˜ ?€?€
function getWeekOptions() {
  const options: { label: string; value: string }[] = []
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const daysBack = (today.getDay() - 3 + 7) % 7
  const baseWed = new Date(today); baseWed.setDate(today.getDate() - daysBack)
  const fmt = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
  const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const dl = ['??,'??,'??,'??,'ëª?,'ê¸?,'??]
  for (let i = 0; i < 24; i++) {
    const wed = new Date(baseWed); wed.setDate(baseWed.getDate() - i * 7)
    const tue = new Date(wed); tue.setDate(wed.getDate() + 6)
    options.push({ label: `${fmt(wed)}(${dl[wed.getDay()]}) ~ ${fmt(tue)}(${dl[tue.getDay()]})`, value: fmtISO(wed) })
  }
  return options
}
const weekOptions = getWeekOptions()
const weekLabel = (v: string | null) => v ? (weekOptions.find(w => w.value === v)?.label ?? v) : null

// ?€?€ ë©€???¼ì´??ì²´í¬ë°•ìŠ¤ ?€?‰íŠ¸ ?€?€
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
          ? <span className="text-slate-500">?¼ì´??? íƒ (ë¯¸ì„ ?????„ì²´ ?ìš©)</span>
          : <span className="text-blue-300 font-medium">{selectedRiders.length}ëª?? íƒ?? {selectedRiders.map(r => r.name).join(', ')}</span>}
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
          <button type="button" onClick={() => onChange([])} className="text-slate-500 hover:text-slate-300 text-xs px-1">?„ì²´ ?´ì œ</button>
        </div>
      )}
      {open && (
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-xl">
          <div className="p-2 border-b border-slate-700">
            <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <Input autoFocus value={search} onChange={e => setSearch(e.target.value)} placeholder="?´ë¦„Â·?„ì´??ê²€?? className="pl-7 h-8 text-sm bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
            </div>
          </div>
          {filtered.length > 0 && (
            <button type="button" onClick={toggleAll} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 border-b border-slate-700">
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${allFilteredSel ? 'bg-blue-600 border-blue-500' : 'border-slate-500 bg-slate-700'}`}>
                {allFilteredSel && <span className="text-white text-xs font-bold">??/span>}
              </span>
              <span className="text-xs font-medium">{search ? `ê²€?‰ëœ ${filtered.length}ëª??„ì²´ ? íƒ` : `?„ì²´ ? íƒ (${riders.length}ëª?`}</span>
            </button>
          )}
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? <p className="text-slate-500 text-sm text-center py-3">ê²€??ê²°ê³¼ ?†ìŒ</p>
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
            <span className="text-slate-500 text-xs">{values.length}ëª?? íƒ??/span>
            <Button type="button" size="sm" onClick={() => setOpen(false)} className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700">?•ì¸</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ?€?€ êµ¬ê°„ ?ë””???€?€
interface RangeFormItem { min_count: string; max_count: string; amount: string }
function RangeEditor({ ranges, onChange }: { ranges: RangeFormItem[]; onChange: (r: RangeFormItem[]) => void }) {
  const update = (i: number, f: keyof RangeFormItem, v: string) => { const n=[...ranges]; n[i]={...n[i],[f]:v}; onChange(n) }
  return (
    <div className="space-y-2">
      {ranges.map((r, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <Input value={r.min_count} onChange={e => update(i,'min_count',e.target.value)} placeholder="ìµœì†Œ" type="number" min="0" className="w-20 bg-slate-800 border-slate-600 text-white text-sm h-8 px-2" />
          <span className="text-slate-500 text-sm">~</span>
          <Input value={r.max_count} onChange={e => update(i,'max_count',e.target.value)} placeholder="ìµœë?(?‘ë¹„?€)" type="number" min="0" className="w-24 bg-slate-800 border-slate-600 text-white text-sm h-8 px-2" />
          <span className="text-slate-500 text-sm">ê±?</span>
          <Input value={r.amount} onChange={e => update(i,'amount',e.target.value)} placeholder="ê¸ˆì•¡" type="number" min="0" className="w-24 bg-slate-800 border-slate-600 text-white text-sm h-8 px-2" />
          <span className="text-slate-500 text-sm">??/span>
          {ranges.length > 1 && <button onClick={() => onChange(ranges.filter((_,idx)=>idx!==i))} className="text-slate-500 hover:text-rose-400"><X className="h-3.5 w-3.5" /></button>}
        </div>
      ))}
      <Button type="button" size="sm" variant="ghost" onClick={() => onChange([...ranges,{min_count:'',max_count:'',amount:''}])} className="text-blue-400 hover:text-blue-300 hover:bg-blue-900/20 h-7 text-xs px-2">
        <PlusCircle className="h-3.5 w-3.5 mr-1" />êµ¬ê°„ ì¶”ê?
      </Button>
    </div>
  )
}

function formatRanges(ranges: PromoRange[]) {
  return ranges.map(r => r.max_count !== null ? `${r.min_count}~${r.max_count}ê±? ${formatKRW(r.amount)}` : `${r.min_count}ê±??´ìƒ: ${formatKRW(r.amount)}`).join(' / ')
}

function promoAutoName(p: PromotionWithRider): string {
  if (p.promo_kind === 'fixed') return `ê³ ì • ${formatKRW(p.amount)}`
  if (p.promo_kind === 'per_count') return `${p.per_count_min ?? 0}ê±??´ìƒ ê±´ìˆ˜ë³?
  return 'ë°°ë‹¬ê±´ìˆ˜êµ¬ê°„ ?„ë¡œëª¨ì…˜'
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

  // ?ì„¸ ?¤ì´?¼ë¡œê·????˜ì •/ì¶”ê? ?íƒœ
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

  // ?€?€ ?„ë¡œëª¨ì…˜ ê·¸ë£¹???€?€
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
    if (target_type === 'individual' && rider_ids.length === 0) { toast.error('?¼ì´?”ë? ? íƒ?´ì£¼?¸ìš”.'); return }
    if (date_mode === 'deadline' && !deadline_date) { toast.error('ë§ˆê°?¼ì„ ?…ë ¥?´ì£¼?¸ìš”.'); return }
    if (!description.trim()) { toast.error('?„ë¡œëª¨ì…˜ ?´ë¦„(?¤ëª…)???…ë ¥?´ì£¼?¸ìš”.'); return }

    let finalAmount = 0, finalRanges: PromoRange[] | null = null, finalPerCountMin: number | null = null
    if (promo_kind === 'fixed') {
      const a = parseInt(amount.replace(/,/g, ''))
      if (isNaN(a) || a <= 0) { toast.error('?¬ë°”ë¥?ê¸ˆì•¡???…ë ¥?´ì£¼?¸ìš”.'); return }
      finalAmount = a
    } else if (promo_kind === 'per_count') {
      const a = parseInt(per_count_amount.replace(/,/g, ''))
      if (isNaN(a) || a <= 0) { toast.error('ì´ˆê³¼ ê±´ë‹¹ ê¸ˆì•¡???…ë ¥?´ì£¼?¸ìš”.'); return }
      finalAmount = a
      const m = parseInt(per_count_min)
      if (isNaN(m) || m < 1) { toast.error('?¬ë°”ë¥?ìµœì†Œ ê±´ìˆ˜ë¥??…ë ¥?´ì£¼?¸ìš”.'); return }
      finalPerCountMin = m
    } else {
      const parsed = ranges.map(r => ({ min_count: parseInt(r.min_count)||0, max_count: r.max_count.trim() ? parseInt(r.max_count) : null, amount: parseInt(r.amount)||0 }))
      if (parsed.some(r => r.amount <= 0)) { toast.error('ê°?êµ¬ê°„??ê¸ˆì•¡???…ë ¥?´ì£¼?¸ìš”.'); return }
      finalRanges = parsed
    }

    const base: Record<string, unknown> = { type: target_type, promo_kind, amount: finalAmount, ranges: finalRanges, per_count_min: finalPerCountMin, date_mode, week_start: date_mode==='week'?week_start:null, deadline_date: date_mode==='deadline'?deadline_date:null, description: description.trim(), settlement_id: null }
    if (userId) base.user_id = userId
    setSaving(true)
    if (rider_ids.length > 0) {
      const { error } = await supabase.from('promotions').insert(rider_ids.map(id => ({ ...base, rider_id: id })))
      if (error) { toast.error('?±ë¡ ?¤íŒ¨: ' + error.message); setSaving(false); return }
      toast.success(`${rider_ids.length}ëª…ì—ê²??„ë¡œëª¨ì…˜???±ë¡?˜ì—ˆ?µë‹ˆ??`)
    } else {
      const { error } = await supabase.from('promotions').insert({ ...base, rider_id: null })
      if (error) { toast.error('?±ë¡ ?¤íŒ¨: ' + error.message); setSaving(false); return }
      toast.success('?„ë¡œëª¨ì…˜???±ë¡?˜ì—ˆ?µë‹ˆ??')
    }
    setSaving(false); setRegOpen(false); fetchData()
  }

  const handleDeleteOne = async (id: string) => {
    if (!confirm('????ª©???? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?')) return
    const { error } = await supabase.from('promotions').delete().eq('id', id)
    if (error) { toast.error('?? œ ?¤íŒ¨'); return }
    toast.success('?? œ?˜ì—ˆ?µë‹ˆ??')
    const updated = promotions.filter(p => p.id !== id)
    setPromotions(updated)
    // ?ì„¸ ?¤ì´?¼ë¡œê·?ê°±ì‹ 
    if (detailGroup) {
      const fresh = updated.filter(p => groupKey(p) === detailGroup.key)
      if (fresh.length === 0) setDetailGroup(null)
      else setDetailGroup(g => g ? { ...g, promos: fresh } : null)
    }
  }

  const handleAddRidersToGroup = async (g: PromoGroup) => {
    if (detailAddIds.length === 0) { toast.error('ì¶”ê????¼ì´?”ë? ? íƒ?´ì£¼?¸ìš”.'); return }
    setDetailSaving(true)
    const existing = new Set(g.promos.map(p => p.rider_id).filter(Boolean))
    const newIds = detailAddIds.filter(id => !existing.has(id))
    if (newIds.length === 0) { toast.error('? íƒ???¼ì´?”ëŠ” ?´ë? ëª¨ë‘ ?ìš©?˜ì–´ ?ˆìŠµ?ˆë‹¤.'); setDetailSaving(false); return }
    const base: Record<string, unknown> = {
      type: g.type, promo_kind: g.promo_kind, amount: g.amount, ranges: g.ranges,
      per_count_min: g.per_count_min, date_mode: g.date_mode,
      week_start: g.week_start, deadline_date: g.deadline_date,
      description: g.description, settlement_id: null,
    }
    if (userId) base.user_id = userId
    const { error } = await supabase.from('promotions').insert(newIds.map(id => ({ ...base, rider_id: id })))
    if (error) { toast.error('ì¶”ê? ?¤íŒ¨: ' + error.message); setDetailSaving(false); return }
    toast.success(`${newIds.length}ëª??¼ì´?”ê? ì¶”ê??˜ì—ˆ?µë‹ˆ??`)
    setDetailAddIds([])
    setDetailSaving(false)
    setDetailTab('info')
    fetchData()
  }

  const handleEditGroup = async (g: PromoGroup) => {
    const f = detailEditForm
    if (!f.description.trim()) { toast.error('?„ë¡œëª¨ì…˜ ?´ë¦„???…ë ¥?´ì£¼?¸ìš”.'); return }
    let finalAmount = 0, finalRanges: PromoRange[] | null = null, finalPerCountMin: number | null = null
    if (f.promo_kind === 'fixed') {
      const a = parseInt(f.amount.replace(/,/g, ''))
      if (isNaN(a) || a <= 0) { toast.error('?¬ë°”ë¥?ê¸ˆì•¡???…ë ¥?´ì£¼?¸ìš”.'); return }
      finalAmount = a
    } else if (f.promo_kind === 'per_count') {
      const a = parseInt(f.per_count_amount.replace(/,/g, ''))
      if (isNaN(a) || a <= 0) { toast.error('ì´ˆê³¼ ê±´ë‹¹ ê¸ˆì•¡???…ë ¥?´ì£¼?¸ìš”.'); return }
      finalAmount = a
      const m = parseInt(f.per_count_min)
      if (isNaN(m) || m < 1) { toast.error('?¬ë°”ë¥?ìµœì†Œ ê±´ìˆ˜ë¥??…ë ¥?´ì£¼?¸ìš”.'); return }
      finalPerCountMin = m
    } else {
      const parsed = f.ranges.map(r => ({ min_count: parseInt(r.min_count) || 0, max_count: r.max_count.trim() ? parseInt(r.max_count) : null, amount: parseInt(r.amount) || 0 }))
      if (parsed.some(r => r.amount <= 0)) { toast.error('ê°?êµ¬ê°„??ê¸ˆì•¡???…ë ¥?´ì£¼?¸ìš”.'); return }
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
    if (error) { toast.error('?˜ì • ?¤íŒ¨: ' + error.message); setDetailSaving(false); return }
    toast.success('?„ë¡œëª¨ì…˜???˜ì •?˜ì—ˆ?µë‹ˆ??')
    setDetailTab('info')
    setDetailSaving(false)
    fetchData()
  }

  const handleDeleteGroup = async (g: PromoGroup) => {
    if (!confirm(`"${g.description || promoAutoName(g.promos[0])}" ?„ë¡œëª¨ì…˜ ?„ì²´ë¥??? œ?˜ì‹œê² ìŠµ?ˆê¹Œ?`)) return
    const ids = g.promos.map(p => p.id)
    const { error } = await supabase.from('promotions').delete().in('id', ids)
    if (error) { toast.error('?? œ ?¤íŒ¨'); return }
    toast.success('?? œ?˜ì—ˆ?µë‹ˆ??')
    setDetailGroup(null)
    fetchData()
  }

  // ê¸ˆì•¡ ?ìŠ¤??
  const amountText = (g: PromoGroup) => {
    if (g.promo_kind === 'range' && g.ranges) return formatRanges(g.ranges)
    if (g.promo_kind === 'per_count') return `${g.per_count_min}ê±??´ìƒ, ì´ˆê³¼ê±´ë‹¹ ${formatKRW(g.amount)}`
    return formatKRW(g.amount)
  }
  // ê¸°ê°„ ?ìŠ¤??
  const periodText = (g: PromoGroup) => {
    if (g.date_mode === 'none') return 'ë§¤ì£¼ ?ë™ ?ìš©'
    if (g.date_mode === 'week') return weekLabel(g.week_start) ?? g.week_start ?? '-'
    return `ë§ˆê° ${g.deadline_date}`
  }
  // ?¼ì´???ìŠ¤??
  const riderText = (g: PromoGroup) => {
    const named = g.promos.filter(p => p.riders?.name).map(p => p.riders!.name)
    if (named.length === 0) return '?„ì²´ ?¼ì´??
    if (named.length <= 3) return named.join(', ')
    return `${named.slice(0, 3).join(', ')} ??${named.length - 3}ëª?
  }

  const kindColor = (k: string) => k === 'fixed' ? 'bg-blue-900/40 text-blue-300' : k === 'range' ? 'bg-violet-900/40 text-violet-300' : 'bg-amber-900/40 text-amber-300'
  const kindLabel = (k: string) => k === 'fixed' ? 'ê³ ì •ê¸ˆì•¡' : k === 'range' ? 'ê±´ìˆ˜êµ¬ê°„' : 'ê±´ìˆ˜ë³?

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* ?¤ë” */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">?„ë¡œëª¨ì…˜ ?¤ì •</h2>
          <p className="text-slate-400 text-sm mt-1">?„ë¡œëª¨ì…˜ ?±ë¡ ë°??ìš© ?¼ì´??ê´€ë¦?/p>
        </div>
        <Button onClick={() => { setForm(initForm()); setRegOpen(true) }} className="bg-blue-600 hover:bg-blue-700 text-white">
          <Plus className="h-4 w-4 mr-2" />?„ë¡œëª¨ì…˜ ?±ë¡
        </Button>
      </div>

      {/* ?”ì•½ */}
      <div className="flex items-center gap-4 text-sm text-slate-400">
        <span>ì´?<span className="text-white font-semibold">{groups.length}</span>ê°??„ë¡œëª¨ì…˜</span>
        <span>Â·</span>
        <span>?ìš© ê±´ìˆ˜ <span className="text-white font-semibold">{promotions.length}</span>ê±?/span>
      </div>

      {/* ?„ë¡œëª¨ì…˜ ì¹´ë“œ ëª©ë¡ */}
      {loading ? (
        <div className="text-slate-500 py-16 text-center">ë¡œë”© ì¤?..</div>
      ) : groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <Gift className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">?±ë¡???„ë¡œëª¨ì…˜???†ìŠµ?ˆë‹¤.</p>
          <p className="text-sm mt-1">?°ì¸¡ ?ë‹¨ ë²„íŠ¼?¼ë¡œ ?±ë¡??ì£¼ì„¸??</p>
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
                    ? <Badge className="text-xs bg-emerald-900/40 text-emerald-300">?„ì²´</Badge>
                    : <Badge className="text-xs bg-blue-900/40 text-blue-300">?¼ì´?”ë³„</Badge>}
                  {g.date_mode === 'none' && (
                    <Badge className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/40 flex items-center gap-1">
                      <RefreshCw className="h-2.5 w-2.5" />ë§¤ì£¼
                    </Badge>
                  )}
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-10 shrink-0">ê¸ˆì•¡</span>
                    <span className="text-violet-300 font-medium truncate">{amountText(g)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-10 shrink-0">ê¸°ê°„</span>
                    <span className="text-slate-300 truncate">{periodText(g)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-slate-500 w-10 shrink-0">?€??/span>
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

      {/* ?€?€ ?ì„¸ ?¤ì´?¼ë¡œê·??€?€ */}
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
                  {([['info', '?ì„¸ ?•ë³´'], ['add', '?¼ì´??ì¶”ê?'], ['edit', '?´ìš© ?˜ì •']] as const).map(([tab, label]) => (
                    <button key={tab} type="button" onClick={() => setDetailTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${detailTab === tab ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>

                {/* ?? ?ì„¸ ?•ë³´ */}
                {detailTab === 'info' && (
                  <div className="space-y-5 py-2">
                    <div className="bg-slate-800/60 rounded-xl p-4 space-y-2.5">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">?„ë¡œëª¨ì…˜ ?´ìš©</p>
                      <InfoRow label="ì¢…ë¥˜" value={<Badge className={`text-xs ${kindColor(g.promo_kind)}`}>{kindLabel(g.promo_kind)}</Badge>} />
                      <InfoRow label="ê¸ˆì•¡/ì¡°ê±´" value={<span className="text-violet-300 font-medium text-sm">{amountText(g)}</span>} />
                      <InfoRow label="?€??ê¸°ê°„" value={
                        g.date_mode === 'none'
                          ? <span className="flex items-center gap-1 text-emerald-400 text-sm"><RefreshCw className="h-3.5 w-3.5" />ë§¤ì£¼ ?ë™ ?ìš©</span>
                          : <span className="text-slate-300 text-sm">{periodText(g)}</span>
                      } />
                      <InfoRow label="?ìš© ?€?? value={
                        g.type === 'global'
                          ? <Badge className="text-xs bg-emerald-900/40 text-emerald-300">?„ì²´</Badge>
                          : <Badge className="text-xs bg-blue-900/40 text-blue-300">?¼ì´?”ë³„</Badge>
                      } />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" />?ìš© ?¼ì´??
                        </p>
                        <span className="text-slate-500 text-xs">{g.promos.length}ê±?/span>
                      </div>
                      {unnamedPromos.length > 0 && (
                        <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-900/20 border border-emerald-700/40 rounded-lg mb-2">
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-emerald-400" />
                            <span className="text-emerald-300 text-sm font-medium">?„ì²´ ?¼ì´???ìš©</span>
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
                        <p className="text-slate-500 text-sm text-center py-4">?ìš© ?¼ì´???†ìŒ</p>
                      )}
                    </div>
                  </div>
                )}

                {/* ?? ?¼ì´??ì¶”ê? */}
                {detailTab === 'add' && (
                  <div className="space-y-4 py-2">
                    <p className="text-slate-400 text-sm">???„ë¡œëª¨ì…˜??ì¶”ê?ë¡??ìš©???¼ì´?”ë? ? íƒ?˜ì„¸??</p>
                    <RiderMultiSelect
                      riders={riders.filter(r => !alreadyAppliedIds.has(r.id))}
                      values={detailAddIds}
                      onChange={setDetailAddIds}
                    />
                    {detailAddIds.length > 0 && (
                      <p className="text-blue-400 text-xs">{detailAddIds.length}ëª?? íƒ??/p>
                    )}
                    <Button
                      onClick={() => handleAddRidersToGroup(g)}
                      disabled={detailSaving || detailAddIds.length === 0}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {detailSaving ? 'ì¶”ê? ì¤?..' : `?¼ì´??${detailAddIds.length}ëª?ì¶”ê?`}
                    </Button>
                  </div>
                )}

                {/* ?? ?´ìš© ?˜ì • */}
                {detailTab === 'edit' && (
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">?„ë¡œëª¨ì…˜ ?´ë¦„ <span className="text-red-400">*</span></Label>
                      <input value={detailEditForm.description} onChange={e => setDE({ description: e.target.value })}
                        placeholder="?„ë¡œëª¨ì…˜ ?´ë¦„" className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">?„ë¡œëª¨ì…˜ ì¢…ë¥˜</Label>
                      <div className="flex gap-2">
                        {([{ value: 'fixed', label: 'ê³ ì •ê¸ˆì•¡' }, { value: 'range', label: 'ê±´ìˆ˜êµ¬ê°„' }, { value: 'per_count', label: 'ê±´ìˆ˜ë³? }] as const).map(opt => (
                          <button key={opt.value} type="button" onClick={() => setDE({ promo_kind: opt.value })}
                            className={`flex-1 py-2 px-2 rounded-md text-sm font-medium border transition-all ${detailEditForm.promo_kind === opt.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    {detailEditForm.promo_kind === 'fixed' && (
                      <div className="space-y-1.5">
                        <Label className="text-slate-300">ê¸ˆì•¡</Label>
                        <input type="number" value={detailEditForm.amount} onChange={e => setDE({ amount: e.target.value })}
                          className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                      </div>
                    )}
                    {detailEditForm.promo_kind === 'per_count' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-slate-300">ìµœì†Œ ê±´ìˆ˜</Label>
                          <input type="number" value={detailEditForm.per_count_min} onChange={e => setDE({ per_count_min: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-slate-300">ê±´ë‹¹ ê¸ˆì•¡</Label>
                          <input type="number" value={detailEditForm.per_count_amount} onChange={e => setDE({ per_count_amount: e.target.value })}
                            className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500" />
                        </div>
                      </div>
                    )}
                    {detailEditForm.promo_kind === 'range' && (
                      <div className="space-y-1.5">
                        <Label className="text-slate-300">ê±´ìˆ˜ êµ¬ê°„ë³?ê¸ˆì•¡</Label>
                        <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                          <RangeEditor ranges={detailEditForm.ranges} onChange={r => setDE({ ranges: r })} />
                        </div>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label className="text-slate-300">?€??ê¸°ê°„</Label>
                      <div className="flex gap-2">
                        {([{ value: 'week', label: 'ì£¼ê°„ ? íƒ' }, { value: 'deadline', label: 'ë§ˆê°??ì§€?? }, { value: 'none', label: 'ë¯¸ì???(ë§¤ì£¼)' }] as const).map(opt => (
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
                      {detailSaving ? '?˜ì • ì¤?..' : '?˜ì • ?€??}
                    </Button>
                  </div>
                )}

                <DialogFooter className="border-t border-slate-700 pt-4 flex justify-between">
                  <Button variant="ghost" onClick={() => handleDeleteGroup(g)}
                    className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20">
                    <Trash2 className="h-4 w-4 mr-2" />?„ì²´ ?? œ
                  </Button>
                  <Button variant="ghost" onClick={() => setDetailGroup(null)} className="text-slate-400 hover:text-white">?«ê¸°</Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ?€?€ ?±ë¡ ?¤ì´?¼ë¡œê·??€?€ */}
      <Dialog open={regOpen} onOpenChange={setRegOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Gift className="h-4 w-4 text-violet-400" />?„ë¡œëª¨ì…˜ ?±ë¡
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* ?„ë¡œëª¨ì…˜ ?´ë¦„ */}
            <div className="space-y-1.5">
              <Label className="text-slate-300">?„ë¡œëª¨ì…˜ ?´ë¦„ <span className="text-red-400">*</span></Label>
              <Input value={form.description} onChange={e => setF({ description: e.target.value })}
                placeholder="?? ?´ë²¤???„ë¡œëª¨ì…˜, ? ê·œ ?¼ì´???¹ë³„ ë³´ë„ˆ?? className="bg-slate-800 border-slate-600 text-white" />
            </div>

            {/* ?ìš© ?€??*/}
            <div className="space-y-1.5">
              <Label className="text-slate-300">?ìš© ?€??*</Label>
              <div className="flex gap-2">
                {([{ value: 'global', label: '?„ì²´ ?¼ì´??, icon: '?‘¥' }, { value: 'individual', label: '?¹ì • ?¼ì´??, icon: '?‘¤' }] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setF({ target_type: opt.value, rider_id: '', rider_ids: [] })}
                    className={`flex-1 py-2 px-3 rounded-md text-sm font-medium border transition-all flex items-center justify-center gap-2 ${form.target_type === opt.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    <span>{opt.icon}</span>{opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* ?¼ì´??? íƒ */}
            <div className="space-y-1.5">
              {form.target_type === 'global' ? (
                <>
                  <Label className="text-slate-300">?¼ì´??? íƒ <span className="text-slate-500 text-xs">(ë¯¸ì„ ?????„ì²´ ?ìš©)</span></Label>
                  <RiderMultiSelect riders={riders} values={form.rider_ids} onChange={ids => setF({ rider_ids: ids })} />
                </>
              ) : (
                <>
                  <Label className="text-slate-300">?¼ì´??? íƒ <span className="text-red-400">*</span> <span className="text-slate-500 text-xs">(ë³µìˆ˜ ? íƒ ê°€??</span></Label>
                  <RiderMultiSelect riders={riders} values={form.rider_ids} onChange={ids => setF({ rider_ids: ids })} />
                </>
              )}
            </div>

            {/* ?„ë¡œëª¨ì…˜ ì¢…ë¥˜ */}
            <div className="space-y-1.5">
              <Label className="text-slate-300">?„ë¡œëª¨ì…˜ ì¢…ë¥˜ *</Label>
              <div className="flex gap-2">
                {([{ value: 'fixed', label: 'ê³ ì •ê¸ˆì•¡' }, { value: 'range', label: 'ë°°ë‹¬ê±´ìˆ˜êµ¬ê°„' }, { value: 'per_count', label: 'ë°°ë‹¬ê±´ìˆ˜ë³? }] as const).map(opt => (
                  <button key={opt.value} type="button" onClick={() => setF({ promo_kind: opt.value })}
                    className={`flex-1 py-2 px-2 rounded-md text-sm font-medium border transition-all ${form.promo_kind === opt.value ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {form.promo_kind === 'fixed' && (
              <div className="space-y-1.5">
                <Label className="text-slate-300">ê¸ˆì•¡ *</Label>
                <Input type="number" value={form.amount} onChange={e => setF({ amount: e.target.value })} placeholder="?? 10000" className="bg-slate-800 border-slate-600 text-white" />
              </div>
            )}
            {form.promo_kind === 'per_count' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">ìµœì†Œ ê±´ìˆ˜ <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Input type="number" value={form.per_count_min} onChange={e => setF({ per_count_min: e.target.value })} placeholder="?? 151" min="1" className="bg-slate-800 border-slate-600 text-white pr-16" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">ê±??´ìƒ</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">ì´ˆê³¼ ê±´ë‹¹ ê¸ˆì•¡ <span className="text-red-400">*</span></Label>
                  <div className="relative">
                    <Input type="number" value={form.per_count_amount} onChange={e => setF({ per_count_amount: e.target.value })} placeholder="?? 1000" className="bg-slate-800 border-slate-600 text-white pr-10" />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">??ê±?/span>
                  </div>
                </div>
                {form.per_count_min && form.per_count_amount && (
                  <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
                    <p className="text-slate-400 text-xs">?? {Number(form.per_count_min)+9}ê±??¬ì„± ??<span className="text-emerald-400">(?¬ì„±ê±´ìˆ˜ ??{Number(form.per_count_min)-1}) Ã— {Number(form.per_count_amount).toLocaleString()}??/span></p>
                  </div>
                )}
              </div>
            )}
            {form.promo_kind === 'range' && (
              <div className="space-y-1.5">
                <Label className="text-slate-300">ë°°ë‹¬ê±´ìˆ˜ êµ¬ê°„ë³?ê¸ˆì•¡ *</Label>
                <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                  <RangeEditor ranges={form.ranges} onChange={r => setF({ ranges: r })} />
                </div>
              </div>
            )}

            {/* ?€??ê¸°ê°„ */}
            <div className="space-y-2">
              <Label className="text-slate-300">?€??ê¸°ê°„</Label>
              <div className="flex gap-2">
                {([{ value: 'week', label: 'ì£¼ê°„ ? íƒ' }, { value: 'deadline', label: 'ë§ˆê°??ì§€?? }, { value: 'none', label: 'ë¯¸ì???(ë§¤ì£¼)' }] as const).map(opt => (
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
                  <p className="text-emerald-300 text-xs">?? œ?˜ê¸° ?„ê¹Œì§€ ë§¤ì£¼ ?•ì‚° ???ë™?¼ë¡œ ?ìš©?©ë‹ˆ??</p>
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegOpen(false)} className="text-slate-400 hover:text-white">ì·¨ì†Œ</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? '?€??ì¤?..' : '?±ë¡'}
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
