'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@/hooks/useUser'
import { useRiders } from '@/hooks/useRiders'
import { formatSsn, type TaxReportMode } from '@/lib/tax-report/allocate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TaxReportChangeTab, type TaxReportSettingRow } from '@/app/(admin)/settlement/tax-report/change-tab'
import { TaxReportFileTab } from '@/app/(admin)/settlement/tax-report/file-tab'
import { toast } from 'sonner'

export default function TaxReportPage() {
  const { userId } = useUser()
  const { riders, loading: ridersLoading } = useRiders()
  const [settings, setSettings] = useState<TaxReportSettingRow[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    fetch('/api/tax-report/settings', { credentials: 'same-origin' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}))
        if (cancelled) return
        if (!res.ok) {
          toast.error(typeof data.error === 'string' ? data.error : '세금신고 설정을 불러오지 못했습니다.')
          return
        }
        setSettings(Array.isArray(data.settings) ? data.settings : [])
      })
      .catch(() => {
        if (!cancelled) toast.error('세금신고 설정을 불러오지 못했습니다.')
      })
    return () => { cancelled = true }
  }, [userId])

  const save = async (riderId: string, draft: { taxName: string; taxSsn: string; mode: TaxReportMode }) => {
    if (!userId) return false
    const taxName = draft.taxName.trim()
    const taxSsnDigits = draft.taxSsn.replace(/\D/g, '')
    if (draft.mode === 'report' && draft.taxSsn.trim() && taxSsnDigits.length !== 13) {
      toast.error('주민등록번호는 13자리여야 합니다.')
      return false
    }
    if (draft.mode === 'report' && !taxName && !draft.taxSsn.trim()) {
      return reset(riderId)
    }

    setSaving(true)
    const res = await fetch('/api/tax-report/settings', {
      method: 'PUT',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        rider_id: riderId,
        tax_name: draft.mode === 'report' ? taxName : null,
        tax_ssn: draft.mode === 'report' && taxSsnDigits ? formatSsn(taxSsnDigits) : null,
        mode: draft.mode,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(typeof data.error === 'string' ? data.error : '저장에 실패했습니다.')
      return false
    }
    setSettings((prev) => {
      const next = prev.filter((row) => row.rider_id !== riderId)
      if (data.setting) next.push(data.setting as TaxReportSettingRow)
      return next
    })
    toast.success('세금신고 설정을 저장했습니다.')
    return true
  }

  const reset = async (riderId: string) => {
    if (!userId) return false
    setSaving(true)
    const res = await fetch(`/api/tax-report/settings?rider_id=${encodeURIComponent(riderId)}`, {
      method: 'DELETE',
      credentials: 'same-origin',
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) {
      toast.error(typeof data.error === 'string' ? data.error : '되돌리기에 실패했습니다.')
      return false
    }
    setSettings((prev) => prev.filter((row) => row.rider_id !== riderId))
    toast.success('기본 신고로 되돌렸습니다.')
    return true
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-white text-xl font-bold">세무서신고</h1>
        <p className="text-slate-400 text-sm mt-1">
          신고월을 고르고 주간 정산 파일을 올리면 세무사 제출 양식으로 받습니다. 공급가액은 등록된 정산의 부가세 × 10입니다.
        </p>
      </div>

      <Tabs defaultValue="change">
        <TabsList className="bg-slate-800 h-10">
          <TabsTrigger value="change" className="px-4 data-[state=active]:bg-teal-600 data-[state=active]:text-white text-slate-300">
            세금신고변경
          </TabsTrigger>
          <TabsTrigger value="file" className="px-4 data-[state=active]:bg-teal-600 data-[state=active]:text-white text-slate-300">
            세무서 신고
          </TabsTrigger>
        </TabsList>
        <TabsContent value="change" className="mt-4">
          <TaxReportChangeTab
            riders={riders}
            ridersLoading={ridersLoading}
            settings={settings}
            saving={saving}
            onSave={save}
            onReset={reset}
          />
        </TabsContent>
        <TabsContent value="file" className="mt-4">
          <TaxReportFileTab riders={riders} settings={settings} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
