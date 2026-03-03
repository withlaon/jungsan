'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { SettlementDetail, Rider, WeeklySettlement } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Bike, CalendarDays, FileDown, AlertCircle } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { exportSingleRiderExcel } from '@/lib/excel/export'

type DetailWithSettlement = SettlementDetail & { weekly_settlements: WeeklySettlement }

export default function RiderPortalPage() {
  const params = useParams()
  const token = params.token as string
  const supabase = createClient()

  const [rider, setRider] = useState<Rider | null>(null)
  const [details, setDetails] = useState<DetailWithSettlement[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (token) loadRiderData()
  }, [token])

  const loadRiderData = async () => {
    setLoading(true)

    const { data: riderData } = await supabase
      .from('riders')
      .select('*')
      .eq('access_token', token)
      .single()

    if (!riderData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setRider(riderData)

    const { data: detailData } = await supabase
      .from('settlement_details')
      .select('*, weekly_settlements(*)')
      .eq('rider_id', riderData.id)
      .order('created_at', { ascending: false })

    if (detailData) {
      setDetails(detailData as DetailWithSettlement[])
      if (detailData.length > 0) setSelectedId(detailData[0].id)
    }

    setLoading(false)
  }

  const selectedDetail = details.find(d => d.id === selectedId)
  const currentSettlement = selectedDetail?.weekly_settlements

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400 text-lg animate-pulse">로딩 중...</div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-rose-400 mx-auto mb-4" />
          <h1 className="text-white text-2xl font-bold mb-2">접근 불가</h1>
          <p className="text-slate-400">유효하지 않은 링크입니다. 관리자에게 문의해주세요.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="max-w-lg mx-auto space-y-5 pt-6">
        {/* 헤더 */}
        <div className="flex items-center gap-3 mb-2">
          <div className="bg-blue-600 rounded-xl p-2.5">
            <Bike className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-xl">{rider?.name} 님</h1>
            <p className="text-slate-400 text-sm">개인 정산 내역 조회</p>
          </div>
        </div>

        {details.length === 0 ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-8 text-center">
              <CalendarDays className="h-12 w-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-400">아직 정산 내역이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="bg-slate-800/70 border-slate-600 text-white w-full">
                  <SelectValue placeholder="주차 선택" />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-600">
                  {details.map(d => (
                    <SelectItem key={d.id} value={d.id} className="text-white">
                      {d.weekly_settlements.week_start} ~ {d.weekly_settlements.week_end}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedDetail && currentSettlement && (
              <div className="space-y-4">
                <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-white text-base">정산서</CardTitle>
                      <div className="flex items-center gap-2">
                        <Badge className="text-xs bg-slate-700 text-slate-300">
                          {currentSettlement.week_start} ~ {currentSettlement.week_end}
                        </Badge>
                        {currentSettlement.status === 'confirmed' && (
                          <Badge className="text-xs bg-emerald-700 text-white">확정</Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {/* 배달건수 */}
                    <div className="flex justify-between py-1.5 border-b border-slate-700/40">
                      <span className="text-slate-400 text-sm">배달건수</span>
                      <span className="text-sm font-medium text-white">{selectedDetail.delivery_count}건</span>
                    </div>
                    {/* 기본정산금액 (배달료 + 추가지급 구분) */}
                    <div className="flex justify-between py-1.5 border-b border-slate-700/40">
                      <span className="text-slate-400 text-sm">기본 정산금액</span>
                      <span className="text-sm font-medium text-blue-400">{formatKRW(selectedDetail.base_amount)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-700/20 pl-4">
                      <span className="text-slate-500 text-xs">ㄴ 배달료</span>
                      <span className="text-slate-400 text-xs">{formatKRW(selectedDetail.delivery_fee ?? 0)}</span>
                    </div>
                    {(selectedDetail.additional_pay ?? 0) > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-700/20 pl-4">
                        <span className="text-slate-500 text-xs">ㄴ 추가지급</span>
                        <span className="text-slate-400 text-xs">{formatKRW(selectedDetail.additional_pay ?? 0)}</span>
                      </div>
                    )}
                    {selectedDetail.promotion_amount > 0 && (
                      <div className="flex justify-between py-1.5 border-b border-slate-700/40">
                        <span className="text-slate-400 text-sm">지사프로모션</span>
                        <span className="text-sm font-medium text-violet-400">+{formatKRW(selectedDetail.promotion_amount)}</span>
                      </div>
                    )}
                    <hr className="border-slate-700 my-2" />
                    {([
                      { label: '고용/산재보험', value: `-${formatKRW(selectedDetail.insurance_deduction)}`,           color: 'text-amber-400' },
                      { label: '소득세 (3.3%)', value: `-${formatKRW(selectedDetail.income_tax_deduction)}`,          color: 'text-rose-400' },
                      { label: '관리비',         value: `-${formatKRW(selectedDetail.management_fee_deduction)}`,     color: 'text-slate-400', skip: selectedDetail.management_fee_deduction === 0 },
                      { label: '선지급금 공제', value: `-${formatKRW(selectedDetail.advance_deduction)}`,             color: 'text-orange-400', skip: selectedDetail.advance_deduction === 0 },
                      { label: '선지급금 회수', value: `+${formatKRW(selectedDetail.advance_recovery ?? 0)}`,         color: 'text-teal-400',   skip: !(selectedDetail.advance_recovery && selectedDetail.advance_recovery > 0) },
                    ] as const).filter(item => !('skip' in item && item.skip)).map(item => (
                      <div key={item.label} className="flex justify-between py-1.5 border-b border-slate-700/40 last:border-0">
                        <span className="text-slate-400 text-sm">{item.label}</span>
                        <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                      </div>
                    ))}

                    <div className="mt-3 bg-emerald-900/30 rounded-xl p-4 flex justify-between items-center border border-emerald-700/30">
                      <span className="text-emerald-300 font-bold">최종 지급액</span>
                      <span className="text-emerald-400 text-2xl font-bold">{formatKRW(selectedDetail.final_amount)}</span>
                    </div>
                  </CardContent>
                </Card>

                {rider?.bank_name && rider?.bank_account && (
                  <Card className="border-slate-700 bg-slate-800/30">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-xs mb-2 font-medium">입금 계좌 정보</p>
                      <div className="flex gap-3">
                        <span className="text-slate-300 text-sm">{rider.bank_name}</span>
                        <span className="text-white text-sm font-mono">{rider.bank_account}</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Button
                  onClick={() => {
                    if (rider && currentSettlement) {
                      exportSingleRiderExcel(currentSettlement, {
                        ...selectedDetail,
                        riders: rider,
                      })
                    }
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <FileDown className="h-4 w-4 mr-2" />
                  정산서 엑셀 다운로드
                </Button>
              </div>
            )}

            {/* 최근 정산 이력 */}
            {details.length > 1 && (
              <Card className="border-slate-700 bg-slate-800/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-300 text-sm">정산 이력</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-700">
                    {details.map(d => (
                      <button
                        key={d.id}
                        onClick={() => setSelectedId(d.id)}
                        className={`w-full flex justify-between items-center p-3 text-sm hover:bg-slate-700/30 transition-colors
                          ${d.id === selectedId ? 'bg-slate-700/40' : ''}`}
                      >
                        <span className="text-slate-300">
                          {d.weekly_settlements.week_start} ~ {d.weekly_settlements.week_end}
                        </span>
                        <span className="text-emerald-400 font-bold">{formatKRW(d.final_amount)}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <p className="text-center text-slate-600 text-xs pb-4">라이더 정산 시스템</p>
      </div>
    </div>
  )
}
