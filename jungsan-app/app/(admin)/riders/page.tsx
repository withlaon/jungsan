'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { useRiders } from '@/hooks/useRiders'
import { Rider } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Plus, UserX, UserCheck, Search, Users, FileSpreadsheet, Upload, Download, AlertTriangle, CheckCircle, Loader2, Trash2, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface BulkRiderRow {
  join_date: string
  name: string
  rider_username: string
  id_number: string
  phone: string
  bank_name: string
  bank_account: string
  account_holder: string
  valid: boolean
  error: string
}

function downloadRiderList(riders: Rider[], label: string) {
  const wb = XLSX.utils.book_new()
  const header = ['媛?낆씪', '?쇱씠?붾챸', '?꾩씠??, '二쇰??깅줉踰덊샇', '?곕씫泥?, '??됰챸', '怨꾩쥖踰덊샇', '?덇툑二?, '?곹깭']
  const rows = riders.map(r => [
    r.join_date ?? '',
    r.name,
    r.rider_username ?? '',
    r.id_number ?? '',
    r.phone ?? '',
    r.bank_name ?? '',
    r.bank_account ?? '',
    r.account_holder ?? '',
    r.status === 'active' ? '?쒖꽦' : '鍮꾪솢??,
  ])
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows])
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 18 },
    { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 12 }, { wch: 8 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, '?쇱씠?붾ぉ濡?)
  const today = new Date().toISOString().slice(0, 10)
  XLSX.writeFile(wb, `?쇱씠?붾ぉ濡?${label}_${today}.xlsx`)
}

function downloadSampleExcel() {
  const wb = XLSX.utils.book_new()
  const data = [
    ['媛?낆씪', '?쇱씠?붾챸*', '?꾩씠??, '二쇰??깅줉踰덊샇', '?곕씫泥?, '??됰챸', '怨꾩쥖踰덊샇', '?덇툑二쇰챸'],
    ['2026-01-01', '?띻만??, 'rider001', '900101-1234567', '010-1234-5678', '援?????, '123-456-7890123', '?띻만??],
    ['2026-01-15', '源泥좎닔', 'rider002', '850520-1234567', '010-9876-5432', '?좏븳???, '110-123-456789', '源泥좎닔'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(data)
  ws['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 18 },
    { wch: 16 }, { wch: 12 }, { wch: 18 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, ws, '?쇱씠?붾ぉ濡?)
  XLSX.writeFile(wb, '?쇱씠????됰벑濡??묒떇.xlsx')
}

const emptyForm = {
  join_date: '',
  name: '',
  rider_username: '',
  id_number: '',
  phone: '',
  bank_name: '',
  bank_account: '',
  account_holder: '',
  status: 'active' as 'active' | 'inactive',
}

export default function RidersPage() {
  const supabase = createClient()
  const { userId, isAdmin, loading: userLoading } = useUser()
  const { riders, loading, refresh: refreshRiders } = useRiders()
  const [search, setSearch] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingRider, setEditingRider] = useState<Rider | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | 'active' | 'inactive'>('all')
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [bulkRows, setBulkRows] = useState<BulkRiderRow[]>([])
  const [bulkDragging, setBulkDragging] = useState(false)
  const [bulkSaving, setBulkSaving] = useState(false)
  const [bulkFileName, setBulkFileName] = useState('')

  // ?좏깮 愿???곹깭
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [bulkActionConfirm, setBulkActionConfirm] = useState<'deactivate' | 'delete' | null>(null)
  const [bulkProcessing, setBulkProcessing] = useState(false)
  const [page, setPage] = useState(1)

  const PAGE_SIZE = 15

  const openCreate = () => {
    setEditingRider(null)
    setForm(emptyForm)
    setUsernameError('')
    setDialogOpen(true)
  }

  const openEdit = (rider: Rider) => {
    setEditingRider(rider)
    setForm({
      join_date: rider.join_date ?? '',
      name: rider.name,
      rider_username: rider.rider_username ?? '',
      id_number: rider.id_number ?? '',
      phone: rider.phone ?? '',
      bank_name: rider.bank_name ?? '',
      bank_account: rider.bank_account ?? '',
      account_holder: rider.account_holder ?? '',
      status: rider.status,
    })
    setUsernameError('')
    setDialogOpen(true)
  }

  const checkUsernamedup = (val: string, currentId?: string) => {
    if (!val.trim()) { setUsernameError(''); return }
    const dup = riders.some(r =>
      (r.rider_username ?? '').toLowerCase() === val.trim().toLowerCase() && r.id !== currentId
    )
    setUsernameError(dup ? '?대? ?ъ슜 以묒씤 ?꾩씠?붿엯?덈떎.' : '')
  }

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('?쇱씠?붾챸???낅젰?댁＜?몄슂.'); return }

    if (form.rider_username.trim()) {
      const dup = riders.some(
        r => (r.rider_username ?? '').toLowerCase() === form.rider_username.trim().toLowerCase()
          && r.id !== editingRider?.id
      )
      if (dup) { setUsernameError('?대? ?ъ슜 以묒씤 ?꾩씠?붿엯?덈떎.'); toast.error('?대? ?ъ슜 以묒씤 ?꾩씠?붿엯?덈떎.'); return }
    }
    if (usernameError) { toast.error('?꾩씠??以묐났???뺤씤?댁＜?몄슂.'); return }

    setSaving(true)
    try {
      const payload = {
        join_date: form.join_date || null,
        name: form.name.trim(),
        rider_username: form.rider_username.trim() || null,
        id_number: form.id_number.trim() || null,
        phone: form.phone.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_account: form.bank_account.trim() || null,
        account_holder: form.account_holder.trim() || null,
        status: form.status,
      }

      const res = await fetch('/api/admin/rider', {
        method: editingRider ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingRider ? { id: editingRider.id, ...payload } : payload),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) { toast.error(data?.error ?? '????ㅽ뙣'); return }

      toast.success(editingRider ? '?쇱씠???뺣낫媛 ?섏젙?섏뿀?듬땲??' : '?쇱씠?붽? ?깅줉?섏뿀?듬땲??')
      setDialogOpen(false)
      setSearch('')
      refreshRiders(true)
    } catch (e) {
      toast.error('????ㅽ뙣: ?ㅽ듃?뚰겕 ?ㅻ쪟媛 諛쒖깮?덉뒿?덈떎.')
    } finally {
      setSaving(false)
    }
  }

  const toggleStatus = async (rider: Rider) => {
    const newStatus = rider.status === 'active' ? 'inactive' : 'active'
    try {
      const res = await fetch('/api/admin/rider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: rider.id,
          join_date: rider.join_date ?? null,
          name: rider.name,
          rider_username: rider.rider_username ?? null,
          id_number: rider.id_number ?? null,
          phone: rider.phone ?? null,
          bank_name: rider.bank_name ?? null,
          bank_account: rider.bank_account ?? null,
          account_holder: rider.account_holder ?? null,
          status: newStatus,
        }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error('?곹깭 蹂寃??ㅽ뙣: ' + (d?.error ?? '')); return }
      toast.success(`${rider.name} ?쇱씠?붾? ${newStatus === 'active' ? '?쒖꽦?? : '鍮꾪솢?깊솕'}?덉뒿?덈떎.`)
      refreshRiders(true)
    } catch {
      toast.error('?곹깭 蹂寃??ㅽ뙣: ?ㅽ듃?뚰겕 ?ㅻ쪟')
    }
  }

  const deleteRider = async (rider: Rider) => {
    try {
      const res = await fetch('/api/admin/rider', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: rider.id }),
      })
      if (!res.ok) { const d = await res.json().catch(() => ({})); toast.error('??젣 ?ㅽ뙣: ' + (d?.error ?? '')); return }
      toast.success(`${rider.name} ?쇱씠?붽? ??젣?섏뿀?듬땲??`)
      setDeleteConfirmId(null)
      refreshRiders(true)
    } catch {
      toast.error('??젣 ?ㅽ뙣: ?ㅽ듃?뚰겕 ?ㅻ쪟')
    }
  }

  const parseBulkExcel = useCallback((file: File) => {
    setBulkFileName(file.name)
    const reader = new FileReader()
    reader.onload = (e) => {
      // cellDates: true ???묒? ?좎쭨 ?쇰젴踰덊샇瑜?JS Date 媛앹껜濡??먮룞 蹂??      const wb = XLSX.read(e.target?.result, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })
      const existingUsernames = new Set(riders.map(r => r.rider_username).filter(Boolean))

      const normalize = (s: string) => String(s ?? '').trim().replace(/[\s*]/g, '')

      // ?좎쭨 媛믪쓣 YYYY-MM-DD 臾몄옄?대줈 蹂??      const toDateStr = (val: unknown): string => {
        if (!val) return ''
        if (val instanceof Date) {
          // ?좏슚???좎쭨?몄? ?뺤씤
          if (isNaN(val.getTime())) return ''
          const y = val.getFullYear()
          const m = String(val.getMonth() + 1).padStart(2, '0')
          const d = String(val.getDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        }
        const str = String(val).trim()
        // ?レ옄 ?쇰젴踰덊샇媛 ?섏뼱??寃쎌슦 xlsx濡??щ???        if (/^\d{5}$/.test(str)) {
          const date = new Date(Math.round((Number(str) - 25569) * 86400 * 1000))
          const y = date.getUTCFullYear()
          const m = String(date.getUTCMonth() + 1).padStart(2, '0')
          const d = String(date.getUTCDate()).padStart(2, '0')
          return `${y}-${m}-${d}`
        }
        // ?대? ?좎쭨 ?뺤떇 臾몄옄??(YYYY-MM-DD, YYYY/MM/DD ??
        const clean = str.replace(/[./]/g, '-')
        if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) return clean
        return str
      }

      const parsed: BulkRiderRow[] = raw
        .map((row) => {
          const keys = Object.keys(row)
          const get = (candidates: string[]) => {
            const key = keys.find(k => candidates.some(c => normalize(k).includes(c)))
            return key ? String(row[key] ?? '').trim() : ''
          }
          const getRaw = (candidates: string[]) => {
            const key = keys.find(k => candidates.some(c => normalize(k).includes(c)))
            return key ? row[key] : ''
          }

          const join_date      = toDateStr(getRaw(['媛?낆씪', 'joindate', 'join']))
          const name           = get(['?쇱씠?붾챸', '?대쫫', '?깅챸', '湲곗궗紐?, 'name'])
          const rider_username = get(['?꾩씠??, '?쇱씠?붿븘?대뵒', 'userid', 'username', 'id'])
          const id_number      = get(['二쇰??깅줉踰덊샇', '二쇰?踰덊샇', '二쇰?', 'idnumber'])
          const phone          = get(['?곕씫泥?, '?꾪솕', '?대???, '?몃뱶??, 'phone'])
          const bank_name      = get(['??됰챸', '???, 'bank'])
          const bank_account   = get(['怨꾩쥖踰덊샇', '怨꾩쥖', 'account'])
          const account_holder = get(['?덇툑二쇰챸', '?덇툑二?, 'holder'])

          const baseError = !name ? '?쇱씠?붾챸 ?꾩닔' : ''
          return { join_date, name, rider_username, id_number, phone, bank_name, bank_account, account_holder, valid: !baseError, error: baseError }
        })
        .filter(r => r.name || r.phone)

      // ?꾩씠??以묐났 泥댄겕 (湲곗〈 DB + ?뚯씪 ??以묐났)
      const seenInFile = new Set<string>()
      const rows = parsed.map(row => {
        if (row.error) return row
        if (!row.rider_username) return row
        if (existingUsernames.has(row.rider_username)) {
          return { ...row, valid: false, error: '?꾩씠??以묐났(湲곗〈)' }
        }
        if (seenInFile.has(row.rider_username)) {
          return { ...row, valid: false, error: '?꾩씠??以묐났(?뚯씪??' }
        }
        seenInFile.add(row.rider_username)
        return row
      })

      setBulkRows(rows)
    }
    reader.readAsArrayBuffer(file)
  }, [riders])

  const handleBulkDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setBulkDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) parseBulkExcel(file)
  }, [parseBulkExcel])

  const handleBulkFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) parseBulkExcel(file)
    e.target.value = ''
  }

  const handleBulkSave = async () => {
    const validRows = bulkRows.filter(r => r.valid)
    if (validRows.length === 0) { toast.error('?깅줉 媛?ν븳 ?곗씠?곌? ?놁뒿?덈떎.'); return }
    setBulkSaving(true)

    try {
      const payload = validRows.map(r => ({
        join_date: r.join_date || null,
        name: r.name,
        rider_username: r.rider_username || null,
        id_number: r.id_number || null,
        phone: r.phone || null,
        bank_name: r.bank_name || null,
        bank_account: r.bank_account || null,
        account_holder: r.account_holder || null,
        status: 'active',
      }))

      const res = await fetch('/api/admin/riders-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ riders: payload }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        toast.error('????ㅽ뙣: ' + (data?.error ?? res.statusText))
        return
      }
      toast.success(`${validRows.length}紐낆쓽 ?쇱씠?붽? ?깅줉?섏뿀?듬땲??`)
      setBulkDialogOpen(false)
      setBulkRows([])
      setBulkFileName('')
      refreshRiders(true)
    } catch (e) {
      toast.error('????ㅽ뙣: ?ㅽ듃?뚰겕 ?ㅻ쪟')
    } finally {
      setBulkSaving(false)
    }
  }

  const activeCount = riders.filter(r => r.status === 'active').length
  const inactiveCount = riders.filter(r => r.status === 'inactive').length

  const tabFiltered = activeTab === 'all' ? riders
    : activeTab === 'active' ? riders.filter(r => r.status === 'active')
    : riders.filter(r => r.status === 'inactive')

  const filtered = tabFiltered.filter(r =>
    r.name.includes(search) || (r.phone ?? '').includes(search) || (r.rider_username ?? '').includes(search)
  )

  // ?대쫫???뺣젹 (?쒓뎅??濡쒖???
  const sorted = useMemo(
    () => [...filtered].sort((a, b) => a.name.localeCompare(b.name, 'ko')),
    [filtered]
  )

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE)

  const allSelected = paged.length > 0 && paged.every(r => selectedIds.has(r.id))
  const someSelected = paged.some(r => selectedIds.has(r.id))

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        paged.forEach(r => next.delete(r.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        paged.forEach(r => next.add(r.id))
        return next
      })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleBulkDeactivate = async () => {
    setBulkProcessing(true)
    const targets = filtered.filter(r => selectedIds.has(r.id) && r.status === 'active')
    await Promise.all(targets.map(r =>
      fetch('/api/admin/rider', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: r.id,
          join_date: r.join_date ?? null,
          name: r.name,
          rider_username: r.rider_username ?? null,
          id_number: r.id_number ?? null,
          phone: r.phone ?? null,
          bank_name: r.bank_name ?? null,
          bank_account: r.bank_account ?? null,
          account_holder: r.account_holder ?? null,
          status: 'inactive',
        }),
      })
    ))
    toast.success(`${targets.length}紐낆쓣 鍮꾪솢?깊솕?덉뒿?덈떎.`)
    setSelectedIds(new Set())
    setBulkActionConfirm(null)
    setBulkProcessing(false)
    refreshRiders()
  }

  const handleBulkDelete = async () => {
    setBulkProcessing(true)
    const ids = filtered.filter(r => selectedIds.has(r.id)).map(r => r.id)
    const results = await Promise.all(ids.map(id =>
      fetch('/api/admin/rider', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    ))
    const failCount = results.filter(r => !r.ok).length
    if (failCount > 0) toast.error(`${failCount}紐???젣 ?ㅽ뙣`)
    else toast.success(`${ids.length}紐낆쓣 ??젣?덉뒿?덈떎.`)
    setSelectedIds(new Set())
    setBulkActionConfirm(null)
    setBulkProcessing(false)
    refreshRiders()
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">?쇱씠??愿由?/h2>
          <p className="text-slate-400 text-sm mt-1">?쇱씠???깅줉, ?섏젙, 愿由?/p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={() => downloadRiderList(filtered, activeTab === 'all' ? '?꾩껜' : activeTab === 'active' ? '?쒖꽦' : '鍮꾪솢??)}
            variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800"
            disabled={filtered.length === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            紐⑸줉 ?ㅼ슫濡쒕뱶
          </Button>
          <Button
            onClick={() => { setBulkRows([]); setBulkFileName(''); setBulkDialogOpen(true) }}
            variant="outline"
            className="border-emerald-600 text-emerald-400 hover:bg-emerald-900/20"
          >
            <FileSpreadsheet className="h-4 w-4 mr-2" />
            ?묒? ??됰벑濡?          </Button>
          <Button onClick={openCreate} className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="h-4 w-4 mr-2" />
            ?쇱씠???깅줉
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card
          onClick={() => { setActiveTab('all'); setSelectedIds(new Set()); setPage(1) }}
          className={`border-slate-700 bg-slate-900 cursor-pointer transition-all ${activeTab === 'all' ? 'ring-2 ring-blue-500 bg-blue-900/10' : 'hover:bg-slate-800'}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <Users className="h-8 w-8 text-blue-400" />
            <div>
              <p className="text-slate-400 text-xs">?꾩껜 ?쇱씠??/p>
              <p className="text-white text-2xl font-bold">{riders.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          onClick={() => { setActiveTab('active'); setSelectedIds(new Set()); setPage(1) }}
          className={`border-slate-700 bg-slate-900 cursor-pointer transition-all ${activeTab === 'active' ? 'ring-2 ring-emerald-500 bg-emerald-900/10' : 'hover:bg-slate-800'}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <UserCheck className="h-8 w-8 text-emerald-400" />
            <div>
              <p className="text-slate-400 text-xs">?쒖꽦 ?쇱씠??/p>
              <p className="text-emerald-400 text-2xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card
          onClick={() => { setActiveTab('inactive'); setSelectedIds(new Set()); setPage(1) }}
          className={`border-slate-700 bg-slate-900 cursor-pointer transition-all ${activeTab === 'inactive' ? 'ring-2 ring-rose-500 bg-rose-900/10' : 'hover:bg-slate-800'}`}
        >
          <CardContent className="p-4 flex items-center gap-3">
            <UserX className="h-8 w-8 text-slate-500" />
            <div>
              <p className="text-slate-400 text-xs">鍮꾪솢???쇱씠??/p>
              <p className="text-slate-400 text-2xl font-bold">{inactiveCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
        <Input
          placeholder="?쇱씠?붾챸, ?꾩씠?? ?곕씫泥섎줈 寃??.."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-10 bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
        />
      </div>

      <Card className="border-slate-700 bg-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-white text-base">
              {activeTab === 'all' ? '?꾩껜' : activeTab === 'active' ? '?쒖꽦' : '鍮꾪솢??} ?쇱씠??紐⑸줉 ({sorted.length}紐?
            </CardTitle>
            {someSelected && (
              <div className="flex items-center gap-2">
                <span className="text-slate-400 text-sm">{selectedIds.size}紐??좏깮??/span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkActionConfirm('deactivate')}
                  className="border-amber-600 text-amber-400 hover:bg-amber-900/20 h-8 text-xs"
                >
                  <UserX className="h-3.5 w-3.5 mr-1" />
                  ?좏깮 鍮꾪솢?깊솕
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBulkActionConfirm('delete')}
                  className="border-rose-600 text-rose-400 hover:bg-rose-900/20 h-8 text-xs"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1" />
                  ?좏깮 ??젣
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setSelectedIds(new Set())}
                  className="text-slate-400 hover:text-white h-8 text-xs"
                >
                  ?좏깮 ?댁젣
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 hover:bg-transparent">
                  <TableHead className="w-10 px-4">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={el => { if (el) el.indeterminate = someSelected && !allSelected }}
                      onChange={toggleSelectAll}
                      className="w-4 h-4 accent-blue-500 cursor-pointer"
                    />
                  </TableHead>
                  <TableHead className="text-slate-400">媛?낆씪</TableHead>
                  <TableHead className="text-slate-400">?쇱씠?붾챸</TableHead>
                  <TableHead className="text-slate-400">?꾩씠??/TableHead>
                  <TableHead className="text-slate-400">二쇰?踰덊샇</TableHead>
                  <TableHead className="text-slate-400">?곕씫泥?/TableHead>
                  <TableHead className="text-slate-400">???/TableHead>
                  <TableHead className="text-slate-400">怨꾩쥖踰덊샇</TableHead>
                  <TableHead className="text-slate-400">?덇툑二?/TableHead>
                  <TableHead className="text-slate-400">?곹깭</TableHead>
                  <TableHead className="text-slate-400 text-right">愿由?/TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-slate-500 py-8">濡쒕뵫 以?..</TableCell>
                  </TableRow>
                ) : paged.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={11} className="text-center text-slate-500 py-8">?깅줉???쇱씠?붽? ?놁뒿?덈떎.</TableCell>
                  </TableRow>
                ) : (
                  paged.map(rider => (
                    <TableRow
                      key={rider.id}
                      className={`border-slate-700 hover:bg-slate-800/50 ${selectedIds.has(rider.id) ? 'bg-blue-900/10' : ''}`}
                    >
                      <TableCell className="px-4" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(rider.id)}
                          onChange={() => toggleSelect(rider.id)}
                          className="w-4 h-4 accent-blue-500 cursor-pointer"
                        />
                      </TableCell>
                      <TableCell className="text-slate-400 text-sm">{rider.join_date ?? '-'}</TableCell>
                      <TableCell
                        className="text-white font-medium cursor-pointer hover:text-blue-400 hover:underline"
                        onClick={() => openEdit(rider)}
                      >
                        {rider.name}
                      </TableCell>
                      <TableCell
                        className="text-slate-300 text-sm cursor-pointer hover:text-blue-400 hover:underline"
                        onClick={() => openEdit(rider)}
                      >
                        {rider.rider_username ?? '-'}
                      </TableCell>
                      <TableCell className="text-slate-300 font-mono text-sm">
                        {rider.id_number ? rider.id_number.substring(0, 6) + '-*******' : '-'}
                      </TableCell>
                      <TableCell className="text-slate-300 text-sm">{rider.phone ?? '-'}</TableCell>
                      <TableCell className="text-slate-300 text-sm">{rider.bank_name ?? '-'}</TableCell>
                      <TableCell className="text-slate-300 font-mono text-sm">{rider.bank_account ?? '-'}</TableCell>
                      <TableCell className="text-slate-300 text-sm">{rider.account_holder ?? '-'}</TableCell>
                      <TableCell>
                        <Badge className={rider.status === 'active' ? 'bg-emerald-700' : 'bg-slate-700'}>
                          {rider.status === 'active' ? '?쒖꽦' : '鍮꾪솢??}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => toggleStatus(rider)}
                            className={rider.status === 'active'
                              ? 'text-slate-400 hover:text-slate-300 hover:bg-slate-700 h-8 px-2'
                              : 'text-emerald-400 hover:text-emerald-300 hover:bg-emerald-900/20 h-8 px-2'}>
                            {rider.status === 'active'
                              ? <UserX className="h-3.5 w-3.5" />
                              : <UserCheck className="h-3.5 w-3.5" />}
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeleteConfirmId(rider.id)}
                            className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 h-8 px-2">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-700">
              <p className="text-slate-400 text-sm">
                {(safePage - 1) * PAGE_SIZE + 1}??Math.min(safePage * PAGE_SIZE, sorted.length)} / {sorted.length}紐?              </p>
              <div className="flex items-center gap-1">
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="text-slate-400 hover:text-white h-8 w-8 p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...')
                    acc.push(p)
                    return acc
                  }, [])
                  .map((p, i) =>
                    p === '...' ? (
                      <span key={`ellipsis-${i}`} className="text-slate-500 px-1 text-sm">??/span>
                    ) : (
                      <Button
                        key={p}
                        size="sm" variant="ghost"
                        onClick={() => setPage(p as number)}
                        className={`h-8 w-8 p-0 text-sm ${safePage === p ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-400 hover:text-white'}`}
                      >
                        {p}
                      </Button>
                    )
                  )}
                <Button
                  size="sm" variant="ghost"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="text-slate-400 hover:text-white h-8 w-8 p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 媛쒕퀎 ?깅줉/?섏젙 ?ㅼ씠?쇰줈洹?*/}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{editingRider ? '?쇱씠???섏젙' : '?쇱씠???깅줉'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">媛?낆씪</Label>
                <Input
                  type="date"
                  value={form.join_date}
                  onChange={e => setForm(f => ({ ...f, join_date: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">?쇱씠?붾챸 <span className="text-red-400">*</span></Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="?띻만??
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">?꾩씠??/Label>
                <Input
                  value={form.rider_username}
                  onChange={e => {
                    const val = e.target.value
                    setForm(f => ({ ...f, rider_username: val }))
                    checkUsernamedup(val, editingRider?.id)
                  }}
                  placeholder="rider001"
                  className={`bg-slate-800 border-slate-600 text-white ${usernameError ? 'border-rose-500' : ''}`}
                />
                {usernameError && (
                  <p className="text-rose-400 text-xs flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />{usernameError}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">二쇰??깅줉踰덊샇</Label>
                <Input
                  value={form.id_number}
                  onChange={e => setForm(f => ({ ...f, id_number: e.target.value }))}
                  placeholder="000000-0000000"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300">?곕씫泥?/Label>
              <Input
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="010-0000-0000"
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300">??됰챸</Label>
                <Input
                  value={form.bank_name}
                  onChange={e => setForm(f => ({ ...f, bank_name: e.target.value }))}
                  placeholder="援?????
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">怨꾩쥖踰덊샇</Label>
                <Input
                  value={form.bank_account}
                  onChange={e => setForm(f => ({ ...f, bank_account: e.target.value }))}
                  placeholder="123-456-789012"
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300">?덇툑二쇰챸</Label>
                <Input
                  value={form.account_holder}
                  onChange={e => setForm(f => ({ ...f, account_holder: e.target.value }))}
                  placeholder="?띻만??
                  className="bg-slate-800 border-slate-600 text-white"
                />
              </div>
            </div>
            {editingRider && (
              <div className="space-y-1.5">
                <Label className="text-slate-300">?곹깭</Label>
                <Select value={form.status} onValueChange={(v: 'active' | 'inactive') => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    <SelectItem value="active" className="text-white">?쒖꽦</SelectItem>
                    <SelectItem value="inactive" className="text-white">鍮꾪솢??/SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-slate-400 hover:text-white">痍⑥냼</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? '???以?..' : editingRider ? '?섏젙 ??? : '?깅줉'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ??젣 ?뺤씤 ?ㅼ씠?쇰줈洹?*/}
      <Dialog open={!!deleteConfirmId} onOpenChange={(open) => { if (!open) setDeleteConfirmId(null) }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-rose-400" />
              ?쇱씠????젣
            </DialogTitle>
          </DialogHeader>
          <div className="py-3">
            {deleteConfirmId && (() => {
              const target = riders.find(r => r.id === deleteConfirmId)
              return (
                <div className="space-y-3">
                  <p className="text-slate-300 text-sm">
                    <span className="text-white font-semibold">{target?.name}</span> ?쇱씠?붾? ?꾩쟾????젣?⑸땲??
                  </p>
                  <div className="bg-rose-900/20 border border-rose-800 rounded-lg p-3">
                    <p className="text-rose-300 text-xs flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                      ??젣???곗씠?곕뒗 蹂듦뎄?????놁뒿?덈떎.
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteConfirmId(null)} className="text-slate-400 hover:text-white">痍⑥냼</Button>
            <Button
              onClick={() => { const r = riders.find(x => x.id === deleteConfirmId); if (r) deleteRider(r) }}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              <Trash2 className="h-4 w-4 mr-2" />??젣
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ?쇨큵 鍮꾪솢?깊솕/??젣 ?뺤씤 ?ㅼ씠?쇰줈洹?*/}
      <Dialog open={bulkActionConfirm !== null} onOpenChange={open => { if (!open) setBulkActionConfirm(null) }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {bulkActionConfirm === 'deactivate' ? '?좏깮 ?쇱씠??鍮꾪솢?깊솕' : '?좏깮 ?쇱씠????젣'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {bulkActionConfirm === 'deactivate' ? (
              <>
                <p className="text-slate-300 text-sm">
                  ?좏깮??<span className="text-white font-semibold">{filtered.filter(r => selectedIds.has(r.id) && r.status === 'active').length}紐?/span>???쒖꽦 ?쇱씠?붾? 鍮꾪솢?깊솕?⑸땲??
                </p>
                <div className="bg-amber-900/20 border border-amber-800 rounded-lg p-3">
                  <p className="text-amber-300 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    ?대? 鍮꾪솢???곹깭???쇱씠?붾뒗 嫄대꼫?곷땲??
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-300 text-sm">
                  ?좏깮??<span className="text-white font-semibold">{filtered.filter(r => selectedIds.has(r.id)).length}紐?/span>???쇱씠?붾? ?꾩쟾????젣?⑸땲??
                </p>
                <div className="bg-rose-900/20 border border-rose-800 rounded-lg p-3">
                  <p className="text-rose-300 text-xs flex items-center gap-1.5">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                    ??젣???곗씠?곕뒗 蹂듦뎄?????놁뒿?덈떎. 愿???뺤궛 ?곗씠?곕룄 ?④퍡 ??젣?⑸땲??
                  </p>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setBulkActionConfirm(null)} className="text-slate-400 hover:text-white" disabled={bulkProcessing}>痍⑥냼</Button>
            <Button
              onClick={bulkActionConfirm === 'deactivate' ? handleBulkDeactivate : handleBulkDelete}
              disabled={bulkProcessing}
              className={bulkActionConfirm === 'deactivate' ? 'bg-amber-600 hover:bg-amber-700 text-white' : 'bg-rose-600 hover:bg-rose-700 text-white'}
            >
              {bulkProcessing ? '泥섎━ 以?..' : bulkActionConfirm === 'deactivate' ? (
                <><UserX className="h-4 w-4 mr-2" />鍮꾪솢?깊솕</>
              ) : (
                <><Trash2 className="h-4 w-4 mr-2" />??젣</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ?묒? ??됰벑濡??ㅼ씠?쇰줈洹?*/}
      <Dialog open={bulkDialogOpen} onOpenChange={(open) => { setBulkDialogOpen(open); if (!open) { setBulkRows([]); setBulkFileName('') } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
              ?쇱씠???묒? ??됰벑濡?            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-auto space-y-4 py-2">
            <div className="flex items-center justify-between bg-slate-800/60 rounded-lg p-3">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                <span>
                  <span className="font-bold text-white">?쇱씠?붾챸</span>? ?꾩닔?낅땲??
                  而щ읆 ?쒖꽌媛 ?щ씪???ㅻ뜑紐낆쑝濡??먮룞 ?몄떇?⑸땲??
                </span>
              </div>
              <Button size="sm" variant="outline" onClick={downloadSampleExcel}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 shrink-0 ml-3">
                <Download className="h-3.5 w-3.5 mr-1.5" />
                ?묒떇 ?ㅼ슫濡쒕뱶
              </Button>
            </div>

            {bulkRows.length === 0 ? (
              <div
                onDrop={handleBulkDrop}
                onDragOver={(e) => { e.preventDefault(); setBulkDragging(true) }}
                onDragLeave={() => setBulkDragging(false)}
                onClick={() => document.getElementById('bulk-file-input')?.click()}
                className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
                  ${bulkDragging ? 'border-emerald-500 bg-emerald-900/10' : 'border-slate-600 hover:border-slate-500 hover:bg-slate-800/50'}`}
              >
                <input id="bulk-file-input" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleBulkFileInput} />
                <Upload className="h-12 w-12 text-slate-500 mx-auto mb-3" />
                <p className="text-white font-medium mb-1">?묒? ?뚯씪???쒕옒洹명븯嫄곕굹 ?대┃?섏뿬 ?낅줈??/p>
                <p className="text-slate-400 text-sm">吏???뺤떇: .xlsx, .xls, .csv</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm">{bulkFileName}</span>
                    <Badge className="bg-emerald-800 text-emerald-300">
                      <CheckCircle className="h-3 w-3 mr-1" />?좏슚 {bulkRows.filter(r => r.valid).length}紐?                    </Badge>
                    {bulkRows.filter(r => !r.valid).length > 0 && (
                      <Badge className="bg-rose-800 text-rose-300">
                        <AlertTriangle className="h-3 w-3 mr-1" />?ㅻ쪟 {bulkRows.filter(r => !r.valid).length}??                      </Badge>
                    )}
                  </div>
                  <Button size="sm" variant="ghost"
                    onClick={() => { setBulkRows([]); setBulkFileName('') }}
                    className="text-slate-400 hover:text-white text-xs">
                    ?ㅼ떆 ?낅줈??                  </Button>
                </div>

                <div className="border border-slate-700 rounded-lg max-h-72 overflow-y-auto overflow-x-auto">
                  <div className="min-w-[900px]">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-slate-700 hover:bg-transparent">
                        <TableHead className="text-slate-400 w-8">#</TableHead>
                        <TableHead className="text-slate-400">媛?낆씪</TableHead>
                        <TableHead className="text-slate-400">?쇱씠?붾챸</TableHead>
                        <TableHead className="text-slate-400">?꾩씠??/TableHead>
                        <TableHead className="text-slate-400">二쇰??깅줉踰덊샇</TableHead>
                        <TableHead className="text-slate-400">?곕씫泥?/TableHead>
                        <TableHead className="text-slate-400">??됰챸</TableHead>
                        <TableHead className="text-slate-400">怨꾩쥖踰덊샇</TableHead>
                        <TableHead className="text-slate-400">?덇툑二쇰챸</TableHead>
                        <TableHead className="text-slate-400">?곹깭</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bulkRows.map((row, i) => (
                        <TableRow key={i} className={`border-slate-700 ${!row.valid ? 'bg-rose-900/10' : 'hover:bg-slate-800/50'}`}>
                          <TableCell className="text-slate-500 text-xs">{i + 1}</TableCell>
                          <TableCell className="text-slate-300 text-sm">{row.join_date || '-'}</TableCell>
                          <TableCell className={`font-medium ${row.valid ? 'text-white' : 'text-rose-400'}`}>
                            {row.name || <span className="text-slate-500 italic">鍮꾩뼱?덉쓬</span>}
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">{row.rider_username || '-'}</TableCell>
                          <TableCell className="text-slate-300 font-mono text-sm">
                            {row.id_number ? row.id_number.substring(0, 6) + '-*******' : '-'}
                          </TableCell>
                          <TableCell className="text-slate-300 text-sm">{row.phone || '-'}</TableCell>
                          <TableCell className="text-slate-300 text-sm">{row.bank_name || '-'}</TableCell>
                          <TableCell className="text-slate-300 font-mono text-sm">{row.bank_account || '-'}</TableCell>
                          <TableCell className="text-slate-300 text-sm">{row.account_holder || '-'}</TableCell>
                          <TableCell>
                            {row.valid
                              ? <Badge className="bg-emerald-900/40 text-emerald-300 text-xs">?뺤긽</Badge>
                              : <Badge className="bg-rose-900/40 text-rose-300 text-xs">{row.error}</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="border-t border-slate-700 pt-4">
            <Button variant="ghost" onClick={() => setBulkDialogOpen(false)} className="text-slate-400 hover:text-white">痍⑥냼</Button>
            {bulkRows.length > 0 && (
              <Button onClick={handleBulkSave} disabled={bulkSaving || bulkRows.filter(r => r.valid).length === 0}
                className="bg-emerald-600 hover:bg-emerald-700">
                {bulkSaving
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />???以?..</>
                  : <><CheckCircle className="h-4 w-4 mr-2" />{bulkRows.filter(r => r.valid).length}紐??깅줉</>}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}