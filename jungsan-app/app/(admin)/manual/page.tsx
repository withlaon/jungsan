'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Download, BarChart3, Users, Wallet, Gift, Settings,
  Upload, FileText, Globe, ChevronRight, Info, AlertTriangle,
  CheckCircle, Megaphone, MessageSquare, LogOut, ImagePlus, Loader2,
} from 'lucide-react'

export default function ManualPage() {
  const printRef = useRef<HTMLDivElement>(null)
  const { platform, userId } = useUser()
  const isBaemin = platform === 'baemin'
  const [pdfLoading, setPdfLoading] = useState(false)
  const [incomeTaxRate, setIncomeTaxRate] = useState<number>(0.033)

  useEffect(() => {
    const fetchRate = async () => {
      const supabase = createClient()
      if (userId) {
        const { data: userSettings } = await supabase
          .from('fee_settings')
          .select('income_tax_rate')
          .eq('user_id', userId)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (userSettings) { setIncomeTaxRate(Number(userSettings.income_tax_rate)); return }
      }
      const { data } = await supabase
        .from('fee_settings')
        .select('income_tax_rate')
        .is('user_id', null)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setIncomeTaxRate(Number(data.income_tax_rate))
    }
    fetchRate()
  }, [userId])

  const taxRateLabel = `${(incomeTaxRate * 100).toFixed(1)}%`

  const platformLabel = isBaemin ? '배달의 민족' : '쿠팡이츠'
  const platformColor = isBaemin ? 'text-emerald-400' : 'text-yellow-400'
  const platformBg   = isBaemin ? 'bg-emerald-900/30 border-emerald-700/40' : 'bg-yellow-900/30 border-yellow-700/40'

  const handleDownloadPDF = async () => {
    if (!printRef.current || pdfLoading) return
    setPdfLoading(true)

    // PDF에 포함하지 않을 요소를 임시로 숨김
    const noPrintEls = printRef.current.querySelectorAll<HTMLElement>('.no-print')
    noPrintEls.forEach(el => { el.style.display = 'none' })

    // ─── html2canvas 미지원 색상 함수(lab, oklch, lch) 사전 변환 ───
    // canvas fillStyle을 이용하면 브라우저가 자동으로 안전한 sRGB 값으로 변환해 준다.
    const fixedStyles: Array<{ el: HTMLElement; prop: string; prev: string }> = []

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = 1; tempCanvas.height = 1
    const ctx2d = tempCanvas.getContext('2d')

    const toSafeColor = (color: string): string | null => {
      // lab(), oklch(), lch() 포함된 값만 변환
      if (!color || !/\blab\(|\boklch\(|\blch\(/.test(color)) return null
      if (!ctx2d) return null
      try {
        ctx2d.fillStyle = color
        return ctx2d.fillStyle // 브라우저가 rgb() / #rrggbb 형태로 변환해 반환
      } catch {
        return null
      }
    }

    const CSS_PROPS: [string, string][] = [
      ['color',              'color'],
      ['background-color',   'backgroundColor'],
      ['border-top-color',   'borderTopColor'],
      ['border-right-color', 'borderRightColor'],
      ['border-bottom-color','borderBottomColor'],
      ['border-left-color',  'borderLeftColor'],
    ]

    const allEls = [printRef.current, ...printRef.current.querySelectorAll<HTMLElement>('*')]
    allEls.forEach(el => {
      const computed = window.getComputedStyle(el)
      CSS_PROPS.forEach(([cssProp, jsProp]) => {
        const val = computed[jsProp as keyof CSSStyleDeclaration] as string
        const safe = toSafeColor(val)
        if (safe) {
          fixedStyles.push({ el, prop: cssProp, prev: el.style.getPropertyValue(cssProp) })
          el.style.setProperty(cssProp, safe, 'important')
        }
      })
    })
    // ──────────────────────────────────────────────────────────────

    try {
      const html2pdf = (await import('html2pdf.js')).default
      const filename = `라이더정산시스템_사용자메뉴얼_${platformLabel}.pdf`

      await html2pdf()
        .set({
          margin: [12, 10, 12, 10],
          filename,
          image: { type: 'jpeg', quality: 0.97 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0f172a',
            logging: false,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        })
        .from(printRef.current)
        .save()
    } catch (err) {
      console.error('PDF 생성 실패:', err)
      alert('PDF 생성에 실패했습니다. 다시 시도해주세요.')
    } finally {
      // 변환했던 스타일 복원
      fixedStyles.forEach(({ el, prop, prev }) => {
        if (prev) el.style.setProperty(prop, prev)
        else el.style.removeProperty(prop)
      })
      noPrintEls.forEach(el => { el.style.display = '' })
      setPdfLoading(false)
    }
  }

  /* ─ 공통 스타일 헬퍼 ─ */
  const tip   = (text: React.ReactNode) => (
    <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-xs flex items-start gap-2">
      <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
      <span className="text-blue-300">{text}</span>
    </div>
  )
  const warn  = (text: React.ReactNode) => (
    <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-xs flex items-start gap-2">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
      <span className="text-amber-300">{text}</span>
    </div>
  )
  const good  = (text: React.ReactNode) => (
    <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3 text-xs flex items-start gap-2">
      <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
      <span className="text-emerald-300">{text}</span>
    </div>
  )

  type Section = {
    id: string; title: string; icon: React.ComponentType<{ className?: string }>
    badge?: string; badgeColor?: string; content: React.ReactNode
  }

  const sections: Section[] = [
    /* ══════════════════════════════════════════
       1. 시스템 개요
    ══════════════════════════════════════════ */
    {
      id: 'overview', title: '시스템 개요', icon: BookOpen,
      content: (
        <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
          <p>
            <strong className="text-white">라이더 정산 시스템</strong>은 {isBaemin ? '배달의 민족' : '쿠팡이츠'}
            {' '}라이더의 주간 정산을 자동화하는 통합 관리 플랫폼입니다.
            엑셀 파일을 업로드하면 보험료·관리비·프로모션·소득세를 자동 계산하고 라이더별 정산서를 발행합니다.
          </p>

          {/* 플랫폼 배지 */}
          <div className={`border rounded-lg p-3 ${platformBg}`}>
            <p className={`text-xs font-medium ${platformColor}`}>현재 계정 플랫폼: {platformLabel}</p>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-4">
            <p className="text-blue-300 font-medium mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" /> 주요 기능
            </p>
            <ul className="space-y-1.5 text-slate-300">
              {[
                '라이더 등록 및 관리 (개별/엑셀 일괄등록, 다중 선택 일괄처리)',
                '주간 정산 파일 업로드 및 자동 계산 (복수 파일 합산 지원)',
                '프로모션(지사프로모션) · 관리비 · 보험료 자동 반영',
                '선지급금 등록·공제·회수 처리',
                '라이더별 개인 정산서 링크 발행 (계정별 전용 URL)',
                '공지사항 이미지 생성 · 저장 · 관리',
                '전체관리자에게 문의하기 (실시간 답변)',
                '주간 지사 순이익 대시보드',
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />{t}
                </li>
              ))}
            </ul>
          </div>

          {warn(
            <><strong>권장 사용 순서:</strong> 라이더 등록 → 관리비·프로모션 설정 → 보험료 설정 → 정산파일 등록 → 정산 확정 → 라이더사이트에서 정산서 공유</>
          )}

          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <p className="text-white font-medium text-sm">보안 및 세션 정책</p>
            <ul className="space-y-1 text-xs text-slate-400">
              <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" />브라우저·탭을 닫으면 <strong className="text-white">자동 로그아웃</strong>됩니다. 재접속 시 로그인이 필요합니다.</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" /><strong className="text-white">1시간 이상 미사용</strong> 시 자동 로그아웃됩니다. (5분 전 경고 알림)</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" />각 계정의 데이터는 완전히 독립적으로 관리됩니다.</li>
            </ul>
          </div>
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       2. 정보수정 & 로고 등록
    ══════════════════════════════════════════ */
    {
      id: 'profile', title: '정보수정 & 로고 등록', icon: ImagePlus,
      badge: '계정 설정', badgeColor: 'bg-slate-600',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>사이드바 하단 <strong className="text-white">로그아웃</strong> 버튼 아래의 <strong className="text-white">정보수정</strong> 버튼을 클릭하면 계정 정보와 로고를 관리할 수 있습니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">① 기본 정보 수정</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>회사명, 사업자등록번호, 담당자명, 연락처, 이메일 수정 가능</li>
              <li>비밀번호 변경 시 새 비밀번호를 두 번 입력 후 저장</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">② 로고 등록</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2 text-xs">
              <li>정보수정 다이얼로그에서 로고 이미지 파일 선택 (PNG, JPG 권장)</li>
              <li>미리보기 확인 후 저장</li>
              <li>등록된 로고는 <strong className="text-white">사이드바 상단 아이콘</strong>을 대체합니다.</li>
            </ol>
          </div>

          {tip('회사 로고를 등록하면 사이드바와 라이더 정산서에 브랜딩이 적용됩니다.')}
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       3. 주간정산현황 대시보드
    ══════════════════════════════════════════ */
    {
      id: 'dashboard', title: '주간정산현황 대시보드', icon: BarChart3,
      badge: '현황 확인', badgeColor: 'bg-violet-700',
      content: (
        <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
          <p>정산이 확정된 주간의 지사 순이익과 항목별 수치를 한눈에 확인합니다.</p>
          <ul className="space-y-2 ml-2">
            <li className="flex items-start gap-2">
              <Badge className="mt-0.5 bg-slate-700 text-slate-300 text-xs shrink-0">주차 선택</Badge>
              <span>우측 상단 드롭다운에서 조회 주간을 선택합니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge className="mt-0.5 bg-emerald-800 text-emerald-300 text-xs shrink-0">지사 순이익</Badge>
              <span>지사관리비 − 고용·산재보험(사업주) − 프로모션비 + 콜관리비 + 보험관리비로 계산됩니다.</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge className="mt-0.5 bg-blue-800 text-blue-300 text-xs shrink-0">막대그래프</Badge>
              <span>최근 12주간의 지사 순이익 추이를 시각적으로 확인할 수 있습니다.</span>
            </li>
          </ul>
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       4. 라이더 관리
    ══════════════════════════════════════════ */
    {
      id: 'riders', title: '라이더 관리', icon: Users,
      badge: '필수 설정', badgeColor: 'bg-blue-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p><strong className="text-white">정산 시작 전에 반드시 라이더를 먼저 등록</strong>해야 합니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">① 라이더 개별 등록</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>우측 상단 <strong className="text-white">+ 라이더 추가</strong> 버튼 클릭</li>
              <li>라이더명(필수), 아이디(로그인용, 중복불가), 연락처 입력</li>
              <li><strong className="text-white">저장</strong> 클릭 → 목록에 즉시 표시</li>
            </ol>
            {warn('아이디(라이더 ID)는 중복 사용 불가. 동일 아이디 입력 시 오류 메시지가 표시됩니다.')}
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">② 엑셀 일괄 등록</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>우측 상단 <strong className="text-white">엑셀 업로드</strong> 버튼 클릭</li>
              <li>양식 다운로드 후 이름·아이디·연락처 순서로 작성</li>
              <li>작성한 파일 선택 → 자동 일괄 등록</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">③ 라이더 검색</p>
            <p className="text-xs ml-2">상단 검색창에 이름·아이디를 입력하면 즉시 필터링됩니다. 새로 등록한 라이더도 즉시 검색 가능합니다.</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">④ 다중 선택 일괄 처리</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>목록 상단 체크박스로 전체 선택 또는 개별 체크박스로 선택</li>
              <li>선택 후 <strong className="text-white">일괄 비활성</strong> / <strong className="text-rose-400">일괄 삭제</strong> 버튼 사용</li>
            </ul>
            {warn('완전 삭제 시 해당 라이더의 정산·선지급금·프로모션·관리비 데이터가 모두 삭제됩니다.')}
          </div>

          <div className="space-y-1">
            <p className="text-white font-medium">⑤ 상태 분류</p>
            <div className="flex gap-3 ml-2 text-xs">
              <span className="flex items-center gap-1.5"><Badge className="bg-emerald-800 text-emerald-300 text-xs">활성</Badge> 정산 대상</span>
              <span className="flex items-center gap-1.5"><Badge className="bg-slate-700 text-slate-400 text-xs">비활성</Badge> 정산 제외 (데이터 보존)</span>
            </div>
          </div>
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       5. 선지급금 관리
    ══════════════════════════════════════════ */
    {
      id: 'advance-payments', title: '선지급금 관리', icon: Wallet,
      badge: '선택 설정', badgeColor: 'bg-orange-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>라이더에게 미리 지급한 금액을 등록하면 정산 시 자동으로 공제됩니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">등록</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>우측 상단 <strong className="text-white">선지급금 등록</strong> 버튼 클릭</li>
              <li>라이더 검색 후 선택, 금액·지급 주간·메모 입력</li>
              <li>저장 → 미공제 현황에 표시</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">회수 등록</p>
            <p className="text-xs ml-2">라이더가 선지급금을 자체 반환한 경우 <strong className="text-white">회수 등록</strong> 버튼으로 기록합니다. 정산서에 메모와 함께 회수 금액이 표시됩니다.</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">상태 및 삭제</p>
            <div className="flex gap-3 ml-2 text-xs mb-2">
              <span className="flex items-center gap-1.5"><Badge className="bg-orange-800 text-orange-300 text-xs">미공제</Badge> 정산 시 자동 차감 대상</span>
              <span className="flex items-center gap-1.5"><Badge className="bg-emerald-800 text-emerald-300 text-xs">공제완료</Badge> 이미 반영된 항목</span>
            </div>
            {tip('공제 완료된 항목도 삭제 버튼으로 삭제할 수 있습니다. 삭제해도 이미 확정된 정산에는 영향이 없습니다.')}
          </div>
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       6. 프로모션 설정
    ══════════════════════════════════════════ */
    {
      id: 'promotions', title: '프로모션 설정 (지사프로모션)', icon: Gift,
      badge: '선택 설정', badgeColor: 'bg-rose-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>배달건수 기반 인센티브(지사프로모션)를 설정하면 정산 시 자동 적용됩니다. 정산서에는 <strong className="text-white">지사프로모션</strong>으로 표기됩니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">프로모션 종류</p>
            <ul className="space-y-2 ml-2 text-xs">
              {[
                ['고정금액', '설정 조건 충족 시 일정 금액 지급', '예) 100건 이상이면 50,000원 지급'],
                ['구간별 금액', '배달건수 구간에 따라 다른 금액 적용', '예) 50~99건: 20,000원, 100건↑: 50,000원'],
                ['건당 금액', '기준 건수 초과분에 단가 적용', '예) 50건 초과 시 건당 500원'],
              ].map(([t, d, ex]) => (
                <li key={t}>
                  <span className="text-white font-medium">{t}:</span> {d}
                  <br /><span className="text-slate-500">{ex}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">적용 범위 & 기간</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li><strong className="text-white">전체/개별 적용:</strong> 모든 라이더 또는 지정 라이더에게 적용</li>
              <li><strong className="text-white">기간:</strong> 전체 기간 / 특정 주간 / 마감일까지</li>
            </ul>
          </div>

          {tip('기존 프로모션을 클릭하면 상세보기, 라이더 추가, 내용 수정이 가능합니다.')}

          {isBaemin && (
            <div className={`border rounded-lg p-3 ${platformBg}`}>
              <p className={`text-xs font-medium ${platformColor} mb-1`}>배달의 민족 정산 공식에서의 역할</p>
              <p className="text-xs text-slate-300">세금신고금액 = 기본정산금액 + <strong className="text-white">지사프로모션</strong><br />최종정산금액에도 지사프로모션이 가산됩니다.</p>
            </div>
          )}
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       7. 관리비 설정
    ══════════════════════════════════════════ */
    {
      id: 'settings', title: '관리비 설정', icon: Settings,
      badge: '선택 설정', badgeColor: 'bg-slate-600',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>콜관리비, 일반관리비, 시간제보험료를 설정합니다. 정산 계산 시 자동으로 차감됩니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">관리비 종류</p>
            <ul className="space-y-2 ml-2 text-xs">
              <li><span className="text-white font-medium">콜관리비:</span> 건당 단가 × 배달건수<br /><span className="text-slate-500">예) 200원 × 150건 = 30,000원 차감</span></li>
              <li><span className="text-white font-medium">일반관리비:</span> 고정 금액 차감<br /><span className="text-slate-500">예) 월 5,000원 정액 차감</span></li>
              {isBaemin && (
                <li><span className="text-white font-medium">시간제보험료:</span> 라이더별 설정 금액을 최종정산금액에서 차감<br /><span className="text-slate-500">배달의 민족 전용 항목</span></li>
              )}
            </ul>
          </div>

          {tip('기존 관리비 항목을 클릭하면 라이더 추가 및 내용 수정이 가능합니다.')}
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       8. 정산파일 등록
    ══════════════════════════════════════════ */
    {
      id: 'upload', title: '정산파일 등록', icon: Upload,
      badge: '핵심 기능', badgeColor: 'bg-emerald-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>배달 플랫폼에서 받은 엑셀 정산 파일을 업로드하여 정산금액을 자동 계산합니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">① 정산 주간 설정</p>
            <p className="text-xs ml-2">정산할 주간의 시작일과 종료일을 설정합니다.</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">② 엑셀 파일 업로드</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>파일 선택 영역에 엑셀 파일(.xlsx, .xls)을 드래그하거나 클릭하여 선택</li>
              <li><strong className="text-white">2개 이상의 파일</strong>을 동시 업로드하면 동일 라이더 데이터를 <strong className="text-white">자동 합산</strong></li>
              <li>파싱 완료 후 <span className="text-emerald-400">✓ 성공</span> 표시 확인</li>
            </ul>
            {warn('파싱 실패 시 파일 형식을 확인하세요. 배달 플랫폼 표준 엑셀 형식만 지원됩니다.')}
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">③ 라이더 연결</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>파일의 라이더 이름·아이디와 등록된 라이더를 자동 매핑</li>
              <li>미매핑 라이더는 드롭다운에서 직접 선택하거나 <strong className="text-white">연결 안함</strong> 처리</li>
              <li><strong className="text-white">정산 계산하기</strong> 버튼 클릭</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">④ 정산 결과 확인 및 확정</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>라이더별 배달건수·기본정산금액·보험료·지사프로모션·관리비·소득세·최종정산금액 확인</li>
              <li><strong className="text-white">임시저장:</strong> 나중에 수정 가능한 상태로 저장</li>
              <li><strong className="text-white">정산 확정:</strong> 확정 완료 (선지급금 자동 공제 처리)</li>
            </ul>
          </div>

          {/* 플랫폼별 계산식 */}
          <div className={`border rounded-lg p-4 space-y-2 ${isBaemin ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-yellow-900/20 border-yellow-700/40'}`}>
            <p className={`text-xs font-semibold ${platformColor}`}>📐 {platformLabel} 정산 계산 공식</p>
            {isBaemin ? (
              <div className="space-y-1 text-xs text-slate-300 font-mono">
                <p>기본정산금액 = 배달료 + 추가지급(배민추가지급)</p>
                <p>세금신고금액 = 기본정산금액 + 지사프로모션</p>
                <p>소득세 = 세금신고금액 × {taxRateLabel} <span className="text-amber-300">(원단위 절상)</span></p>
                <p className="border-t border-slate-700 pt-1 mt-1">
                  최종정산금액 = 기본정산금액<br />
                  <span className="ml-14">− 시간제보험료<br /></span>
                  <span className="ml-14">− 고용보험(근로자)<br /></span>
                  <span className="ml-14">− 산재보험(근로자)<br /></span>
                  <span className="ml-14">+ 지사프로모션<br /></span>
                  <span className="ml-14">− 콜관리비<br /></span>
                  <span className="ml-14">− 소득세<br /></span>
                  <span className="ml-14">− 선지급금 공제<br /></span>
                  <span className="ml-14">+ 선지급금 회수</span>
                </p>
              </div>
            ) : (
              <div className="space-y-1 text-xs text-slate-300 font-mono">
                <p>기본정산금액 = 배달료 + 추가지급</p>
                <p>세금신고금액 = 기본정산금액</p>
                <p>소득세 = 세금신고금액 × {taxRateLabel}</p>
                <p className="border-t border-slate-700 pt-1 mt-1">
                  최종정산금액 = 기본정산금액<br />
                  <span className="ml-14">− 고용보험(근로자)<br /></span>
                  <span className="ml-14">− 산재보험(근로자)<br /></span>
                  <span className="ml-14">+ 지사프로모션<br /></span>
                  <span className="ml-14">− 콜관리비<br /></span>
                  <span className="ml-14">− 소득세<br /></span>
                  <span className="ml-14">− 선지급금 공제<br /></span>
                  <span className="ml-14">+ 선지급금 회수</span>
                </p>
              </div>
            )}
          </div>
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       9. 정산결과보기
    ══════════════════════════════════════════ */
    {
      id: 'result', title: '정산결과보기', icon: FileText,
      badge: '핵심 기능', badgeColor: 'bg-emerald-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>확정 또는 임시저장된 정산 결과를 조회하고 관리합니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">정산 목록 & 상세</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>좌측 목록에서 주간 선택 → 우측에 라이더별 상세 표시</li>
              <li className="flex items-center gap-2"><Badge className="bg-emerald-700 text-white text-xs">확정</Badge> 최종 확정된 정산</li>
              <li className="flex items-center gap-2"><Badge className="bg-amber-700 text-white text-xs">임시저장</Badge> 아직 확정되지 않은 정산</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">라이더별 정산서 미리보기</p>
            <p className="text-xs ml-2">라이더 행 클릭 → 정산서 팝업 (배달건수, 기본정산금액, 지사프로모션, 공제 항목, 최종정산금액)</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">정산 삭제</p>
            {warn('삭제 시 상세 데이터와 함께 완전 삭제됩니다. 연결된 선지급금의 공제 처리도 자동 초기화(미공제)됩니다.')}
          </div>
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       10. 공지사항 생성
    ══════════════════════════════════════════ */
    {
      id: 'notice', title: '공지사항 생성', icon: Megaphone,
      badge: '부가 기능', badgeColor: 'bg-purple-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>템플릿을 선택하고 내용을 입력하면 공지사항 이미지를 자동 생성합니다. 라이더에게 공유할 공지문을 손쉽게 만들 수 있습니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">① 공지사항 작성</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2 text-xs">
              <li>4가지 배경 템플릿 중 선택</li>
              <li>회사명·날짜(기본 정보) 입력</li>
              <li>미리보기 이미지의 <strong className="text-white">제목 영역 또는 내용 영역을 직접 클릭</strong>하여 텍스트 입력</li>
              <li>하단 스타일 패널에서 글씨 크기·색상·굵기·정렬·위치(세로) 조정</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">② 다운로드 & 저장</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li><strong className="text-white">다운로드 & 저장</strong> 버튼 클릭 → 이미지(.png) 다운로드 + 공지사항 목록에 자동 저장</li>
              <li>저장된 공지는 하단 목록에서 미리보기·수정·삭제 가능</li>
            </ul>
          </div>

          {tip('미리보기 이미지에서 제목·내용 영역을 클릭하면 직접 타이핑할 수 있습니다. 별도 입력칸이 없어도 됩니다.')}
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       11. 라이더사이트
    ══════════════════════════════════════════ */
    {
      id: 'rider-site', title: '라이더사이트', icon: Globe,
      badge: '라이더 공유', badgeColor: 'bg-teal-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>라이더가 자신의 정산서를 확인할 수 있는 개인 링크를 관리합니다. 각 계정의 라이더 사이트 URL은 <strong className="text-white">독립적</strong>으로 운영됩니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">정산서 링크 발행</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>라이더 목록에서 공유할 라이더 선택</li>
              <li><strong className="text-white">링크 생성</strong> 버튼 클릭 → 개인 고유 URL 생성</li>
              <li>생성된 링크를 복사하여 라이더에게 전달 (카카오톡, 문자 등)</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">라이더 정산서 화면 구성</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>최신 정산이 맨 위에 표시</li>
              <li>기본정산금액(배달료 + {isBaemin ? '배민추가지급' : '추가지급'}), 지사프로모션</li>
              <li>선지급금 공제 내역 (메모 포함) — 해당자에게만 표시</li>
              <li>회수 등록 내역 (메모 포함) — 해당자에게만 표시</li>
              <li>최종정산금액</li>
            </ul>
          </div>

          {good('라이더 링크는 토큰 기반으로 안전하게 보호되며, 다른 라이더의 정보는 볼 수 없습니다.')}
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       12. 문의하기
    ══════════════════════════════════════════ */
    {
      id: 'inquiry', title: '문의하기', icon: MessageSquare,
      badge: '고객 지원', badgeColor: 'bg-blue-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>시스템 이용 중 궁금한 사항이나 불편한 점을 전체관리자에게 문의할 수 있습니다. 답변은 실시간으로 수신됩니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">문의 작성</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>우측 상단 <strong className="text-white">새 문의</strong> 버튼 클릭</li>
              <li>제목과 내용 입력 후 <strong className="text-white">등록</strong> 클릭</li>
              <li>목록에 문의가 추가되며 <Badge className="bg-amber-800 text-amber-300 text-xs">답변대기</Badge> 상태로 표시</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">답변 확인 & 재문의</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>전체관리자가 답변하면 상태가 <Badge className="bg-emerald-800 text-emerald-300 text-xs">답변완료</Badge>로 변경되며 <strong className="text-white">실시간 알림</strong></li>
              <li>문의를 클릭하면 채팅 형태의 대화 스레드 확인 가능</li>
              <li>하단 입력창에 추가 질문을 입력하면 <strong className="text-white">재문의</strong>로 등록됨</li>
              <li>Enter 키로 전송, Shift+Enter로 줄바꿈</li>
            </ul>
          </div>

          {tip('답변 수신 시 별도 알림은 없으므로, 주기적으로 문의하기 탭을 확인해 주세요.')}
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       13. 자동 로그아웃
    ══════════════════════════════════════════ */
    {
      id: 'security', title: '자동 로그아웃 & 보안', icon: LogOut,
      badge: '보안', badgeColor: 'bg-red-800',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <div className="space-y-3">
            {[
              ['브라우저/탭 닫기', '창을 닫는 즉시 서버 세션이 무효화됩니다. 재접속 시 로그인이 필요합니다.'],
              ['1시간 무활동', '마우스·키보드 입력이 1시간 없으면 자동 로그아웃됩니다. 5분 전 화면에 경고 알림이 표시됩니다.'],
              ['수동 로그아웃', '사이드바 하단 로그아웃 버튼을 클릭하면 즉시 로그아웃됩니다.'],
            ].map(([t, d]) => (
              <div key={t as string} className="border border-slate-700 rounded-lg p-3 space-y-1">
                <p className="text-white font-medium text-sm">{t as string}</p>
                <p className="text-xs text-slate-400">{d as string}</p>
              </div>
            ))}
          </div>

          {warn('중요한 작업(정산 계산, 임시저장 등) 후 반드시 저장 여부를 확인하세요. 자동 로그아웃 시 미저장 데이터는 유실될 수 있습니다.')}
        </div>
      ),
    },

    /* ══════════════════════════════════════════
       14. 자주 묻는 질문
    ══════════════════════════════════════════ */
    {
      id: 'faq', title: '자주 묻는 질문', icon: AlertTriangle,
      content: (
        <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
          {[
            {
              q: '파일 업로드 후 라이더 매핑이 안 되어 있어요.',
              a: '파일의 라이더 이름·아이디가 등록된 라이더 정보와 정확히 일치해야 자동 매핑됩니다. 라이더 관리 탭에서 아이디를 등록하면 정확도가 높아집니다.',
            },
            {
              q: '정산 계산 후 결과가 보이지 않아요.',
              a: '라이더 연결 단계에서 모든 라이더를 "연결 안함"으로 설정하면 결과가 없습니다. 최소 1명 이상 연결해주세요.',
            },
            {
              q: '선지급금이 자동으로 차감되지 않아요.',
              a: '정산 확정 시 "미공제" 상태의 선지급금만 자동 차감됩니다. 이미 공제 완료된 항목은 다시 차감되지 않습니다.',
            },
            {
              q: '같은 라이더가 여러 파일에 있어요.',
              a: '파일을 동시에 업로드하면 동일 라이더 데이터를 자동 합산합니다. 합산된 배달건수 기준으로 프로모션이 적용됩니다.',
            },
            {
              q: '라이더를 삭제했는데 정산 데이터도 삭제되나요?',
              a: '완전 삭제 시 정산 상세·선지급금·프로모션·관리비 설정이 모두 삭제됩니다. 단순 비활성화는 데이터가 보존됩니다.',
            },
            {
              q: '정산 결과를 삭제했는데 선지급금은요?',
              a: '정산 결과 삭제 시 해당 정산에서 공제된 선지급금의 공제 상태가 "미공제"로 자동 초기화됩니다.',
            },
            ...(isBaemin ? [{
              q: '소득세가 예상과 다르게 계산되어요.',
              a: `배달의 민족 정산에서 소득세는 세금신고금액(기본정산금액+지사프로모션) × ${taxRateLabel}를 원단위 절상(올림)하여 계산합니다.`,
            }] : []),
            {
              q: '브라우저를 닫았다가 다시 열면 로그인이 필요한가요?',
              a: '네. 보안을 위해 브라우저·탭을 닫으면 자동 로그아웃됩니다. 재접속 시 아이디·비밀번호를 다시 입력해야 합니다.',
            },
          ].map(({ q, a }, i) => (
            <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-2">
              <p className="text-white font-medium flex items-start gap-2">
                <span className="text-blue-400 shrink-0">Q.</span>{q}
              </p>
              <p className="text-slate-300 flex items-start gap-2 text-xs">
                <span className="text-emerald-400 shrink-0">A.</span>{a}
              </p>
            </div>
          ))}
        </div>
      ),
    },
  ]

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-content { padding: 20px !important; }
          * { color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="p-6 space-y-6 print-content" ref={printRef}>
        {/* 헤더 */}
        <div className="flex items-start justify-between no-print">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-400" />
              사용자 메뉴얼
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {platformLabel} 라이더 정산 시스템 · 관리자 사용 가이드
              <span className="ml-2 text-slate-600 text-xs">v2.0</span>
            </p>
          </div>
          <Button onClick={handleDownloadPDF} disabled={pdfLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfLoading ? 'PDF 생성 중...' : 'PDF 저장'}
          </Button>
        </div>

        {/* 목차 */}
        <Card className="border-slate-700 bg-slate-900/50 no-print">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm font-medium">목차</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {sections.map((s, i) => {
                const Icon = s.icon
                return (
                  <a key={s.id} href={`#${s.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="text-xs text-slate-500 shrink-0">{i + 1}.</span>
                    <span className="truncate">{s.title}</span>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* 섹션별 내용 */}
        <div className="space-y-4">
          {sections.map((s, i) => {
            const Icon = s.icon
            return (
              <Card key={s.id} id={s.id} className="border-slate-700 bg-slate-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-3">
                    <div className="bg-slate-800 rounded-lg p-1.5">
                      <Icon className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-slate-500 text-sm font-normal">{i + 1}.</span>
                    {s.title}
                    {s.badge && (
                      <Badge className={`${s.badgeColor} text-white text-xs ml-auto`}>{s.badge}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>{s.content}</CardContent>
              </Card>
            )
          })}
        </div>

        {/* 하단 PDF 버튼 */}
        <div className="flex justify-center pt-2 no-print">
          <Button onClick={handleDownloadPDF} disabled={pdfLoading} size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            {pdfLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {pdfLoading ? 'PDF 생성 중...' : 'PDF로 저장하기'}
          </Button>
        </div>
      </div>
    </>
  )
}
