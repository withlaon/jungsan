'use client'

import { useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  BookOpen, Download, BarChart3, Users, Wallet, Gift, Settings,
  Upload, FileText, Globe, ChevronRight, Info, AlertTriangle, CheckCircle,
} from 'lucide-react'

interface Section {
  id: string
  title: string
  icon: React.ComponentType<{ className?: string }>
  badge?: string
  badgeColor?: string
  content: React.ReactNode
}

export default function ManualPage() {
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = () => {
    window.print()
  }

  const sections: Section[] = [
    {
      id: 'overview',
      title: '시스템 개요',
      icon: BookOpen,
      content: (
        <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
          <p>
            <strong className="text-white">라이더 정산 시스템</strong>은 배달 라이더의 주간 정산을 효율적으로 관리하기 위한 통합 관리 플랫폼입니다.
            엑셀 파일 기반의 정산 데이터를 업로드하여 자동으로 정산금액을 계산하고, 라이더별 정산서를 발행할 수 있습니다.
          </p>
          <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-4">
            <p className="text-blue-300 font-medium mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" /> 주요 기능
            </p>
            <ul className="space-y-1.5 text-slate-300">
              <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />라이더 등록 및 관리 (개별/엑셀 일괄등록)</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />주간 정산 파일 업로드 및 자동 계산</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />프로모션·관리비·보험료 자동 반영</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />선지급금 등록 및 공제 처리</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />라이더별 개인 정산서 링크 발행</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />주간 지사 순이익 대시보드</li>
            </ul>
          </div>
          <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
            <p className="text-amber-300 text-xs flex items-center gap-2">
              <AlertTriangle className="h-3.5 w-3.5" />
              <strong>권장 사용 순서:</strong> 라이더 등록 → 관리비·프로모션 설정 → 정산파일 등록 → 정산 확정 → 라이더사이트에서 정산서 공유
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'dashboard',
      title: '주간정산현황 대시보드',
      icon: BarChart3,
      badge: '1단계',
      badgeColor: 'bg-violet-700',
      content: (
        <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
          <p>주간 정산이 확정된 후 지사 순이익과 항목별 수치를 한눈에 확인할 수 있는 화면입니다.</p>
          <div className="space-y-2">
            <p className="text-white font-medium">화면 구성</p>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <Badge className="mt-0.5 bg-slate-700 text-slate-300 text-xs shrink-0">주차 선택</Badge>
                <span>우측 상단 드롭다운에서 조회할 주간을 선택합니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge className="mt-0.5 bg-emerald-800 text-emerald-300 text-xs shrink-0">지사 순이익</Badge>
                <span>지사관리비 - 고용보험사업주 - 산재보험사업주 - 프로모션비 + 콜관리비 + 고용산재관리비로 계산됩니다.</span>
              </li>
              <li className="flex items-start gap-2">
                <Badge className="mt-0.5 bg-blue-800 text-blue-300 text-xs shrink-0">막대그래프</Badge>
                <span>최근 12주간의 지사 순이익 추이를 막대그래프로 확인할 수 있습니다. 현재 선택된 주차는 밝은 색으로 표시됩니다.</span>
              </li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'riders',
      title: '라이더 관리',
      icon: Users,
      badge: '필수 설정',
      badgeColor: 'bg-blue-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>정산에 사용할 라이더를 등록하고 관리합니다. <strong className="text-white">정산을 시작하기 전에 반드시 라이더를 먼저 등록</strong>해야 합니다.</p>

          <div className="space-y-3">
            <p className="text-white font-medium">① 라이더 개별 등록</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2">
              <li>우측 상단 <strong className="text-white">+ 라이더 추가</strong> 버튼 클릭</li>
              <li>라이더명(필수), 아이디(로그인용), 연락처 입력</li>
              <li><strong className="text-white">저장</strong> 버튼 클릭 → 즉시 목록에 표시</li>
            </ol>
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-xs text-amber-300">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              아이디(라이더 ID)는 중복 사용 불가. 동일 아이디 입력 시 오류 메시지가 표시됩니다.
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-white font-medium">② 엑셀 일괄 등록</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2">
              <li>우측 상단 <strong className="text-white">엑셀 업로드</strong> 버튼 클릭</li>
              <li>양식 다운로드 후 라이더 정보를 입력 (이름, 아이디, 연락처 순서)</li>
              <li>작성된 엑셀 파일 선택 → 자동 일괄 등록</li>
            </ol>
          </div>

          <div className="space-y-3">
            <p className="text-white font-medium">③ 라이더 상태 관리</p>
            <ul className="space-y-1.5 ml-2">
              <li className="flex items-center gap-2"><Badge className="bg-emerald-800 text-emerald-300 text-xs">활성</Badge> 정산 대상 라이더 (기본값)</li>
              <li className="flex items-center gap-2"><Badge className="bg-slate-700 text-slate-400 text-xs">비활성</Badge> 정산에서 제외되는 라이더 (데이터 보존)</li>
            </ul>
            <p className="text-xs text-slate-400">활성/비활성 버튼으로 상태를 전환하거나, 선택 후 일괄 비활성/삭제 처리가 가능합니다.</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">④ 다중 선택 일괄 처리</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2">
              <li>목록 상단 체크박스로 전체 선택, 또는 개별 체크박스로 선택</li>
              <li>선택된 라이더 수 표시와 함께 <strong className="text-white">일괄 비활성</strong> / <strong className="text-rose-400">일괄 삭제</strong> 버튼 활성화</li>
              <li>삭제 시 관련 정산 데이터도 함께 삭제되므로 주의 필요</li>
            </ol>
          </div>
        </div>
      ),
    },
    {
      id: 'advance-payments',
      title: '선지급금 관리',
      icon: Wallet,
      badge: '선택 설정',
      badgeColor: 'bg-orange-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>라이더에게 미리 지급한 금액을 등록하고, 정산 시 자동으로 공제합니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">선지급금 등록</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2">
              <li>우측 상단 <strong className="text-white">선지급금 등록</strong> 버튼 클릭</li>
              <li>라이더 검색 후 선택, 금액 및 지급 주간 입력</li>
              <li>저장 → 미공제 현황에 표시됨</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">회수 내역 등록</p>
            <p>라이더가 선지급금을 자체 반환한 경우 <strong className="text-white">회수 등록</strong> 버튼으로 별도 기록합니다.</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">공제 처리</p>
            <ul className="space-y-1.5 ml-2">
              <li className="flex items-center gap-2"><Badge className="bg-orange-800 text-orange-300 text-xs">미공제</Badge> 정산 계산 시 자동으로 최종정산금액에서 차감</li>
              <li className="flex items-center gap-2"><Badge className="bg-emerald-800 text-emerald-300 text-xs">공제 완료</Badge> 이미 정산에 반영된 항목 (삭제해도 기존 정산은 변경 안 됨)</li>
            </ul>
          </div>
        </div>
      ),
    },
    {
      id: 'promotions',
      title: '프로모션 설정',
      icon: Gift,
      badge: '선택 설정',
      badgeColor: 'bg-rose-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>배달건수 기반의 프로모션(인센티브)을 설정하면 정산 시 자동으로 적용됩니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">프로모션 종류</p>
            <ul className="space-y-2 ml-2">
              <li>
                <span className="text-white font-medium">고정금액:</span> 설정 조건 충족 시 일정 금액 지급<br/>
                <span className="text-slate-400 text-xs">예) 100건 이상이면 5만원 지급</span>
              </li>
              <li>
                <span className="text-white font-medium">구간별 금액:</span> 배달건수 구간에 따라 다른 금액 적용<br/>
                <span className="text-slate-400 text-xs">예) 50~99건: 2만원, 100건 이상: 5만원</span>
              </li>
              <li>
                <span className="text-white font-medium">건당 금액:</span> 기준 건수 초과분에 단가 적용<br/>
                <span className="text-slate-400 text-xs">예) 50건 초과 시 건당 500원</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">적용 범위</p>
            <ul className="space-y-1.5 ml-2">
              <li><strong className="text-white">전체 적용:</strong> 등록된 모든 라이더 또는 특정 라이더에게 적용</li>
              <li><strong className="text-white">개별 적용:</strong> 지정된 라이더에게만 적용</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">기간 설정</p>
            <ul className="space-y-1.5 ml-2">
              <li><strong className="text-white">전체 기간:</strong> 기간 제한 없이 항상 적용</li>
              <li><strong className="text-white">특정 주간:</strong> 선택한 주간에만 적용</li>
              <li><strong className="text-white">마감일까지:</strong> 설정한 날짜까지만 적용</li>
            </ul>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-xs">
            <Info className="h-3 w-3 inline mr-1 text-blue-400" />
            <span className="text-blue-300">기존 프로모션을 클릭하면 상세 정보 확인, 라이더 추가, 내용 수정이 가능합니다.</span>
          </div>
        </div>
      ),
    },
    {
      id: 'settings',
      title: '관리비 설정',
      icon: Settings,
      badge: '선택 설정',
      badgeColor: 'bg-slate-600',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>콜관리비, 일반관리비, 고용보험·산재보험 추가 비용을 설정합니다. 정산 계산 시 자동으로 반영됩니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">관리비 종류</p>
            <ul className="space-y-2 ml-2">
              <li>
                <span className="text-white font-medium">콜관리비:</span> 건당 단가 × 배달건수로 계산<br/>
                <span className="text-slate-400 text-xs">예) 건당 200원 × 150건 = 30,000원 차감</span>
              </li>
              <li>
                <span className="text-white font-medium">일반관리비:</span> 고정 금액으로 차감<br/>
                <span className="text-slate-400 text-xs">예) 월 5,000원 정액 차감</span>
              </li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">보험료 설정</p>
            <p>고용보험·산재보험 추가 부담액을 설정하면 정산 시 자동 차감됩니다.</p>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-xs">
            <Info className="h-3 w-3 inline mr-1 text-blue-400" />
            <span className="text-blue-300">기존 관리비 항목을 클릭하면 라이더 추가 및 내용 수정이 가능합니다.</span>
          </div>
        </div>
      ),
    },
    {
      id: 'upload',
      title: '정산파일 등록',
      icon: Upload,
      badge: '핵심 기능',
      badgeColor: 'bg-emerald-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>배달 플랫폼에서 받은 엑셀 정산 파일을 업로드하여 자동으로 정산금액을 계산합니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">① 정산 주간 설정</p>
            <p>정산할 주간의 시작일과 종료일을 설정합니다. (수요일~화요일 기준)</p>
          </div>

          <div className="space-y-3">
            <p className="text-white font-medium">② 엑셀 파일 업로드</p>
            <ul className="space-y-1.5 ml-2">
              <li>파일 선택 영역에 엑셀 파일(.xlsx, .xls)을 끌어 놓거나 클릭하여 선택</li>
              <li><strong className="text-white">2개 이상의 파일</strong>을 업로드하면 동일 라이더 데이터를 자동 합산</li>
              <li>파일 파싱 완료 후 <span className="text-emerald-400">✓ 성공</span> 표시 확인</li>
            </ul>
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-xs text-amber-300">
              <AlertTriangle className="h-3 w-3 inline mr-1" />
              파일 파싱이 실패하면 파일 형식을 확인하세요. 지원 형식: 배달플랫폼 표준 엑셀 형식
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-white font-medium">③ 라이더 연결 (미리보기)</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2">
              <li>파일의 라이더 이름/아이디와 등록된 라이더를 자동 매핑</li>
              <li>미매핑 라이더는 드롭다운에서 직접 연결하거나 <strong className="text-white">연결 안함</strong> 선택</li>
              <li><strong className="text-white">정산 계산하기</strong> 버튼 클릭</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">④ 정산 결과 확인 및 확정</p>
            <ul className="space-y-1.5 ml-2">
              <li>라이더별 배달건수, 기본정산금액, 보험료, 프로모션, 관리비, 원천세, 최종정산금액 확인</li>
              <li><strong className="text-white">임시저장:</strong> 나중에 수정 가능한 상태로 저장</li>
              <li><strong className="text-white">정산 확정:</strong> 확정 완료 (선지급금 자동 공제 처리)</li>
            </ul>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
            <p className="text-blue-300 text-xs font-medium mb-1 flex items-center gap-1">
              <Info className="h-3 w-3" /> 정산 계산 순서
            </p>
            <p className="text-slate-300 text-xs">
              기본정산금액(배달료+추가지급) → 프로모션 가산 → 세금신고금액 산출 → 원천세(3.3%) 계산 → 관리비·보험료 차감 → 선지급금 차감 → 최종정산금액
            </p>
          </div>
        </div>
      ),
    },
    {
      id: 'result',
      title: '정산결과보기',
      icon: FileText,
      badge: '핵심 기능',
      badgeColor: 'bg-emerald-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>확정 또는 임시저장된 정산 결과를 조회하고 관리합니다.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">정산 목록</p>
            <ul className="space-y-1.5 ml-2">
              <li>좌측 목록에서 주간을 선택하면 우측에 상세 내용 표시</li>
              <li><Badge className="bg-emerald-700 text-white text-xs">확정</Badge> 최종 확정된 정산</li>
              <li><Badge className="bg-amber-700 text-white text-xs">임시저장</Badge> 아직 확정되지 않은 정산</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">라이더별 정산서 미리보기</p>
            <p>라이더 행을 클릭하면 해당 라이더의 정산서를 미리볼 수 있습니다.</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">정산 결과 삭제</p>
            <p>목록에서 삭제 버튼 클릭 시 관련 상세 데이터와 함께 완전 삭제됩니다. 연결된 선지급금의 공제 처리도 자동으로 초기화됩니다.</p>
          </div>
        </div>
      ),
    },
    {
      id: 'rider-site',
      title: '라이더사이트',
      icon: Globe,
      badge: '라이더 공유',
      badgeColor: 'bg-teal-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>라이더가 자신의 정산서를 확인할 수 있는 개인 링크를 관리합니다.</p>

          <div className="space-y-3">
            <p className="text-white font-medium">정산서 링크 발행</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2">
              <li>라이더 목록에서 정산서를 공유할 라이더 선택</li>
              <li><strong className="text-white">링크 생성</strong> 버튼 클릭 → 개인 고유 URL 생성</li>
              <li>생성된 링크를 복사하여 라이더에게 전달 (카카오톡, 문자 등)</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">라이더 정산서 화면 구성</p>
            <ul className="space-y-1.5 ml-2">
              <li>주간별 정산 내역 목록</li>
              <li>배달건수, 기본정산금액(배달료+추가지급), 지사프로모션</li>
              <li>공제 항목(보험료, 원천세, 선지급금 등), 최종정산금액</li>
            </ul>
          </div>

          <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3 text-xs">
            <CheckCircle className="h-3 w-3 inline mr-1 text-emerald-400" />
            <span className="text-emerald-300">라이더 링크는 토큰 기반으로 안전하게 보호되며, 다른 라이더의 정산 정보는 볼 수 없습니다.</span>
          </div>
        </div>
      ),
    },
    {
      id: 'tips',
      title: '자주 묻는 질문 & 주의사항',
      icon: AlertTriangle,
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <div className="space-y-3">
            {[
              {
                q: '파일 업로드 후 라이더 매핑이 안 되어 있어요.',
                a: '파일의 라이더 이름 또는 아이디가 등록된 라이더 정보와 정확히 일치해야 자동 매핑됩니다. 라이더 관리 탭에서 아이디를 등록하면 정확도가 높아집니다.',
              },
              {
                q: '정산 계산 후 결과가 보이지 않아요.',
                a: '라이더 연결(매핑) 단계에서 모든 라이더를 "연결 안함"으로 설정하면 결과가 없습니다. 최소 1명 이상의 라이더를 연결해주세요.',
              },
              {
                q: '선지급금이 자동으로 차감되지 않아요.',
                a: '정산 확정 시 "미공제" 상태의 선지급금만 자동 차감됩니다. 이미 공제 완료된 항목은 다시 차감되지 않습니다.',
              },
              {
                q: '같은 라이더가 여러 파일에 있어요.',
                a: '파일을 동시에 업로드하면 동일 라이더의 데이터를 자동으로 합산합니다. 합산된 배달건수 기준으로 프로모션이 적용됩니다.',
              },
              {
                q: '라이더를 삭제했는데 정산 데이터도 삭제되나요?',
                a: '라이더 완전 삭제 시 해당 라이더의 정산 상세 데이터, 선지급금, 프로모션, 관리비 설정도 함께 삭제됩니다. 단순 비활성화는 데이터가 보존됩니다.',
              },
              {
                q: '정산 결과를 삭제했는데 선지급금은요?',
                a: '정산 결과 삭제 시 해당 정산에서 공제 처리된 선지급금의 공제 상태가 "미공제"로 자동 초기화됩니다.',
              },
            ].map(({ q, a }, i) => (
              <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-2">
                <p className="text-white font-medium flex items-start gap-2">
                  <span className="text-blue-400 shrink-0">Q.</span>{q}
                </p>
                <p className="text-slate-300 flex items-start gap-2">
                  <span className="text-emerald-400 shrink-0">A.</span>{a}
                </p>
              </div>
            ))}
          </div>
        </div>
      ),
    },
  ]

  return (
    <>
      {/* 프린트용 CSS */}
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
            <p className="text-slate-400 text-sm mt-1">라이더 정산 시스템 관리자 사용 가이드</p>
          </div>
          <Button
            onClick={handlePrint}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            PDF 저장
          </Button>
        </div>

        {/* 프린트 헤더 (프린트 시에만 표시) */}
        <div className="hidden print:block mb-6">
          <h1 className="text-2xl font-bold">라이더 정산 시스템 - 사용자 메뉴얼</h1>
          <p className="text-gray-500 text-sm mt-1">관리자 시스템 사용 가이드</p>
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
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm"
                  >
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
                      <Badge className={`${s.badgeColor} text-white text-xs ml-auto`}>
                        {s.badge}
                      </Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {s.content}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* PDF 저장 하단 버튼 */}
        <div className="flex justify-center pt-2 no-print">
          <Button
            onClick={handlePrint}
            size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
          >
            <Download className="h-5 w-5" />
            PDF로 저장하기
          </Button>
        </div>
      </div>
    </>
  )
}
