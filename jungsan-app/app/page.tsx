'use client'

import Link from 'next/link'
import Image from 'next/image'
import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  FileSpreadsheet,
  Calculator,
  ShieldCheck,
  BarChart3,
  Share2,
  Layers,
  CheckCircle2,
  Phone,
  Mail,
  ArrowRight,
  Menu,
  X,
  Zap,
} from 'lucide-react'

const features = [
  {
    icon: FileSpreadsheet,
    title: '정산 자동화',
    desc: '엑셀 파일 업로드 한 번으로 정산 금액이 자동 계산됩니다. 복잡한 수기 작업 없이 빠르고 정확하게 업무를 처리하세요.',
    color: 'from-blue-500 to-cyan-400',
    glow: 'shadow-blue-500/25',
  },
  {
    icon: Calculator,
    title: '공제 항목 자동 반영',
    desc: '프로모션(건당/구간별), 관리비, 고용·산재보험, 원천세(3.3%)를 설정에 따라 자동으로 계산하고 차감합니다.',
    color: 'from-violet-500 to-purple-400',
    glow: 'shadow-violet-500/25',
  },
  {
    icon: ShieldCheck,
    title: '선지급금 관리',
    desc: '라이더에게 미리 지급한 금액을 등록해두면 정산 확정 시 자동 공제 처리되어 미회수·계산 누락 위험을 완벽하게 방지합니다.',
    color: 'from-emerald-500 to-teal-400',
    glow: 'shadow-emerald-500/25',
  },
  {
    icon: BarChart3,
    title: '수익성 분석 대시보드',
    desc: '최근 12주간 지사 순이익 추이와 항목별 수치를 시각화된 그래프로 제공해 경영 현황을 한눈에 파악할 수 있습니다.',
    color: 'from-orange-500 to-amber-400',
    glow: 'shadow-orange-500/25',
  },
  {
    icon: Share2,
    title: '투명한 정산서 공유',
    desc: '라이더별 전용 URL을 발행해 개인 정산 내역을 안전하게 전달합니다. 라이더 신뢰도를 높이고 문의 응대 시간을 줄여줍니다.',
    color: 'from-pink-500 to-rose-400',
    glow: 'shadow-pink-500/25',
  },
  {
    icon: Layers,
    title: '멀티 플랫폼 통합 관리',
    desc: '여러 배달 플랫폼 파일을 업로드해도 동일 라이더 데이터를 자동으로 합산하며 활성·비활성 상태 관리도 유연하게 지원합니다.',
    color: 'from-sky-500 to-indigo-400',
    glow: 'shadow-sky-500/25',
  },
]

const plans = [
  { label: '엑셀 파일 자동 정산 처리' },
  { label: '프로모션·보험·원천세 자동 계산' },
  { label: '선지급금 등록 및 자동 공제' },
  { label: '지사 순이익 대시보드 (12주)' },
  { label: '라이더 개인 정산서 URL 발행' },
  { label: '멀티 플랫폼 데이터 통합' },
  { label: '라이더 활성·비활성 상태 관리' },
  { label: '무제한 라이더 등록' },
]

// 로그아웃 후 세션 쿠키 제거 처리 컴포넌트
function LogoutHandler() {
  const searchParams = useSearchParams()
  useEffect(() => {
    if (searchParams.get('logout') === '1') {
      // 이미 Sidebar에서 스토리지를 지웠지만, 추가 보장
      try { localStorage.clear() } catch { /* ignore */ }
      try { sessionStorage.clear() } catch { /* ignore */ }
    }
  }, [searchParams])
  return null
}

export default function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#070B14] text-white overflow-x-hidden">
      <Suspense fallback={null}><LogoutHandler /></Suspense>
      {/* ── 헤더 ── */}
      <header className="fixed top-0 inset-x-0 z-50 border-b border-white/5 bg-[#070B14]/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          {/* 로고 */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/40">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-bold text-lg tracking-wide">
              JUNGSAN<span className="text-blue-400">-TIME</span>
            </span>
          </div>

          {/* 데스크탑 내비 */}
          <nav className="hidden md:flex items-center gap-8 text-sm text-slate-400">
            <a href="#features" className="hover:text-white transition-colors">기능 소개</a>
            <a href="#pricing" className="hover:text-white transition-colors">요금제</a>
            <a href="#contact" className="hover:text-white transition-colors">문의하기</a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/login?force=1"
              className="inline-flex px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-white/5 transition-all border border-white/10 md:border-transparent"
            >
              로그인
            </Link>
            <Link
              href="/login?force=1"
              className="px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30"
            >
              무료로 시작하기
            </Link>
            {/* 모바일 메뉴 */}
            <button
              className="md:hidden p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* 모바일 메뉴 */}
        {menuOpen && (
          <div className="md:hidden border-t border-white/5 bg-[#070B14] px-6 py-4 flex flex-col gap-4 text-sm text-slate-300">
            <a href="#features" onClick={() => setMenuOpen(false)} className="hover:text-white">기능 소개</a>
            <a href="#pricing" onClick={() => setMenuOpen(false)} className="hover:text-white">요금제</a>
            <a href="#contact" onClick={() => setMenuOpen(false)} className="hover:text-white">문의하기</a>
          </div>
        )}
      </header>

      {/* ── 히어로 섹션 ── */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* 배경 그라디언트 */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[900px] h-[600px] bg-blue-600/10 rounded-full blur-[120px]" />
          <div className="absolute top-40 left-1/4 w-[400px] h-[400px] bg-indigo-600/8 rounded-full blur-[100px]" />
          <div className="absolute top-40 right-1/4 w-[400px] h-[400px] bg-cyan-600/8 rounded-full blur-[100px]" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          {/* 뱃지 */}
          <div className="flex justify-center mb-6">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-400 text-xs font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              라이더 정산 자동화 플랫폼 &nbsp;·&nbsp; JUNGSAN-TIME
            </span>
          </div>

          {/* 헤드라인 */}
          <h1 className="text-center text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight mb-6">
            라이더 정산,{' '}
            <span className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-transparent">
              이제 자동으로
            </span>
          </h1>

          {/* 서브 카피 */}
          <p className="text-center text-slate-400 text-base sm:text-lg max-w-2xl mx-auto leading-loose mb-10">
            배달 플랫폼의 엑셀 데이터를 활용해 라이더의 주간 정산을<br />
            자동화하는 통합 관리 플랫폼입니다.<br />
            프로모션, 보험료, 선지급금 공제를 자동 계산하고<br />
            지사 순이익 대시보드와 개인 정산서 링크 발행까지,<br />
            정산의 투명성과 운영 효율을 동시에 확보하세요.
          </p>

          {/* CTA 버튼 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <Link
              href="/login?force=1"
              className="group inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30 text-base"
            >
              무료로 시작하기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="#features"
              className="inline-flex items-center justify-center gap-2 px-7 py-3.5 rounded-xl font-medium border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-all text-base"
            >
              기능 살펴보기
            </a>
          </div>

          {/* 스탯 */}
          <div className="flex flex-wrap justify-center gap-8 sm:gap-16 mb-16 text-center">
            {[
              { value: '100%', label: '자동 정산' },
              { value: '6가지', label: '공제 항목 자동 반영' },
              { value: '12주', label: '수익 트렌드 분석' },
              { value: '실시간', label: '정산서 공유' },
            ].map((s) => (
              <div key={s.label}>
                <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
                  {s.value}
                </div>
                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* 대시보드 이미지 */}
          <div className="relative rounded-2xl overflow-hidden border border-white/8 shadow-2xl shadow-blue-900/30 ring-1 ring-white/5">
            <div className="absolute inset-0 bg-gradient-to-t from-[#070B14] via-transparent to-transparent z-10 pointer-events-none" style={{ top: '60%' }} />
            <Image
              src="/hero-dashboard.png"
              alt="JUNGSAN-TIME 대시보드"
              width={1200}
              height={675}
              className="w-full object-cover"
              priority
            />
          </div>
        </div>
      </section>

      {/* ── 기능 소개 ── */}
      <section id="features" className="relative py-24 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[600px] bg-indigo-600/5 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">WHY JUNGSAN-TIME</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              정산 업무의 모든 문제를<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">한 번에 해결합니다</span>
            </h2>
            <p className="mt-4 text-slate-400 max-w-xl mx-auto text-sm sm:text-base leading-relaxed">
              복잡한 공제 계산부터 투명한 정산서 공유까지, 라이더 정산에 필요한 모든 것을 하나의 플랫폼에서 처리하세요.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className={`group relative rounded-2xl border border-white/6 bg-white/[0.03] p-6 hover:bg-white/[0.06] hover:border-white/10 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${f.glow}`}
                >
                  <div className={`inline-flex p-2.5 rounded-xl bg-gradient-to-br ${f.color} shadow-lg mb-4`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-white mb-2">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* ── 요금제 ── */}
      <section id="pricing" className="relative py-24 px-6">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-blue-600/8 rounded-full blur-[120px]" />
        </div>

        <div className="relative max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <span className="text-blue-400 text-sm font-semibold uppercase tracking-widest">PRICING</span>
            <h2 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">
              간단하고 합리적인 요금제
            </h2>
            <p className="mt-4 text-slate-400 text-sm sm:text-base">
              모든 기능을 월 <strong className="text-white">20,000원</strong>에 — 가입 후 30일간 무료로 체험하세요.
            </p>
          </div>

          <div className="relative rounded-3xl border border-blue-500/30 bg-gradient-to-b from-blue-600/10 to-transparent p-1 shadow-2xl shadow-blue-600/10">
            <div className="rounded-[20px] bg-[#0C1220] p-8 sm:p-10">
              {/* 가격 */}
              <div className="flex flex-col sm:flex-row sm:items-end gap-4 mb-8">
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-5xl font-extrabold text-white">₩20,000</span>
                    <span className="text-slate-400 text-sm">/ 월</span>
                  </div>
                  <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-400 text-xs font-medium">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    첫 30일 무료 체험
                  </div>
                </div>
                <Link
                  href="/login?force=1"
                  className="sm:ml-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/30 text-sm"
                >
                  지금 무료로 시작하기
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>

              <div className="h-px bg-white/5 mb-8" />

              {/* 플랜 항목 */}
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {plans.map((p) => (
                  <li key={p.label} className="flex items-center gap-3 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
                    {p.label}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 문의 섹션 ── */}
      <section id="contact" className="relative py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-3xl border border-white/6 bg-white/[0.02] p-8 sm:p-12 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              도입 문의 또는<br />
              <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">궁금한 점이 있으신가요?</span>
            </h2>
            <p className="text-slate-400 text-sm sm:text-base max-w-xl mx-auto mb-10 leading-relaxed">
              운영 상황에 맞는 사용 방법이나 기능에 대한 질문을 언제든지 남겨주세요.<br />
              빠르게 답변 드리겠습니다.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-10">
              <a
                href="tel:070-8949-7469"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-medium border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-all text-sm"
              >
                <Phone className="w-4 h-4 text-blue-400" />
                070-8949-7469
              </a>
              <a
                href="mailto:jimcard@naver.com"
                className="inline-flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl font-medium border border-white/10 text-slate-300 hover:bg-white/5 hover:text-white transition-all text-sm"
              >
                <Mail className="w-4 h-4 text-blue-400" />
                jimcard@naver.com
              </a>
            </div>

            <Link
              href="/login?force=1"
              className="group inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl font-semibold bg-blue-600 hover:bg-blue-500 transition-all shadow-xl shadow-blue-600/30"
            >
              지금 바로 시작하기
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-white/10 py-12 px-6 bg-slate-900/40">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-start justify-between gap-8">
            {/* 브랜드 + 사업자 정보 */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-md bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
                  <Zap className="w-3 h-3 text-white fill-white" />
                </div>
                <span className="text-sm font-semibold text-white">JUNGSAN-TIME</span>
              </div>
              <div className="text-xs leading-relaxed space-y-1.5">
                <p><span className="text-slate-400">상호</span> &nbsp;<span className="text-white">위드라온</span></p>
                <p><span className="text-slate-400">대표자</span> &nbsp;<span className="text-white">김형진</span></p>
                <p><span className="text-slate-400">사업자등록번호</span> &nbsp;<span className="text-white">628-27-01385</span></p>
                <p><span className="text-slate-400">통신판매신고번호</span> &nbsp;<span className="text-white">제 2025-부천소사-0308 호</span></p>
                <p><span className="text-slate-400">주소</span> &nbsp;<span className="text-white">경기도 부천시 성주로 96 제일빌딩 5층</span></p>
                <p><span className="text-slate-400">연락처</span> &nbsp;<span className="text-white">070-8949-7469 &nbsp;·&nbsp; jimcard@naver.com</span></p>
              </div>
            </div>
            {/* 링크 영역 */}
            <div className="flex flex-col items-start lg:items-end gap-3">
              <Link
                href="/terms"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-500/50 bg-blue-500/10 text-sm font-medium text-blue-300 hover:bg-blue-500/20 hover:border-blue-400 hover:text-blue-200 transition-all"
              >
                이용약관
              </Link>
              <Link href="/login?force=1" className="text-sm text-slate-400 hover:text-white transition-colors">
                관리자 로그인 →
              </Link>
            </div>
          </div>
          <div className="mt-8 pt-6 border-t border-white/5 text-xs text-slate-400 text-center">
            © 2025 위드라온 · 라이더 정산 자동화 플랫폼
          </div>
        </div>
      </footer>
    </div>
  )
}
