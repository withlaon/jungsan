'use client'

import { useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useRiders } from '@/hooks/useRiders'
import { InsuranceFee, ManagementFee, Rider } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Wrench, Trash2, Search, ChevronDown, RefreshCw, X, Phone, ShieldCheck, ChevronRight, UserCircle } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { toast } from 'sonner'

type FeeWithRider = ManagementFee & { riders: Rider | null }
type InsuranceFeeWithRider = InsuranceFee & { riders: Rider | null }
type DialogType = 'general' | 'call' | 'insurance' | null

interface FeeGroup {
  key: string
  items: FeeWithRider[]
  fee_type: 'general' | 'call'
  item_name: string
  amount: number
  date_mode: string
  week_start: string | null
  deadline_date: string | null
  memo: string | null
  created_at: string
}
interface InsuranceFeeGroup {
  key: string
  items: InsuranceFeeWithRider[]
  employment_fee: number
  accident_fee: number
  date_mode: string
  week_start: string | null
  deadline_date: string | null
  memo: string | null
  created_at: string
}

function getWeekOptions() {
  const options: { label: string; value: string }[] = []
  const today = new Date(); today.setHours(0,0,0,0)
  const daysBack = (today.getDay()-3+7)%7
  const baseWed = new Date(today); baseWed.setDate(today.getDate()-daysBack)
  const fmt = (d: Date) => `${d.getFullYear()}.${String(d.getMonth()+1).padStart(2,'0')}.${String(d.getDate()).padStart(2,'0')}`
  const fmtISO = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  const dl = ['?','?','?','?','?','?','?']
  for (let i=0;i<24;i++) {
    const wed=new Date(baseWed); wed.setDate(baseWed.getDate()-i*7)
    const tue=new Date(wed); tue.setDate(wed.getDate()+6)
    options.push({label:`${fmt(wed)}(${dl[wed.getDay()]}) ~ ${fmt(tue)}(${dl[tue.getDay()]})`,value:fmtISO(wed)})
  }
  return options
}
const weekOptions = getWeekOptions()
const weekLabel = (d: string | null) => d ? (weekOptions.find(w=>w.value===d)?.label ?? d) : null

function RiderMultiSelect({ riders, selected, onChange }: { riders: Rider[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false); const [search, setSearch] = useState('')
  const filtered = useMemo(() => riders.filter(r=>r.name.includes(search)||(r.rider_username??'').includes(search)||(r.phone??'').includes(search)),[riders,search])
  const toggle = (id: string) => onChange(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id])
  const toggleAll = () => onChange(selected.length===riders.length?[]:riders.map(r=>r.id))
  const label = selected.length===0?'?? ??? (?? ??)':selected.length===riders.length?`?? ${riders.length}? ??`:`${selected.length}? ??`
  return (
    <div className="relative">
      <button type="button" onClick={()=>setOpen(v=>!v)} className="w-full flex items-center justify-between px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white hover:border-slate-500 transition-colors">
        <span className={selected.length>0?'text-white':'text-slate-500'}>{label}</span>
        <div className="flex items-center gap-1">
          {selected.length>0&&<span onClick={e=>{e.stopPropagation();onChange([])}} className="text-slate-500 hover:text-white p-0.5"><X className="h-3.5 w-3.5"/></span>}
          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0"/>
        </div>
      </button>
      {open&&(
        <div className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-md shadow-xl">
          <div className="p-2 border-b border-slate-700 space-y-2">
            <div className="relative"><Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500"/>
              <Input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="?????????? ??" className="pl-7 h-8 text-sm bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"/>
            </div>
            <button type="button" onClick={toggleAll} className="w-full text-left px-2 py-1 text-xs text-slate-400 hover:text-white flex items-center gap-2">
              <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.length===riders.length?'bg-blue-600 border-blue-500':'border-slate-500'}`}>
                {selected.length===riders.length&&<span className="text-white text-xs">?</span>}
              </span>?? ?? / ??
            </button>
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length===0?<p className="text-slate-500 text-sm text-center py-3">?? ?? ??</p>
              :filtered.map(r=>(
                <button key={r.id} type="button" onClick={()=>toggle(r.id)} className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-700 transition-colors flex items-center gap-2.5 ${selected.includes(r.id)?'bg-blue-900/30':''}`}>
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${selected.includes(r.id)?'bg-blue-600 border-blue-500':'border-slate-500'}`}>
                    {selected.includes(r.id)&&<span className="text-white text-xs">?</span>}
                  </span>
                  <span className="font-medium text-white">{r.name}</span>
                  {r.rider_username&&<span className="text-slate-400 text-xs">@{r.rider_username}</span>}
                  {r.phone&&<span className="text-slate-500 text-xs">{r.phone}</span>}
                </button>
              ))}
          </div>
          <div className="p-2 border-t border-slate-700">
            <Button size="sm" onClick={()=>setOpen(false)} className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700">?? ({selected.length}? ??)</Button>
          </div>
        </div>
      )}
    </div>
  )
}

function periodText(dateMode: string, weekStart: string|null, deadlineDate: string|null) {
  if (dateMode==='none') return '?? ??'
  if (dateMode==='week') return weekLabel(weekStart) ?? '-'
  return `??? ${deadlineDate}`
}

function PeriodSelector({ dateMode, weekStart, deadlineDate, onChange }: { dateMode:'none'|'week'|'deadline'; weekStart:string; deadlineDate:string; onChange:(patch:Record<string,string>)=>void }) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-300">?? <span className="text-red-400">*</span></Label>
      <div className="flex gap-2">
        {([{value:'none',label:'??? (?? ??)'},{value:'week',label:'?? ??'},{value:'deadline',label:'??? ??'}] as const).map(opt=>(
          <button key={opt.value} type="button" onClick={()=>onChange({date_mode:opt.value})}
            className={`flex-1 py-1.5 px-2 rounded-md text-xs font-medium border transition-all ${dateMode===opt.value?'bg-blue-700 border-blue-500 text-white':'bg-slate-800 border-slate-600 text-slate-400 hover:border-slate-500'}`}>
            {opt.label}
          </button>
        ))}
      </div>
      {dateMode==='none'&&<div className="flex items-center gap-2 px-3 py-2 bg-emerald-900/20 border border-emerald-700/40 rounded-md"><RefreshCw className="h-3.5 w-3.5 text-emerald-400 shrink-0"/><p className="text-emerald-300 text-xs">?? ?? ??? ?? ?? ? ???? ?????.</p></div>}
      {dateMode==='week'&&<div className="relative"><select value={weekStart} onChange={e=>onChange({week_start:e.target.value})} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white appearance-none cursor-pointer pr-8">
        {weekOptions.map(w=><option key={w.value} value={w.value} className="bg-slate-800">{w.label}</option>)}
      </select><ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none"/></div>}
      {dateMode==='deadline'&&<Input type="date" value={deadlineDate} onChange={e=>onChange({deadline_date:e.target.value})} className="bg-slate-800 border-slate-600 text-white"/>}
    </div>
  )
}

const initGeneral = () => ({item_name:'',rider_ids:[] as string[],amount:'',date_mode:'none' as 'week'|'deadline'|'none',week_start:weekOptions[0]?.value??'',deadline_date:'',memo:''})
const initCall    = () => ({rider_ids:[] as string[],amount_per_call:'',date_mode:'none' as 'week'|'deadline'|'none',week_start:weekOptions[0]?.value??'',deadline_date:'',memo:''})
const initInsurance = () => ({rider_ids:[] as string[],employment_fee:'',accident_fee:'',date_mode:'none' as 'week'|'deadline'|'none',week_start:weekOptions[0]?.value??'',deadline_date:'',memo:''})

export default function SettingsPage() {
  const supabase = createClient()
  const { userId, isAdmin, loading: userLoading } = useUser()
  const { riders: allRiders } = useRiders()
  const riders = allRiders.filter(r => r.status === 'active')
  const [fees, setFees] = useState<FeeWithRider[]>([])
  const [insuranceFees, setInsuranceFees] = useState<InsuranceFeeWithRider[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogType, setDialogType] = useState<DialogType>(null)
  const [saving, setSaving] = useState(false)
  const [generalForm, setGeneralForm] = useState(initGeneral)
  const [callForm, setCallForm] = useState(initCall)
  const [insuranceForm, setInsuranceForm] = useState(initInsurance)

  const [detailFee, setDetailFee] = useState<FeeGroup | null>(null)
  const [detailIns, setDetailIns] = useState<InsuranceFeeGroup | null>(null)
  const [feeDetailTab, setFeeDetailTab] = useState<'info' | 'add' | 'edit'>('info')
  const [feeAddIds, setFeeAddIds] = useState<string[]>([])
  const [feeEditForm, setFeeEditForm] = useState({ item_name: '', amount: '', date_mode: 'none' as 'none'|'week'|'deadline', week_start: weekOptions[0]?.value??'', deadline_date: '', memo: '' })
  const [insDetailTab, setInsDetailTab] = useState<'info' | 'add' | 'edit'>('info')
  const [insAddIds, setInsAddIds] = useState<string[]>([])
  const [insEditForm, setInsEditForm] = useState({ employment_fee: '', accident_fee: '', date_mode: 'none' as 'none'|'week'|'deadline', week_start: weekOptions[0]?.value??'', deadline_date: '', memo: '' })
  const [detailSaving, setDetailSaving] = useState(false)

  useEffect(()=>{
    if (isAdmin || userId) fetchData()
  }, [userId, isAdmin])

  const fetchData = async () => {
    if (!userId && !isAdmin) return
    setLoading(true)
    const [feesRes, insRes] = await Promise.all([
      (() => { let q = supabase.from('management_fees').select('*, riders(*)').order('created_at',{ascending:false}); if (!isAdmin && userId) q = q.eq('user_id', userId); return q })(),
      (() => { let q = supabase.from('insurance_fees').select('*, riders(*)').order('created_at',{ascending:false}); if (!isAdmin && userId) q = q.eq('user_id', userId); return q })(),
    ])
    if (feesRes.data) setFees(feesRes.data as FeeWithRider[])
    if (insRes.data) setInsuranceFees(insRes.data as InsuranceFeeWithRider[])
    setLoading(false)
  }

  const setGF = (patch: Partial<ReturnType<typeof initGeneral>>) => setGeneralForm(f=>({...f,...patch}))
  const setCF = (patch: Partial<ReturnType<typeof initCall>>)    => setCallForm(f=>({...f,...patch}))
  const setIF = (patch: Partial<ReturnType<typeof initInsurance>>)=> setInsuranceForm(f=>({...f,...patch}))

  const feeGroups = useMemo<FeeGroup[]>(()=>{
    const map = new Map<string,FeeWithRider[]>()
    fees.forEach(f=>{
      const k = [f.fee_type,f.item_name,f.amount,f.date_mode,f.week_start??'',f.deadline_date??''].join('||')
      if (!map.has(k)) map.set(k,[])
      map.get(k)!.push(f)
    })
    return Array.from(map.entries()).map(([key,items])=>{
      const r=items[0]
      return {key,items,fee_type:r.fee_type as 'general'|'call',item_name:r.item_name,amount:r.amount,date_mode:r.date_mode,week_start:r.week_start,deadline_date:r.deadline_date,memo:r.memo,created_at:r.created_at}
    })
  },[fees])

  const insGroups = useMemo<InsuranceFeeGroup[]>(()=>{
    const map = new Map<string,InsuranceFeeWithRider[]>()
    insuranceFees.forEach(f=>{
      const k = [f.employment_fee,f.accident_fee,f.date_mode,f.week_start??'',f.deadline_date??''].join('||')
      if (!map.has(k)) map.set(k,[])
      map.get(k)!.push(f)
    })
    return Array.from(map.entries()).map(([key,items])=>{
      const r=items[0]
      return {key,items,employment_fee:r.employment_fee,accident_fee:r.accident_fee,date_mode:r.date_mode,week_start:r.week_start,deadline_date:r.deadline_date,memo:r.memo,created_at:r.created_at}
    })
  },[insuranceFees])

  const handleSaveGeneral = async () => {
    if (!generalForm.item_name.trim()){toast.error('??? ???? ??????.');return}
    const amount=parseInt(generalForm.amount.replace(/,/g,''))
    if (isNaN(amount)||amount<=0){toast.error('??? ??? ??????.');return}
    if (generalForm.date_mode==='deadline'&&!generalForm.deadline_date){toast.error('???? ??????.');return}
    setSaving(true)
    const riderIds=generalForm.rider_ids.length>0?generalForm.rider_ids:[null]
    const rows=riderIds.map(rid=>({fee_type:'general',item_name:generalForm.item_name.trim(),rider_id:rid,amount,date_mode:generalForm.date_mode,week_start:generalForm.date_mode==='week'?generalForm.week_start:null,deadline_date:generalForm.date_mode==='deadline'?generalForm.deadline_date:null,memo:generalForm.memo.trim()||null,...(userId?{user_id:userId}:{})}))
    const {error}=await supabase.from('management_fees').insert(rows)
    if (error){toast.error('?? ??: '+error.message);setSaving(false);return}
    toast.success(`??? ??? ${rows.length}? ???????.`)
    setSaving(false);setDialogType(null);setGeneralForm(initGeneral());fetchData()
  }
  const handleSaveCall = async () => {
    const amount=parseInt(callForm.amount_per_call.replace(/,/g,''))
    if (isNaN(amount)||amount<=0){toast.error('??? ?? ??? ??????.');return}
    if (callForm.date_mode==='deadline'&&!callForm.deadline_date){toast.error('???? ??????.');return}
    setSaving(true)
    const riderIds=callForm.rider_ids.length>0?callForm.rider_ids:[null]
    const rows=riderIds.map(rid=>({fee_type:'call',item_name:'????',rider_id:rid,amount,date_mode:callForm.date_mode,week_start:callForm.date_mode==='week'?callForm.week_start:null,deadline_date:callForm.date_mode==='deadline'?callForm.deadline_date:null,memo:callForm.memo.trim()||null,...(userId?{user_id:userId}:{})}))
    const {error}=await supabase.from('management_fees').insert(rows)
    if (error){toast.error('?? ??: '+error.message);setSaving(false);return}
    toast.success(`???? ${rows.length}? ???????.`)
    setSaving(false);setDialogType(null);setCallForm(initCall());fetchData()
  }
  const handleSaveInsurance = async () => {
    const empFee=parseInt(insuranceForm.employment_fee.replace(/,/g,''))
    const accFee=parseInt(insuranceForm.accident_fee.replace(/,/g,''))
    if ((isNaN(empFee)||empFee<0)&&(isNaN(accFee)||accFee<0)){toast.error('????? ?? ?????? ??????.');return}
    if (insuranceForm.rider_ids.length===0){toast.error('??? ???? ??????.');return}
    if (insuranceForm.date_mode==='deadline'&&!insuranceForm.deadline_date){toast.error('???? ??????.');return}
    setSaving(true)
    const rows=insuranceForm.rider_ids.map(rid=>({rider_id:rid,employment_fee:isNaN(empFee)?0:empFee,accident_fee:isNaN(accFee)?0:accFee,date_mode:insuranceForm.date_mode,week_start:insuranceForm.date_mode==='week'?insuranceForm.week_start:null,deadline_date:insuranceForm.date_mode==='deadline'?insuranceForm.deadline_date:null,memo:insuranceForm.memo.trim()||null,...(userId?{user_id:userId}:{})}))
    const {error}=await supabase.from('insurance_fees').insert(rows)
    if (error){toast.error('?? ??: '+error.message);setSaving(false);return}
    toast.success(`??/?? ??? ${rows.length}? ???????.`)
    setSaving(false);setDialogType(null);setInsuranceForm(initInsurance());fetchData()
  }

  const deleteFeeOne = async (id: string) => {
    if (!confirm('? ??? ????????')) return
    const {error}=await supabase.from('management_fees').delete().eq('id',id)
    if (error){toast.error('?? ??');return}
    toast.success('???????.')
    const updated=fees.filter(f=>f.id!==id)
    setFees(updated)
    if (detailFee){
      const freshGroup=updated.filter(f=>feeGroupKey(f)===detailFee.key)
      if (freshGroup.length===0) setDetailFee(null)
      else setDetailFee(g=>g?{...g,items:freshGroup}:null)
    }
  }
  const deleteFeeGroup = async (g: FeeGroup) => {
    if (!confirm(`"${g.item_name}" ??? ??? ????????`)) return
    const {error}=await supabase.from('management_fees').delete().in('id',g.items.map(i=>i.id))
    if (error){toast.error('?? ??');return}
    toast.success('???????.');setDetailFee(null);fetchData()
  }
  const deleteInsOne = async (id: string) => {
    if (!confirm('? ??? ????????')) return
    const {error}=await supabase.from('insurance_fees').delete().eq('id',id)
    if (error){toast.error('?? ??');return}
    toast.success('???????.')
    const updated=insuranceFees.filter(f=>f.id!==id)
    setInsuranceFees(updated)
    if (detailIns){
      const freshGroup=updated.filter(f=>insGroupKey(f)===detailIns.key)
      if (freshGroup.length===0) setDetailIns(null)
      else setDetailIns(g=>g?{...g,items:freshGroup}:null)
    }
  }
  const deleteInsGroup = async (g: InsuranceFeeGroup) => {
    if (!confirm('??/?? ??? ??? ????????')) return
    const {error}=await supabase.from('insurance_fees').delete().in('id',g.items.map(i=>i.id))
    if (error){toast.error('?? ??');return}
    toast.success('???????.');setDetailIns(null);fetchData()
  }

  const feeGroupKey  = (f: FeeWithRider) => [f.fee_type,f.item_name,f.amount,f.date_mode,f.week_start??'',f.deadline_date??''].join('||')
  const insGroupKey  = (f: InsuranceFeeWithRider) => [f.employment_fee,f.accident_fee,f.date_mode,f.week_start??'',f.deadline_date??''].join('||')

  const handleAddRidersToFee = async (g: FeeGroup) => {
    if (feeAddIds.length === 0) { toast.error('??? ???? ??????.'); return }
    setDetailSaving(true)
    const existing = new Set(g.items.map(i => i.rider_id).filter(Boolean))
    const newIds = feeAddIds.filter(id => !existing.has(id))
    if (newIds.length === 0) { toast.error('??? ???? ?? ?? ?? ????.'); setDetailSaving(false); return }
    const rows = newIds.map(rid => ({ fee_type: g.fee_type, item_name: g.item_name, rider_id: rid, amount: g.amount, date_mode: g.date_mode, week_start: g.week_start, deadline_date: g.deadline_date, memo: g.memo, ...(userId?{user_id:userId}:{}) }))
    const { error } = await supabase.from('management_fees').insert(rows)
    if (error) { toast.error('?? ??: ' + error.message); setDetailSaving(false); return }
    toast.success(`??? ${newIds.length}? ???????.`)
    setFeeAddIds([]); setFeeDetailTab('info'); setDetailSaving(false); fetchData()
  }

  const handleEditFeeGroup = async (g: FeeGroup) => {
    if (!feeEditForm.item_name.trim()) { toast.error('???? ??????.'); return }
    const amount = parseInt(feeEditForm.amount.replace(/,/g,''))
    if (isNaN(amount) || amount <= 0) { toast.error('??? ??? ??????.'); return }
    if (feeEditForm.date_mode === 'deadline' && !feeEditForm.deadline_date) { toast.error('???? ??????.'); return }
    setDetailSaving(true)
    const updates = { item_name: feeEditForm.item_name.trim(), amount, date_mode: feeEditForm.date_mode, week_start: feeEditForm.date_mode==='week'?feeEditForm.week_start:null, deadline_date: feeEditForm.date_mode==='deadline'?feeEditForm.deadline_date:null, memo: feeEditForm.memo.trim()||null }
    const { error } = await supabase.from('management_fees').update(updates).in('id', g.items.map(i => i.id))
    if (error) { toast.error('?? ??: ' + error.message); setDetailSaving(false); return }
    toast.success('???????.')
    setFeeDetailTab('info'); setDetailSaving(false); setDetailFee(null); fetchData()
  }

  const handleAddRidersToIns = async (g: InsuranceFeeGroup) => {
    if (insAddIds.length === 0) { toast.error('??? ???? ??????.'); return }
    setDetailSaving(true)
    const existing = new Set(g.items.map(i => i.rider_id).filter(Boolean))
    const newIds = insAddIds.filter(id => !existing.has(id))
    if (newIds.length === 0) { toast.error('??? ???? ?? ?? ?? ????.'); setDetailSaving(false); return }
    const rows = newIds.map(rid => ({ rider_id: rid, employment_fee: g.employment_fee, accident_fee: g.accident_fee, date_mode: g.date_mode, week_start: g.week_start, deadline_date: g.deadline_date, memo: g.memo, ...(userId?{user_id:userId}:{}) }))
    const { error } = await supabase.from('insurance_fees').insert(rows)
    if (error) { toast.error('?? ??: ' + error.message); setDetailSaving(false); return }
    toast.success(`??? ${newIds.length}? ???????.`)
    setInsAddIds([]); setInsDetailTab('info'); setDetailSaving(false); fetchData()
  }

  const handleEditInsGroup = async (g: InsuranceFeeGroup) => {
    const empFee = parseInt(insEditForm.employment_fee.replace(/,/g,''))
    const accFee = parseInt(insEditForm.accident_fee.replace(/,/g,''))
    if ((isNaN(empFee)||empFee<0) && (isNaN(accFee)||accFee<0)) { toast.error('???? ??????.'); return }
    if (insEditForm.date_mode === 'deadline' && !insEditForm.deadline_date) { toast.error('???? ??????.'); return }
    setDetailSaving(true)
    const updates = { employment_fee: isNaN(empFee)?0:empFee, accident_fee: isNaN(accFee)?0:accFee, date_mode: insEditForm.date_mode, week_start: insEditForm.date_mode==='week'?insEditForm.week_start:null, deadline_date: insEditForm.date_mode==='deadline'?insEditForm.deadline_date:null, memo: insEditForm.memo.trim()||null }
    const { error } = await supabase.from('insurance_fees').update(updates).in('id', g.items.map(i => i.id))
    if (error) { toast.error('?? ??: ' + error.message); setDetailSaving(false); return }
    toast.success('???????.')
    setInsDetailTab('info'); setDetailSaving(false); setDetailIns(null); fetchData()
  }

  const riderSummary = (items: Array<{riders: Rider|null}>) => {
    const named=items.filter(i=>i.riders?.name).map(i=>i.riders!.name).sort((a,b)=>a.localeCompare(b,'ko'))
    if (named.length===0) return '?? ???'
    if (named.length<=3) return named.join(', ')
    return `${named.slice(0,3).join(', ')} ? ${named.length-3}?`
  }

  return (
    <div className="p-4 md:p-6 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">??? ??</h2>
          <p className="text-slate-400 text-sm mt-1">??? ?????? ???? ??? ?? ??</p>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button onClick={()=>{setGeneralForm(initGeneral());setDialogType('general')}} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2"/>??? ?? ??
          </Button>
          <Button onClick={()=>{setCallForm(initCall());setDialogType('call')}} className="bg-orange-600 hover:bg-orange-700 text-white">
            <Plus className="h-4 w-4 mr-2"/>???? ?? ??
          </Button>
          <Button onClick={()=>{setInsuranceForm(initInsurance());setDialogType('insurance')}} className="bg-emerald-600 hover:bg-emerald-700 text-white">
            <Plus className="h-4 w-4 mr-2"/>??/?? ??? ?? ??
          </Button>
        </div>
      </div>

      {/* ??? ?? */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4 w-4 text-blue-400"/>
          <h3 className="text-white font-semibold">??? ??</h3>
          <span className="text-slate-500 text-sm">({feeGroups.length}?)</span>
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm py-8 text-center">?? ?...</p>
        ) : feeGroups.length===0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 border border-slate-700/50 rounded-xl border-dashed">
            <Wrench className="h-12 w-12 mb-3 opacity-20"/>
            <p>??? ??? ??? ????.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {feeGroups.map(g=>(
              <Card key={g.key} onClick={()=>{ setFeeDetailTab('info'); setFeeAddIds([]); setFeeEditForm({ item_name: g.item_name, amount: String(g.amount), date_mode: g.date_mode as 'none'|'week'|'deadline', week_start: g.week_start??weekOptions[0]?.value??'', deadline_date: g.deadline_date??'', memo: g.memo??'' }); setDetailFee(g) }}
                className="border-slate-700 bg-slate-900 hover:bg-slate-800 hover:border-blue-700/50 cursor-pointer transition-all group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      {g.fee_type==='call'
                        ?<Phone className="h-4 w-4 text-orange-400 shrink-0"/>
                        :<Wrench className="h-4 w-4 text-blue-400 shrink-0"/>}
                      <h4 className="text-white font-semibold text-sm truncate">{g.item_name}</h4>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors"/>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {g.fee_type==='call'
                      ?<Badge className="text-xs bg-orange-900/50 text-orange-300 border border-orange-700/50">????</Badge>
                      :<Badge className="text-xs bg-blue-900/50 text-blue-300 border border-blue-700/50">???</Badge>}
                    {g.date_mode==='none'&&(
                      <Badge className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/40 flex items-center gap-1">
                        <RefreshCw className="h-2.5 w-2.5"/>??
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-10 shrink-0">??</span>
                      <span className={`font-medium ${g.fee_type==='call'?'text-orange-300':'text-rose-300'}`}>
                        {formatKRW(g.amount)}{g.fee_type==='call'&&<span className="text-slate-500 ml-1">/?</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-10 shrink-0">??</span>
                      <span className="text-slate-300 truncate">{periodText(g.date_mode,g.week_start,g.deadline_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-10 shrink-0">???</span>
                      <span className="text-slate-300 truncate">{riderSummary(g.items)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                    <span className="text-slate-600 text-xs">{g.created_at.split('T')[0]}</span>
                    <button type="button" onClick={e=>{e.stopPropagation();deleteFeeGroup(g)}}
                      className="text-slate-600 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-900/20">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ??/?? ??? ?? */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-emerald-400"/>
          <h3 className="text-white font-semibold">??/?? ???</h3>
          <span className="text-slate-500 text-sm">({insGroups.length}?)</span>
        </div>
        {loading ? (
          <p className="text-slate-500 text-sm py-8 text-center">?? ?...</p>
        ) : insGroups.length===0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500 border border-slate-700/50 rounded-xl border-dashed">
            <ShieldCheck className="h-12 w-12 mb-3 opacity-20"/>
            <p>??? ??/?? ???? ????.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {insGroups.map(g=>(
              <Card key={g.key} onClick={()=>{ setInsDetailTab('info'); setInsAddIds([]); setInsEditForm({ employment_fee: String(g.employment_fee), accident_fee: String(g.accident_fee), date_mode: g.date_mode as 'none'|'week'|'deadline', week_start: g.week_start??weekOptions[0]?.value??'', deadline_date: g.deadline_date??'', memo: g.memo??'' }); setDetailIns(g) }}
                className="border-emerald-700/30 bg-slate-900 hover:bg-slate-800 hover:border-emerald-600/50 cursor-pointer transition-all group">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0"/>
                      <h4 className="text-white font-semibold text-sm">??/???? ??</h4>
                    </div>
                    <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 shrink-0 transition-colors"/>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge className="text-xs bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">??/??</Badge>
                    {g.date_mode==='none'&&(
                      <Badge className="text-xs bg-emerald-900/30 text-emerald-400 border border-emerald-700/40 flex items-center gap-1">
                        <RefreshCw className="h-2.5 w-2.5"/>??
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-14 shrink-0">????</span>
                      <span className="text-blue-300 font-medium">{formatKRW(g.employment_fee)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-14 shrink-0">????</span>
                      <span className="text-violet-300 font-medium">{formatKRW(g.accident_fee)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-14 shrink-0">??</span>
                      <span className="text-slate-300 truncate">{periodText(g.date_mode,g.week_start,g.deadline_date)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-500 w-14 shrink-0">???</span>
                      <span className="text-slate-300 truncate">{riderSummary(g.items)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                    <span className="text-slate-600 text-xs">{g.created_at.split('T')[0]}</span>
                    <button type="button" onClick={e=>{e.stopPropagation();deleteInsGroup(g)}}
                      className="text-slate-600 hover:text-rose-400 transition-colors p-1 rounded hover:bg-rose-900/20">
                      <Trash2 className="h-3.5 w-3.5"/>
                    </button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {/* ??? ?? ????? */}
      <Dialog open={!!detailFee} onOpenChange={()=>setDetailFee(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          {detailFee&&(()=>{
            const g=detailFee
            const namedItems=g.items.filter(i=>i.riders?.name).sort((a,b)=>a.riders!.name.localeCompare(b.riders!.name,'ko'))
            const unnamedItems=g.items.filter(i=>!i.riders?.name)
            const alreadyIds = new Set(g.items.map(i=>i.rider_id).filter(Boolean))
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    {g.fee_type==='call'?<Phone className="h-4 w-4 text-orange-400"/>:<Wrench className="h-4 w-4 text-blue-400"/>}
                    {g.item_name}
                  </DialogTitle>
                </DialogHeader>
                <div className="flex gap-0 border-b border-slate-700 mb-2">
                  {([['info','?? ??'],['add','??? ??'],['edit','?? ??']] as const).map(([tab,label])=>(
                    <button key={tab} type="button" onClick={()=>setFeeDetailTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${feeDetailTab===tab?'border-blue-500 text-blue-400':'border-transparent text-slate-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {feeDetailTab==='info'&&(
                  <div className="space-y-5 py-2">
                    <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">??? ??</p>
                      <FeeInfoRow label="??" value={g.fee_type==='call'?<Badge className="text-xs bg-orange-900/50 text-orange-300 border border-orange-700/50">????</Badge>:<Badge className="text-xs bg-blue-900/50 text-blue-300 border border-blue-700/50">???</Badge>} />
                      <FeeInfoRow label="??" value={<span className={`font-medium text-sm ${g.fee_type==='call'?'text-orange-300':'text-rose-300'}`}>{formatKRW(g.amount)}{g.fee_type==='call'&&<span className="text-slate-500 ml-1">/?</span>}</span>} />
                      <FeeInfoRow label="??" value={g.date_mode==='none'?<span className="flex items-center gap-1 text-emerald-400 text-sm"><RefreshCw className="h-3.5 w-3.5"/>?? ??</span>:<span className="text-slate-300 text-sm">{periodText(g.date_mode,g.week_start,g.deadline_date)}</span>} />
                      {g.memo&&<FeeInfoRow label="??" value={<span className="text-slate-400 text-sm">{g.memo}</span>} />}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">?? ???</p>
                        <span className="text-slate-500 text-xs">{g.items.length}?</span>
                      </div>
                      {unnamedItems.length>0&&(
                        <div className="flex items-center justify-between px-3 py-2.5 bg-emerald-900/20 border border-emerald-700/40 rounded-lg mb-2">
                          <span className="text-emerald-300 text-sm font-medium">?? ??? ??</span>
                          {unnamedItems.map(i=>(<button key={i.id} type="button" onClick={()=>deleteFeeOne(i.id)} className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-900/20"><Trash2 className="h-3.5 w-3.5"/></button>))}
                        </div>
                      )}
                      {namedItems.length>0&&(
                        <div className="space-y-1.5 max-h-52 overflow-y-auto">
                          {namedItems.map(i=>(
                            <div key={i.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                              <div className="flex items-center gap-2"><UserCircle className="h-4 w-4 text-slate-500"/><span className="text-white text-sm font-medium">{i.riders!.name}</span>{i.riders!.rider_username&&<span className="text-slate-500 text-xs">@{i.riders!.rider_username}</span>}</div>
                              <button type="button" onClick={()=>deleteFeeOne(i.id)} className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-900/20"><Trash2 className="h-3.5 w-3.5"/></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {feeDetailTab==='add'&&(
                  <div className="space-y-4 py-2">
                    <p className="text-slate-400 text-sm">? ???? ??? ??? ???? ?????.</p>
                    <RiderMultiSelect riders={riders.filter(r=>!alreadyIds.has(r.id))} selected={feeAddIds} onChange={setFeeAddIds}/>
                    <Button onClick={()=>handleAddRidersToFee(g)} disabled={detailSaving||feeAddIds.length===0} className="w-full bg-blue-600 hover:bg-blue-700">
                      {detailSaving?'?? ?...':`??? ${feeAddIds.length}? ??`}
                    </Button>
                  </div>
                )}
                {feeDetailTab==='edit'&&(
                  <div className="space-y-4 py-2">
                    {g.fee_type==='general'&&(
                      <div className="space-y-1.5">
                        <Label className="text-slate-300">??? ???</Label>
                        <input value={feeEditForm.item_name} onChange={e=>setFeeEditForm(f=>({...f,item_name:e.target.value}))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500"/>
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">{g.fee_type==='call'?'?? ??':'??'}</Label>
                      <input type="number" value={feeEditForm.amount} onChange={e=>setFeeEditForm(f=>({...f,amount:e.target.value}))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500"/>
                    </div>
                    <PeriodSelector dateMode={feeEditForm.date_mode} weekStart={feeEditForm.week_start} deadlineDate={feeEditForm.deadline_date} onChange={p=>setFeeEditForm(f=>({...f,...p}))}/>
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">??</Label>
                      <textarea value={feeEditForm.memo} onChange={e=>setFeeEditForm(f=>({...f,memo:e.target.value}))} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white resize-none focus:outline-none focus:border-blue-500"/>
                    </div>
                    <Button onClick={()=>handleEditFeeGroup(g)} disabled={detailSaving} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      {detailSaving?'?? ?...':'?? ??'}
                    </Button>
                  </div>
                )}
                <DialogFooter className="border-t border-slate-700 pt-4 flex justify-between">
                  <Button variant="ghost" onClick={()=>deleteFeeGroup(g)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20"><Trash2 className="h-4 w-4 mr-2"/>?? ??</Button>
                  <Button variant="ghost" onClick={()=>setDetailFee(null)} className="text-slate-400 hover:text-white">??</Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ??/?? ?? ????? */}
      <Dialog open={!!detailIns} onOpenChange={()=>setDetailIns(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          {detailIns&&(()=>{
            const g=detailIns
            const alreadyIds = new Set(g.items.map(i=>i.rider_id).filter(Boolean))
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-400"/>??/???? ?? ???
                  </DialogTitle>
                </DialogHeader>
                <div className="flex gap-0 border-b border-slate-700 mb-2">
                  {([['info','?? ??'],['add','??? ??'],['edit','?? ??']] as const).map(([tab,label])=>(
                    <button key={tab} type="button" onClick={()=>setInsDetailTab(tab)}
                      className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${insDetailTab===tab?'border-emerald-500 text-emerald-400':'border-transparent text-slate-400 hover:text-white'}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {insDetailTab==='info'&&(
                  <div className="space-y-5 py-2">
                    <div className="bg-slate-800/60 rounded-xl p-4 space-y-2">
                      <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide mb-3">??? ??</p>
                      <FeeInfoRow label="????" value={<span className="text-blue-300 font-medium text-sm">{formatKRW(g.employment_fee)}</span>} />
                      <FeeInfoRow label="????" value={<span className="text-violet-300 font-medium text-sm">{formatKRW(g.accident_fee)}</span>} />
                      <FeeInfoRow label="??" value={g.date_mode==='none'?<span className="flex items-center gap-1 text-emerald-400 text-sm"><RefreshCw className="h-3.5 w-3.5"/>?? ??</span>:<span className="text-slate-300 text-sm">{periodText(g.date_mode,g.week_start,g.deadline_date)}</span>} />
                      {g.memo&&<FeeInfoRow label="??" value={<span className="text-slate-400 text-sm">{g.memo}</span>} />}
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">?? ???</p>
                        <span className="text-slate-500 text-xs">{g.items.length}?</span>
                      </div>
                      <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {[...g.items].sort((a,b)=>(a.riders?.name??'').localeCompare(b.riders?.name??'','ko')).map(i=>(
                          <div key={i.id} className="flex items-center justify-between px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg">
                            <div className="flex items-center gap-2"><UserCircle className="h-4 w-4 text-slate-500"/><span className="text-white text-sm font-medium">{i.riders?.name??'-'}</span>{i.riders?.rider_username&&<span className="text-slate-500 text-xs">@{i.riders.rider_username}</span>}</div>
                            <button type="button" onClick={()=>deleteInsOne(i.id)} className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-900/20"><Trash2 className="h-3.5 w-3.5"/></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {insDetailTab==='add'&&(
                  <div className="space-y-4 py-2">
                    <p className="text-slate-400 text-sm">? ??/?? ???? ??? ??? ???? ?????.</p>
                    <RiderMultiSelect riders={riders.filter(r=>!alreadyIds.has(r.id))} selected={insAddIds} onChange={setInsAddIds}/>
                    <Button onClick={()=>handleAddRidersToIns(g)} disabled={detailSaving||insAddIds.length===0} className="w-full bg-blue-600 hover:bg-blue-700">
                      {detailSaving?'?? ?...':`??? ${insAddIds.length}? ??`}
                    </Button>
                  </div>
                )}
                {insDetailTab==='edit'&&(
                  <div className="space-y-4 py-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-slate-300">?????</Label>
                        <input type="number" value={insEditForm.employment_fee} onChange={e=>setInsEditForm(f=>({...f,employment_fee:e.target.value}))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500"/>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-slate-300">?????</Label>
                        <input type="number" value={insEditForm.accident_fee} onChange={e=>setInsEditForm(f=>({...f,accident_fee:e.target.value}))} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white focus:outline-none focus:border-blue-500"/>
                      </div>
                    </div>
                    <PeriodSelector dateMode={insEditForm.date_mode} weekStart={insEditForm.week_start} deadlineDate={insEditForm.deadline_date} onChange={p=>setInsEditForm(f=>({...f,...p}))}/>
                    <div className="space-y-1.5">
                      <Label className="text-slate-300">??</Label>
                      <textarea value={insEditForm.memo} onChange={e=>setInsEditForm(f=>({...f,memo:e.target.value}))} rows={2} className="w-full px-3 py-2 bg-slate-800 border border-slate-600 rounded-md text-sm text-white resize-none focus:outline-none focus:border-blue-500"/>
                    </div>
                    <Button onClick={()=>handleEditInsGroup(g)} disabled={detailSaving} className="w-full bg-emerald-600 hover:bg-emerald-700">
                      {detailSaving?'?? ?...':'?? ??'}
                    </Button>
                  </div>
                )}
                <DialogFooter className="border-t border-slate-700 pt-4 flex justify-between">
                  <Button variant="ghost" onClick={()=>deleteInsGroup(g)} className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20"><Trash2 className="h-4 w-4 mr-2"/>?? ??</Button>
                  <Button variant="ghost" onClick={()=>setDetailIns(null)} className="text-slate-400 hover:text-white">??</Button>
                </DialogFooter>
              </>
            )
          })()}
        </DialogContent>
      </Dialog>

      {/* ??? ?? ????? */}
      <Dialog open={dialogType==='general'} onOpenChange={open=>{if(!open)setDialogType(null)}}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Wrench className="h-5 w-5 text-blue-400"/>??? ?? ??</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-slate-300">??? ?? <span className="text-red-400">*</span></Label>
              <Input value={generalForm.item_name} onChange={e=>setGF({item_name:e.target.value})} placeholder="?: ?? ??, ?? ???, ?? ???..." className="bg-slate-800 border-slate-600 text-white"/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">??? ?? <span className="text-slate-500 text-xs">(??? ? ?? ??)</span></Label>
              <RiderMultiSelect riders={riders} selected={generalForm.rider_ids} onChange={ids=>setGF({rider_ids:ids})}/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">??? ?? <span className="text-red-400">*</span></Label>
              <div className="relative">
                <Input type="number" value={generalForm.amount} onChange={e=>setGF({amount:e.target.value})} placeholder="?: 50000" className="bg-slate-800 border-slate-600 text-white pr-8"/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">?</span>
              </div>
            </div>
            <PeriodSelector dateMode={generalForm.date_mode} weekStart={generalForm.week_start} deadlineDate={generalForm.deadline_date} onChange={p=>setGF(p as Partial<typeof generalForm>)}/>
            <div className="space-y-1.5">
              <Label className="text-slate-300">??</Label>
              <Textarea value={generalForm.memo} onChange={e=>setGF({memo:e.target.value})} placeholder="??? ??..." rows={2} className="bg-slate-800 border-slate-600 text-white resize-none"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setDialogType(null)} className="text-slate-400 hover:text-white">??</Button>
            <Button onClick={handleSaveGeneral} disabled={saving} className="bg-blue-600 hover:bg-blue-700">{saving?'?? ?...':'??'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ???? ?? ????? */}
      <Dialog open={dialogType==='call'} onOpenChange={open=>{if(!open)setDialogType(null)}}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><Phone className="h-5 w-5 text-orange-400"/>???? ?? ??</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-orange-900/20 border border-orange-700/40 rounded-md px-3 py-2">
              <p className="text-orange-300 text-xs">???? = <span className="font-bold">?? ?? × ?? ???? ? ????</span>? ?? ?????.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">??? ?? <span className="text-slate-500 text-xs">(??? ? ?? ??)</span></Label>
              <RiderMultiSelect riders={riders} selected={callForm.rider_ids} onChange={ids=>setCF({rider_ids:ids})}/>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">?? ??? <span className="text-red-400">*</span></Label>
              <div className="relative">
                <Input type="number" value={callForm.amount_per_call} onChange={e=>setCF({amount_per_call:e.target.value})} placeholder="?: 100" className="bg-slate-800 border-slate-600 text-white pr-16"/>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">?/?</span>
              </div>
              {callForm.amount_per_call&&!isNaN(parseInt(callForm.amount_per_call))&&(
                <p className="text-slate-500 text-xs">?: ?? 200??? ???? {formatKRW(parseInt(callForm.amount_per_call)*200)}</p>
              )}
            </div>
            <PeriodSelector dateMode={callForm.date_mode} weekStart={callForm.week_start} deadlineDate={callForm.deadline_date} onChange={p=>setCF(p as Partial<typeof callForm>)}/>
            <div className="space-y-1.5">
              <Label className="text-slate-300">??</Label>
              <Textarea value={callForm.memo} onChange={e=>setCF({memo:e.target.value})} placeholder="??? ??..." rows={2} className="bg-slate-800 border-slate-600 text-white resize-none"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setDialogType(null)} className="text-slate-400 hover:text-white">??</Button>
            <Button onClick={handleSaveCall} disabled={saving} className="bg-orange-600 hover:bg-orange-700">{saving?'?? ?...':'??'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ??/?? ??? ?? ????? */}
      <Dialog open={dialogType==='insurance'} onOpenChange={open=>{if(!open)setDialogType(null)}}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle className="text-white flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-emerald-400"/>??/?? ??? ?? ??</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-md px-3 py-2">
              <p className="text-emerald-300 text-xs">??? ???????????? ?? ?? ???? <span className="font-bold">??</span>?? ?????. ??? ?????? ?????.</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">??? ?? <span className="text-red-400">*</span></Label>
              <RiderMultiSelect riders={riders} selected={insuranceForm.rider_ids} onChange={ids=>setIF({rider_ids:ids})}/>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">?????</Label>
                <div className="relative">
                  <Input type="number" value={insuranceForm.employment_fee} onChange={e=>setIF({employment_fee:e.target.value})} placeholder="0" className="bg-slate-800 border-slate-600 text-white pr-8"/>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">?</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">?????</Label>
                <div className="relative">
                  <Input type="number" value={insuranceForm.accident_fee} onChange={e=>setIF({accident_fee:e.target.value})} placeholder="0" className="bg-slate-800 border-slate-600 text-white pr-8"/>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">?</span>
                </div>
              </div>
            </div>
            <PeriodSelector dateMode={insuranceForm.date_mode} weekStart={insuranceForm.week_start} deadlineDate={insuranceForm.deadline_date} onChange={p=>setIF(p as Partial<typeof insuranceForm>)}/>
            <div className="space-y-1.5">
              <Label className="text-slate-300">??</Label>
              <Textarea value={insuranceForm.memo} onChange={e=>setIF({memo:e.target.value})} placeholder="??..." rows={2} className="bg-slate-800 border-slate-600 text-white resize-none"/>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={()=>setDialogType(null)} className="text-slate-400 hover:text-white">??</Button>
            <Button onClick={handleSaveInsurance} disabled={saving} className="bg-emerald-600 hover:bg-emerald-700">{saving?'?? ?...':'??'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FeeInfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1 border-b border-slate-700/40 last:border-0">
      <span className="text-slate-500 text-sm w-16 shrink-0">{label}</span>
      <span className="flex-1 text-right">{value}</span>
    </div>
  )
}
