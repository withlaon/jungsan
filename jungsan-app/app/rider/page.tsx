'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Rider, SettlementDetail, WeeklySettlement } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bike, Shield, AlertCircle, CalendarDays, FileDown, LogOut, Loader2 } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { exportSingleRiderExcel } from '@/lib/excel/export'

type DetailWithSettlement = SettlementDetail & { weekly_settlements: WeeklySettlement }

type Step = 'login' | 'portal'

// 주민등록번호 정규화 (하이픈·공백 제거, 숫자만)
function normalizeIdNumber(idNumber: string) {
  return idNumber.replace(/[-\s]/g, '').replace(/\D/g, '')
}

export default function RiderPortalPage() {
  const supabase = createClient()

  const [step, setStep] = useState<Step>('login')
  const [idNumber, setIdNumber] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)
  const [loginError, setLoginError] = useState('')

  const [rider, setRider] = useState<Rider | null>(null)
  const [details, setDetails] = useState<DetailWithSettlement[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [dataLoading, setDataLoading] = useState(false)

  const handleLogin = async () => {
    const trimmed = idNumber.trim()
    if (!trimmed) { setLoginError('주민등록번호를 입력해주세요.'); return }

    setLoginLoading(true)
    setLoginError('')

    // 입력값과 DB 저장값 모두 정규화해서 비교 (숫자 13자리)
    const normalized = normalizeIdNumber(trimmed)
    if (normalized.length !== 13) {
      setLoginError('주민등록번호 13자리를 입력해주세요.')
      setLoginLoading(false)
      return
    }

    // 하이픈 있는 형식 (6-7)
    const formatted = normalized.replace(/^(\d{6})(\d{7})$/, '$1-$2')

    const { data: riderData } = await supabase
      .from('riders')
      .select('*')
      .or(`id_number.eq.${trimmed},id_number.eq.${normalized},id_number.eq.${formatted}`)
      .eq('status', 'active')
      .maybeSingle()

    if (!riderData) {
      setLoginError('일치하는 라이더 정보가 없습니다. 주민등록번호를 다시 확인해주세요.')
      setLoginLoading(false)
      return
    }

    setRider(riderData)
    setLoginLoading(false)
    setDataLoading(true)
    setStep('portal')

    const { data: detailData } = await supabase
      .from('settlement_details')
      .select('*, weekly_settlements(*)')
      .eq('rider_id', riderData.id)
      .order('created_at', { ascending: false })

    if (detailData && detailData.length > 0) {
      setDetails(detailData as DetailWithSettlement[])
      setSelectedId(detailData[0].id)
    }
    setDataLoading(false)
  }

  const handleLogout = () => {
    setStep('login')
    setIdNumber('')
    setRider(null)
    setDetails([])
    setSelectedId('')
    setLoginError('')
  }

  const selectedDetail = details.find(d => d.id === selectedId)
  const currentSettlement = selectedDetail?.weekly_settlements

  // ── 로그인 화면 ──
  if (step === 'login') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-sm space-y-6">
          {/* 로고 */}
          <div className="text-center space-y-2">
            <div className="bg-blue-600 rounded-2xl p-4 w-16 h-16 flex items-center justify-center mx-auto">
              <Bike className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-white text-2xl font-bold">라이더 정산 조회</h1>
            <p className="text-slate-400 text-sm">주민등록번호로 내 정산 내역을 확인하세요</p>
          </div>

          {/* 로그인 카드 */}
          <Card className="border-slate-700 bg-slate-900/80 backdrop-blur">
            <CardContent className="p-6 space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-300 flex items-center gap-1.5">
                  <Shield className="h-3.5 w-3.5" />주민등록번호
                </Label>
                <Input
                  type="password"
                  inputMode="numeric"
                  value={idNumber}
                  onChange={e => { setIdNumber(e.target.value); setLoginError('') }}
                  onKeyDown={e => { if (e.key === 'Enter') handleLogin() }}
                  placeholder="000000-0000000"
                  maxLength={14}
                  className="bg-slate-800 border-slate-600 text-white text-center text-lg tracking-widest placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal h-12"
                  autoFocus
                />
                {loginError && (
                  <div className="flex items-center gap-1.5 text-rose-400 text-sm">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    {loginError}
                  </div>
                )}
              </div>
              <Button
                onClick={handleLogin}
                disabled={loginLoading}
                className="w-full h-12 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold"
              >
                {loginLoading
                  ? <><Loader2 className="h-4 w-4 animate-spin mr-2" />확인 중...</>
                  : '정산 내역 조회'}
              </Button>
            </CardContent>
          </Card>

          <p className="text-center text-slate-600 text-xs">등록된 주민등록번호로만 조회 가능합니다</p>
        </div>
      </div>
    )
  }

  // ── 정산 조회 화면 ──
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 p-4">
      <div className="max-w-lg mx-auto space-y-5 pt-4 pb-8">
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 rounded-xl p-2.5">
              <Bike className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-white font-bold text-lg">{rider?.name} 님</h1>
              <p className="text-slate-400 text-xs">정산 내역 조회</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={handleLogout}
            className="text-slate-400 hover:text-white hover:bg-slate-700 text-xs">
            <LogOut className="h-3.5 w-3.5 mr-1" />로그아웃
          </Button>
        </div>

        {dataLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-blue-400 animate-spin" />
          </div>
        ) : details.length === 0 ? (
          <Card className="border-slate-700 bg-slate-800/50">
            <CardContent className="p-10 text-center">
              <CalendarDays className="h-12 w-12 text-slate-500 mx-auto mb-3" />
              <p className="text-slate-300 font-medium mb-1">정산 내역이 없습니다</p>
              <p className="text-slate-500 text-sm">아직 처리된 정산이 없습니다.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* 주차 선택 */}
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger className="bg-slate-800/70 border-slate-600 text-white flex-1">
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
                {/* 정산서 */}
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
                  <CardContent className="space-y-1">
                    {([
                      { label: '배달건수', value: `${selectedDetail.delivery_count}건`, color: 'text-white' },
                      { label: '기본 정산금액', value: formatKRW(selectedDetail.base_amount), color: 'text-blue-400' },
                      { label: '프로모션', value: `+${formatKRW(selectedDetail.promotion_amount)}`, color: 'text-violet-400' },
                      null,
                      { label: '고용/산재보험', value: `-${formatKRW(selectedDetail.insurance_deduction + (selectedDetail.employment_insurance_addition ?? 0) + (selectedDetail.accident_insurance_addition ?? 0))}`, color: 'text-amber-400' },
                      { label: '소득세 (3.3%)', value: `-${formatKRW(selectedDetail.income_tax_deduction)}`, color: 'text-rose-400' },
                      { label: '일반관리비', value: `-${formatKRW(selectedDetail.management_fee_deduction)}`, color: 'text-blue-400' },
                      { label: '콜관리비', value: `-${formatKRW(selectedDetail.call_fee_deduction ?? 0)}`, color: 'text-orange-400' },
                      { label: '선지급금 공제', value: `-${formatKRW(selectedDetail.advance_deduction)}`, color: 'text-amber-300' },
                    ] as (null | { label: string; value: string; color: string })[]).map((item, i) =>
                      item === null ? (
                        <hr key={i} className="border-slate-700 my-2" />
                      ) : (
                        <div key={item.label} className="flex justify-between py-1.5 border-b border-slate-700/40 last:border-0">
                          <span className="text-slate-400 text-sm">{item.label}</span>
                          <span className={`text-sm font-medium ${item.color}`}>{item.value}</span>
                        </div>
                      )
                    )}
                    <div className="mt-3 bg-emerald-900/30 rounded-xl p-4 flex justify-between items-center border border-emerald-700/30">
                      <span className="text-emerald-300 font-bold">최종 지급액</span>
                      <span className="text-emerald-400 text-2xl font-bold">{formatKRW(selectedDetail.final_amount)}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* 계좌 정보 */}
                {rider?.bank_name && rider?.bank_account && (
                  <Card className="border-slate-700 bg-slate-800/30">
                    <CardContent className="p-4">
                      <p className="text-slate-400 text-xs mb-2 font-medium">입금 계좌 정보</p>
                      <div className="flex gap-3 items-center">
                        <span className="text-slate-300 text-sm">{rider.bank_name}</span>
                        <span className="text-white text-sm font-mono">{rider.bank_account}</span>
                        {rider.account_holder && (
                          <span className="text-slate-400 text-xs">({rider.account_holder})</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* 엑셀 다운로드 */}
                <Button
                  onClick={() => {
                    if (rider && currentSettlement) {
                      exportSingleRiderExcel(currentSettlement, { ...selectedDetail, riders: rider })
                    }
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-700"
                >
                  <FileDown className="h-4 w-4 mr-2" />정산서 엑셀 다운로드
                </Button>
              </div>
            )}

            {/* 정산 이력 */}
            {details.length > 1 && (
              <Card className="border-slate-700 bg-slate-800/30">
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-300 text-sm">정산 이력 ({details.length}건)</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-700">
                    {details.map(d => (
                      <button key={d.id} onClick={() => setSelectedId(d.id)}
                        className={`w-full flex justify-between items-center p-3 text-sm hover:bg-slate-700/30 transition-colors ${d.id === selectedId ? 'bg-slate-700/40' : ''}`}>
                        <span className="text-slate-300 text-xs">
                          {d.weekly_settlements.week_start} ~ {d.weekly_settlements.week_end}
                        </span>
                        <span className="text-emerald-400 font-bold text-sm">{formatKRW(d.final_amount)}</span>
                      </button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}

        <p className="text-center text-slate-600 text-xs">라이더 정산 시스템</p>
      </div>
    </div>
  )
}
