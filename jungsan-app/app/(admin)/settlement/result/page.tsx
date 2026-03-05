'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useUser } from '@/hooks/useUser'
import { WeeklySettlement, SettlementDetail, Rider } from '@/types'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { FileText, Download, Trash2, CheckCircle, Eye, FileDown, CalendarDays, Printer } from 'lucide-react'
import { formatKRW } from '@/lib/utils'
import { exportSettlementExcel, exportSingleRiderExcel } from '@/lib/excel/export'
import { toast } from 'sonner'

type DetailWithRider = SettlementDetail & { riders: Rider }

export default function SettlementResultPage() {
  const supabase = createClient()
  const { userId, isAdmin, loading: userLoading } = useUser()
  const [settlements, setSettlements] = useState<WeeklySettlement[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [details, setDetails] = useState<DetailWithRider[]>([])
  const [loading, setLoading] = useState(true)
  const [previewDetail, setPreviewDetail] = useState<DetailWithRider | null>(null)
  const [currentSettlement, setCurrentSettlement] = useState<WeeklySettlement | null>(null)

  useEffect(() => {
    if (!userLoading && (isAdmin || userId)) fetchSettlements()
  }, [userLoading, userId, isAdmin])
  useEffect(() => {
    if (selectedId) {
      fetchDetails(selectedId)
      setCurrentSettlement(settlements.find(s => s.id === selectedId) ?? null)
    }
  }, [selectedId])

  const fetchSettlements = async () => {
    if (!userId && !isAdmin) return
    setLoading(true)
    let q = supabase.from('weekly_settlements').select('*').order('week_start', { ascending: false })
    if (!isAdmin && userId) q = q.eq('user_id', userId)
    const { data } = await q
    if (data) {
      setSettlements(data)
      if (data.length > 0) setSelectedId(data[0].id)
    }
    setLoading(false)
  }

  const fetchDetails = async (settlementId: string) => {
    const { data } = await supabase
      .from('settlement_details')
      .select('*, riders(*)')
      .eq('settlement_id', settlementId)
      .order('final_amount', { ascending: false })
    if (data) setDetails(data as DetailWithRider[])
  }

  const handleConfirm = async (id: string) => {
    const { error } = await supabase
      .from('weekly_settlements')
      .update({ status: 'confirmed', updated_at: new Date().toISOString() })
      .eq('id', id)
    if (error) { toast.error('확정 실패'); return }
    toast.success('정산이 확정되었습니다.')
    fetchSettlements()
  }

  const handleDelete = async (id: string) => {
    if (!confirm('이 정산을 삭제하시겠습니까? 관련 데이터가 모두 삭제됩니다.')) return
    try {
      const res = await fetch(`/api/admin/settlement?id=${id}`, {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error('삭제 실패: ' + (data?.error ?? res.statusText))
        return
      }
      toast.success('정산이 삭제되었습니다.')
      setDetails([])
      setSelectedId('')
      setCurrentSettlement(null)
      fetchSettlements()
    } catch {
      toast.error('삭제 실패: 네트워크 오류')
    }
  }

  const handleExportAll = () => {
    if (!currentSettlement || details.length === 0) return
    exportSettlementExcel(currentSettlement, details)
    toast.success('전체 정산 엑셀이 다운로드되었습니다.')
  }

  const handleExportSingle = (detail: DetailWithRider) => {
    if (!currentSettlement) return
    exportSingleRiderExcel(currentSettlement, detail)
    toast.success(`${detail.riders?.name} 정산서가 다운로드되었습니다.`)
  }

  const handlePrint = () => { window.print() }

  // ── 파생 계산 헬퍼 ──
  const totalEmp  = (d: DetailWithRider) => (d.excel_employment_insurance ?? 0) + (d.employment_insurance_addition ?? 0)
  const totalAcc  = (d: DetailWithRider) => (d.excel_accident_insurance   ?? 0) + (d.accident_insurance_addition   ?? 0)
  const taxBase   = (d: DetailWithRider) => d.tax_base_amount ?? (d.base_amount + d.promotion_amount - (d.hourly_insurance ?? 0) - totalEmp(d) - totalAcc(d) - (d.call_fee_deduction ?? 0))
  const incomeTax = (d: DetailWithRider) => d.income_tax_deduction

  const summary = {
    total_base:       details.reduce((s, d) => s + d.base_amount, 0),
    total_delivery:   details.reduce((s, d) => s + (d.delivery_fee ?? 0), 0),
    total_add:        details.reduce((s, d) => s + (d.additional_pay ?? 0), 0),
    total_hourly:     details.reduce((s, d) => s + (d.hourly_insurance ?? 0), 0),
    total_emp:        details.reduce((s, d) => s + totalEmp(d), 0),
    total_acc:        details.reduce((s, d) => s + totalAcc(d), 0),
    total_promo:      details.reduce((s, d) => s + d.promotion_amount, 0),
    total_call:       details.reduce((s, d) => s + (d.call_fee_deduction ?? 0), 0),
    total_tax_base:   details.reduce((s, d) => s + taxBase(d), 0),
    total_income_tax: details.reduce((s, d) => s + incomeTax(d), 0),
    total_advance:    details.reduce((s, d) => s + d.advance_deduction, 0),
    total_recovery:   details.reduce((s, d) => s + (d.advance_recovery ?? 0), 0),
    total_final:      details.reduce((s, d) => s + d.final_amount, 0),
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">정산결과보기</h2>
          <p className="text-slate-400 text-sm mt-1">주차별 정산 결과 조회 및 다운로드</p>
        </div>
        <div className="flex gap-2">
          {currentSettlement?.status === 'draft' && (
            <Button onClick={() => handleConfirm(selectedId)} className="bg-emerald-600 hover:bg-emerald-700">
              <CheckCircle className="h-4 w-4 mr-2" />정산 확정
            </Button>
          )}
          <Button onClick={handleExportAll} variant="outline"
            className="border-blue-600 text-blue-400 hover:bg-blue-900/20" disabled={details.length === 0}>
            <Download className="h-4 w-4 mr-2" />전체 엑셀 다운로드
          </Button>
          <Button onClick={handlePrint} variant="outline"
            className="border-slate-600 text-slate-300 hover:bg-slate-800" disabled={details.length === 0}>
            <Printer className="h-4 w-4 mr-2" />인쇄
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <CalendarDays className="h-5 w-5 text-slate-400" />
        <Select value={selectedId} onValueChange={setSelectedId}>
          <SelectTrigger className="w-72 bg-slate-800 border-slate-600 text-white">
            <SelectValue placeholder="주차 선택" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-600">
            {settlements.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-white">
                {s.week_start} ~ {s.week_end}{s.status === 'confirmed' && ' ✓'}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {currentSettlement && (
          <>
            <Badge className={currentSettlement.status === 'confirmed' ? 'bg-emerald-700' : 'bg-amber-700'}>
              {currentSettlement.status === 'confirmed' ? '확정' : '임시저장'}
            </Badge>
            <Button size="sm" variant="ghost" onClick={() => handleDelete(selectedId)}
              className="text-rose-400 hover:text-rose-300 hover:bg-rose-900/20 h-8">
              <Trash2 className="h-4 w-4 mr-1" />삭제
            </Button>
          </>
        )}
      </div>

      {loading ? null : settlements.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-slate-500">
          <FileText className="h-16 w-16 mb-4 opacity-30" />
          <p className="text-lg">저장된 정산 결과가 없습니다.</p>
          <p className="text-sm mt-1">정산파일 등록 탭에서 엑셀 파일을 업로드해 주세요.</p>
        </div>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className="grid grid-cols-4 gap-3">
            <Card className="border-slate-700 bg-slate-900">
              <CardContent className="p-4">
                <p className="text-slate-400 text-xs">총 기본정산금액</p>
                <p className="text-blue-400 font-bold text-lg">{formatKRW(summary.total_base)}</p>
              </CardContent>
            </Card>
            <Card className="border-violet-700/40 bg-violet-900/10">
              <CardContent className="p-4">
                <p className="text-slate-400 text-xs">총 세금신고금액</p>
                <p className="text-violet-400 font-bold text-lg">{formatKRW(summary.total_tax_base)}</p>
              </CardContent>
            </Card>
            <Card className="border-rose-900/30 bg-rose-900/10">
              <CardContent className="p-4">
                <p className="text-slate-400 text-xs">총 소득세</p>
                <p className="text-rose-400 font-bold text-lg">-{formatKRW(summary.total_income_tax)}</p>
              </CardContent>
            </Card>
            <Card className="border-emerald-900/30 bg-emerald-900/10">
              <CardContent className="p-4">
                <p className="text-slate-400 text-xs">총 최종정산금액</p>
                <p className="text-emerald-400 font-bold text-lg">{formatKRW(summary.total_final)}</p>
              </CardContent>
            </Card>
          </div>

          {/* 라이더별 정산 내역 테이블 */}
          <Card className="border-slate-700 bg-slate-900 print:shadow-none">
            <CardHeader>
              <CardTitle className="text-white text-base">
                라이더별 정산 내역 ({details.length}명)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-slate-700 hover:bg-transparent">
                      <TableHead className="text-slate-400 whitespace-nowrap">라이더명</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">배달건수</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">기본정산금액</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap text-xs opacity-70">ㄴ배달료</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap text-xs opacity-70">ㄴ추가지급</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">시간제보험료</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">고용보험</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">산재보험</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">지사프로모션</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">콜관리비</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">세금신고금액</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">소득세(3.6%)</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">선지급금</TableHead>
                      <TableHead className="text-slate-400 text-right whitespace-nowrap">선지급금회수</TableHead>
                      <TableHead className="text-slate-400 text-right font-bold whitespace-nowrap">최종정산금액</TableHead>
                      <TableHead className="text-slate-400 print:hidden whitespace-nowrap">관리</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {details.map(d => (
                      <TableRow key={d.id} className="border-slate-700 hover:bg-slate-800/50">
                        <TableCell className="text-white font-medium whitespace-nowrap">{d.riders?.name}</TableCell>
                        <TableCell className="text-slate-300 text-right whitespace-nowrap">{d.delivery_count.toLocaleString()}</TableCell>
                        <TableCell className="text-blue-400 text-right whitespace-nowrap font-medium">{formatKRW(d.base_amount)}</TableCell>
                        <TableCell className="text-slate-400 text-right whitespace-nowrap text-xs">{formatKRW(d.delivery_fee ?? 0)}</TableCell>
                        <TableCell className="text-slate-400 text-right whitespace-nowrap text-xs">{formatKRW(d.additional_pay ?? 0)}</TableCell>
                        <TableCell className="text-amber-400 text-right whitespace-nowrap">{(d.hourly_insurance ?? 0) > 0 ? `-${formatKRW(d.hourly_insurance ?? 0)}` : '-'}</TableCell>
                        <TableCell className="text-cyan-400 text-right whitespace-nowrap">{totalEmp(d) > 0 ? `-${formatKRW(totalEmp(d))}` : '-'}</TableCell>
                        <TableCell className="text-purple-400 text-right whitespace-nowrap">{totalAcc(d) > 0 ? `-${formatKRW(totalAcc(d))}` : '-'}</TableCell>
                        <TableCell className="text-violet-400 text-right whitespace-nowrap">{d.promotion_amount > 0 ? `+${formatKRW(d.promotion_amount)}` : '-'}</TableCell>
                        <TableCell className="text-orange-400 text-right whitespace-nowrap">{(d.call_fee_deduction ?? 0) > 0 ? `-${formatKRW(d.call_fee_deduction ?? 0)}` : '-'}</TableCell>
                        <TableCell className="text-emerald-400 text-right font-medium whitespace-nowrap">{formatKRW(taxBase(d))}</TableCell>
                        <TableCell className="text-rose-400 text-right whitespace-nowrap">-{formatKRW(incomeTax(d))}</TableCell>
                        <TableCell className="text-amber-300 text-right whitespace-nowrap">{d.advance_deduction > 0 ? `-${formatKRW(d.advance_deduction)}` : '-'}</TableCell>
                        <TableCell className="text-teal-400 text-right whitespace-nowrap">{(d.advance_recovery ?? 0) > 0 ? `+${formatKRW(d.advance_recovery ?? 0)}` : '-'}</TableCell>
                        <TableCell className="text-emerald-400 font-bold text-right whitespace-nowrap">{formatKRW(d.final_amount)}</TableCell>
                        <TableCell className="print:hidden whitespace-nowrap">
                          <div className="flex justify-end gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setPreviewDetail(d)}
                              className="text-slate-400 hover:text-white h-7 px-2"><Eye className="h-3.5 w-3.5" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleExportSingle(d)}
                              className="text-blue-400 hover:text-blue-300 h-7 px-2"><FileDown className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* 합계 행 */}
                    <TableRow className="border-slate-700 bg-slate-800/30 font-bold">
                      <TableCell className="text-white">합계</TableCell>
                      <TableCell className="text-slate-300 text-right">{details.reduce((s, d) => s + d.delivery_count, 0).toLocaleString()}</TableCell>
                      <TableCell className="text-blue-400 text-right">{formatKRW(summary.total_base)}</TableCell>
                      <TableCell className="text-slate-400 text-right text-xs">{formatKRW(summary.total_delivery)}</TableCell>
                      <TableCell className="text-slate-400 text-right text-xs">{formatKRW(summary.total_add)}</TableCell>
                      <TableCell className="text-amber-400 text-right">{summary.total_hourly > 0 ? `-${formatKRW(summary.total_hourly)}` : '-'}</TableCell>
                      <TableCell className="text-cyan-400 text-right">{summary.total_emp > 0 ? `-${formatKRW(summary.total_emp)}` : '-'}</TableCell>
                      <TableCell className="text-purple-400 text-right">{summary.total_acc > 0 ? `-${formatKRW(summary.total_acc)}` : '-'}</TableCell>
                      <TableCell className="text-violet-400 text-right">{summary.total_promo > 0 ? `+${formatKRW(summary.total_promo)}` : '-'}</TableCell>
                      <TableCell className="text-orange-400 text-right">{summary.total_call > 0 ? `-${formatKRW(summary.total_call)}` : '-'}</TableCell>
                      <TableCell className="text-emerald-400 text-right">{formatKRW(summary.total_tax_base)}</TableCell>
                      <TableCell className="text-rose-400 text-right">-{formatKRW(summary.total_income_tax)}</TableCell>
                      <TableCell className="text-amber-300 text-right">{summary.total_advance > 0 ? `-${formatKRW(summary.total_advance)}` : '-'}</TableCell>
                      <TableCell className="text-teal-400 text-right">{summary.total_recovery > 0 ? `+${formatKRW(summary.total_recovery)}` : '-'}</TableCell>
                      <TableCell className="text-emerald-400 text-right">{formatKRW(summary.total_final)}</TableCell>
                      <TableCell className="print:hidden" />
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* 라이더별 정산서 미리보기 */}
      <Dialog open={!!previewDetail} onOpenChange={() => setPreviewDetail(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white">{previewDetail?.riders?.name} 정산서</DialogTitle>
          </DialogHeader>
          {previewDetail && currentSettlement && (() => {
            const d = previewDetail
            const empTotal = totalEmp(d)
            const accTotal = totalAcc(d)
            const tb = taxBase(d)
            const it = incomeTax(d)
            const rec = d.advance_recovery ?? 0
            return (
              <div className="space-y-3">
                <div className="text-sm text-slate-400">
                  정산 기간: {currentSettlement.week_start} ~ {currentSettlement.week_end}
                </div>
                <div className="space-y-1.5">
                  {/* 배달건수 */}
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400 text-sm">배달건수</span>
                    <span className="font-medium text-sm text-white">{d.delivery_count}건</span>
                  </div>
                  {/* 기본정산금액 (배달료 + 추가지급 구분) */}
                  <div className="flex justify-between py-1.5 border-b border-slate-700/50">
                    <span className="text-slate-400 text-sm">기본정산금액</span>
                    <span className="font-medium text-sm text-blue-400">{formatKRW(d.base_amount)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-700/30 pl-4">
                    <span className="text-slate-500 text-xs">ㄴ 배달료</span>
                    <span className="text-slate-400 text-xs">{formatKRW(d.delivery_fee ?? 0)}</span>
                  </div>
                  {(d.additional_pay ?? 0) > 0 && (
                    <div className="flex justify-between py-1 border-b border-slate-700/30 pl-4">
                      <span className="text-slate-500 text-xs">ㄴ 추가지급</span>
                      <span className="text-slate-400 text-xs">{formatKRW(d.additional_pay ?? 0)}</span>
                    </div>
                  )}
                  {[
                    { label: '시간제보험료',     value: `-${formatKRW(d.hourly_insurance ?? 0)}`, color: 'text-amber-400', skip: !d.hourly_insurance },
                    { label: '고용보험',         value: `-${formatKRW(empTotal)}`,         color: 'text-cyan-400',   skip: empTotal === 0 },
                    { label: '산재보험',         value: `-${formatKRW(accTotal)}`,         color: 'text-purple-400', skip: accTotal === 0 },
                    { label: '지사프로모션',     value: `+${formatKRW(d.promotion_amount)}`,color:'text-violet-400',skip: d.promotion_amount === 0 },
                    { label: '콜관리비',         value: `-${formatKRW(d.call_fee_deduction ?? 0)}`, color: 'text-orange-400', skip: !d.call_fee_deduction },
                    { label: '세금신고금액',     value: formatKRW(tb),                    color: 'text-emerald-400' },
                    { label: '소득세 (3.6%)',    value: `-${formatKRW(it)}`,               color: 'text-rose-400' },
                    { label: '선지급금 공제',    value: `-${formatKRW(d.advance_deduction)}`, color: 'text-amber-300', skip: d.advance_deduction === 0 },
                    { label: '선지급금회수',     value: `+${formatKRW(rec)}`,              color: 'text-teal-400',   skip: rec === 0 },
                  ].filter(item => !item.skip).map(item => (
                    <div key={item.label} className="flex justify-between py-1.5 border-b border-slate-700/50">
                      <span className="text-slate-400 text-sm">{item.label}</span>
                      <span className={`font-medium text-sm ${item.color}`}>{item.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 bg-emerald-900/20 rounded-lg px-3 mt-2">
                    <span className="text-emerald-400 font-bold">최종 정산금액</span>
                    <span className="text-emerald-400 font-bold text-lg">{formatKRW(d.final_amount)}</span>
                  </div>
                </div>
                <div className="text-sm text-slate-400 border-t border-slate-700 pt-3 space-y-1">
                  <div>은행: {d.riders?.bank_name ?? '-'}</div>
                  <div>계좌번호: {d.riders?.bank_account ?? '-'}</div>
                  <div>예금주: {d.riders?.account_holder ?? '-'}</div>
                </div>
                <Button onClick={() => handleExportSingle(d)} className="w-full bg-blue-600 hover:bg-blue-700">
                  <FileDown className="h-4 w-4 mr-2" />정산서 엑셀 다운로드
                </Button>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
