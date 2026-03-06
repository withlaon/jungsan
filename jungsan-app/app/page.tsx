'use client'

import Link from 'next/link'
import {
  BarChart3,
  FileSpreadsheet,
  Shield,
  TrendingUp,
  Users,
  Link2,
  CheckCircle2,
  ArrowRight,
  Mail,
  Phone,
  Zap,
  ChevronRight,
} from 'lucide-react'

const features = [
  {
    icon: Zap,
    color: 'from-yellow-500 to-orange-500',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    title: '정산 자동화로 업무 효율 극대화',
    desc: '엑셀 파일 업로드만으로 정산 금액이 자동 계산됩니다. 복잡한 수기 작업 없이 빠르고 정확하게 업무를 처리하세요.',
  },
  {
    icon: FileSpreadsheet,
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-500/10 border-blue-500/20',
    title: '복잡한 공제 항목 자동 반영',
    desc: '프로모션(건당/구간별), 관리비, 고용·산재보험, 원천세(3.3%)를 설정에 따라 모두 자동으로 계산·차감합니다.',
  },
  {
    icon: Shield,
    color: 'from-green-500 to-emerald-500',
    bg: 'bg-green-500/10 border-green-500/20',
    title: '선지급금 관리 & 미회수 방지',
    desc: '선지급금을 등록하면 정산 확정 시 자동으로 공제 처리되어 계산 누락이나 미회수 위험을 완벽하게 방지합니다.',
  },
  {
    icon: TrendingUp,
    color: 'from-purple-500 to-pink-500',
    bg: 'bg-purple-500/10 border-purple-500/20',
    title: '지사 수익성 분석 대시보드',
    desc: '최근 12주간의 순이익 추이와 항목별 수치를 시각화된 그래프로 제공해 경영 현황을 한눈에 파악할 수 있습니다.',
  },
  {
    icon: Link2,
    color: 'from-cyan-500 to-blue-500',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    title: '투명한 개인 정산서 공유',
    desc: '라이더별 전용 URL을 발행해 개인 정산 내역을 안전하게 전달합니다. 라이더 신뢰도가 올라가고 문의 응대 시간이 줄어듭니다.',
  },
  {
    icon: Users,
    color: 'from-rose-500 to-orange-500',
    bg: 'bg-rose-500/10 border-rose-500/20',
    title: '멀티 플랫폼 데이터 통합 관리',
    desc: '여러 배달 플랫폼 파일을 업로드해도 동일 라이더 데이터를 자동으로 합산하며, 활성·비활성 상태 관리도 유연하게 지원합니다.',
  },
]

const stats = [
  { value: '100%', label: '자동 정산' },
  { value: '6가지', label: '공제 항목 자동 반영' },
  { value: '12주', label: '수익 트렌드 분석' },
  { value: '실시간', label: '정산서 공유' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#0a0f1e] text-white overflow-x-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0f1e]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-blue-500/30">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">
              JUNGSAN<span className="text-blue-400">-TIME</span>
            </span>
          </div>
          <Link
            href="/login"
            className="flex items-center gap-2 px-5 py-2 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-all duration-200 shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40"
          >
            로그인
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-32 pb-24 px-6 overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-blue-600/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-[300px] h-[300px] bg-cyan-500/10 rounded-full blur-[80px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              라이더 정산 자동화 플랫폼
            </div>
            <h1 className="text-5xl md:text-6xl font-extrabold leading-tight mb-6">
              라이더 정산,
              <br />
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                이제 자동으로
              </span>
            </h1>
            <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed mb-10">
              배달 플랫폼의 엑셀 데이터를 활용해 라이더의 주간 정산을 자동화하는 통합 관리 플랫폼입니다.
              프로모션·보험료·선지급금 공제를 자동 계산하고, 지사 순이익 대시보드와 개인 정산서 링크 발행까지
              정산의 투명성과 운영 효율을 동시에 확보하세요.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold text-base hover:opacity-90 transition-all duration-200 shadow-xl shadow-blue-600/30"
              >
                지금 시작하기
                <ArrowRight className="w-5 h-5" />
              </Link>
              <a
                href="mailto:jimcard@naver.com"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border border-white/10 bg-white/5 text-slate-300 font-medium text-base hover:bg-white/10 transition-all duration-200"
              >
                <Mail className="w-4 h-4" />
                문의하기
              </a>
            </div>
          </div>

          {/* Dashboard Mockup */}
          <div className="relative mx-auto max-w-5xl">
            <div className="absolute inset-0 bg-gradient-to-t from-[#0a0f1e] via-transparent to-transparent z-10 pointer-events-none" style={{top: '60%'}} />
            <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden shadow-2xl shadow-blue-900/30">
              {/* Mock browser bar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-white/10 bg-white/5">
                <div className="w-3 h-3 rounded-full bg-red-500/70" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                <div className="w-3 h-3 rounded-full bg-green-500/70" />
                <div className="flex-1 mx-4 h-6 rounded bg-white/5 flex items-center px-3">
                  <span className="text-xs text-slate-500">jungsan-z2so.vercel.app/dashboard</span>
                </div>
              </div>
              {/* Mock dashboard content */}
              <div className="p-6 grid grid-cols-12 gap-4 min-h-[320px]">
                {/* Sidebar mock */}
                <div className="col-span-2 space-y-2">
                  {['대시보드', '라이더 관리', '정산 업로드', '정산 결과', '설정'].map((item, i) => (
                    <div key={item} className={`h-8 rounded-lg flex items-center px-3 text-xs ${i === 0 ? 'bg-blue-600/40 text-blue-300' : 'bg-white/5 text-slate-500'}`}>
                      {item}
                    </div>
                  ))}
                </div>
                {/* Main content mock */}
                <div className="col-span-10 space-y-4">
                  {/* Stat cards */}
                  <div className="grid grid-cols-4 gap-3">
                    {[
                      { label: '이번주 정산 라이더', value: '47명', color: 'text-blue-400' },
                      { label: '총 정산금액', value: '₩12.4M', color: 'text-cyan-400' },
                      { label: '선지급금 공제', value: '₩840K', color: 'text-purple-400' },
                      { label: '지사 순이익', value: '₩2.1M', color: 'text-green-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <div className="text-xs text-slate-500 mb-1">{s.label}</div>
                        <div className={`text-lg font-bold ${s.color}`}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  {/* Chart mock */}
                  <div className="bg-white/5 rounded-xl p-4 border border-white/5 h-36 flex items-end gap-2 overflow-hidden">
                    {[40, 65, 55, 80, 70, 90, 75, 85, 60, 95, 80, 100].map((h, i) => (
                      <div key={i} className="flex-1 rounded-t" style={{
                        height: `${h}%`,
                        background: i === 11 ? 'linear-gradient(to top, #2563eb, #06b6d4)' : 'rgba(255,255,255,0.08)'
                      }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 px-6 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {stats.map(s => (
            <div key={s.label}>
              <div className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent mb-1">
                {s.value}
              </div>
              <div className="text-sm text-slate-500">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-24 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium mb-6">
            <CheckCircle2 className="w-3.5 h-3.5" />
            간단하고 합리적인 요금제
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            모든 기능을 <span className="text-green-400">월 20,000원</span>에
          </h2>
          <p className="text-slate-400 mb-10">가입 후 30일간 모든 기능을 무료로 체험하세요.</p>

          <div className="relative rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-600/10 to-cyan-600/5 p-8 md:p-10 overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl pointer-events-none" />
            <div className="relative">
              <div className="flex items-end justify-center gap-1 mb-2">
                <span className="text-5xl font-extrabold">₩20,000</span>
                <span className="text-slate-400 mb-2">/ 월</span>
              </div>
              <p className="text-blue-400 text-sm mb-8">첫 30일 무료 체험 후 결제</p>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 text-left mb-8">
                {[
                  '엑셀 파일 자동 정산 처리',
                  '프로모션·보험·세금 공제 자동 계산',
                  '선지급금 등록 및 자동 공제',
                  '지사 순이익 대시보드 (12주)',
                  '라이더 개인 정산서 URL 발행',
                  '멀티 플랫폼 데이터 통합',
                  '라이더 활성·비활성 상태 관리',
                  '무제한 라이더 등록',
                ].map(item => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:opacity-90 transition-all duration-200 shadow-xl shadow-blue-600/30 w-full md:w-auto"
              >
                무료로 시작하기
                <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-24 px-6 bg-white/[0.02] border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 text-sm font-medium mb-6">
              <Zap className="w-3.5 h-3.5" />
              서비스를 사용해야 하는 이유
            </div>
            <h2 className="text-3xl md:text-4xl font-bold">
              정산 업무의 모든 문제를
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                한 번에 해결합니다
              </span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => {
              const Icon = f.icon
              return (
                <div
                  key={f.title}
                  className={`rounded-2xl border p-6 bg-white/[0.03] hover:bg-white/[0.06] transition-all duration-200 group ${f.bg}`}
                >
                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 shadow-lg group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="font-semibold text-base text-white mb-2">{f.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Contact / CTA Section */}
      <section className="py-24 px-6 border-t border-white/5">
        <div className="max-w-4xl mx-auto">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-slate-800/50 to-slate-900/50 backdrop-blur p-10 md:p-14">
            <div className="flex flex-col md:flex-row gap-10 items-start">
              <div className="flex-1">
                <h2 className="text-2xl md:text-3xl font-bold mb-3">
                  도입 문의 또는<br />
                  <span className="text-blue-400">서비스에 대해 궁금하신가요?</span>
                </h2>
                <p className="text-slate-400 text-sm leading-relaxed mb-6">
                  운영 상황에 맞는 사용 방법이나 기능에 대한 질문을 언제든지 남겨주세요.
                  빠르게 답변 드리겠습니다.
                </p>
                <div className="space-y-3">
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-blue-400" />
                    </div>
                    010-5949-7469
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-blue-400" />
                    </div>
                    jimcard@naver.com
                  </div>
                  <div className="flex items-center gap-3 text-sm text-slate-300">
                    <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-blue-400" />
                    </div>
                    상호: 위드라온
                  </div>
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col gap-3 w-full md:w-auto">
                <a
                  href="mailto:jimcard@naver.com"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full bg-gradient-to-r from-blue-600 to-cyan-500 text-white font-semibold hover:opacity-90 transition-all duration-200 shadow-xl shadow-blue-600/30 text-sm"
                >
                  <Mail className="w-4 h-4" />
                  이메일로 문의하기
                </a>
                <a
                  href="tel:01059497469"
                  className="inline-flex items-center justify-center gap-2 px-8 py-3.5 rounded-full border border-white/10 bg-white/5 text-slate-300 font-medium hover:bg-white/10 transition-all duration-200 text-sm"
                >
                  <Phone className="w-4 h-4" />
                  전화로 문의하기
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-white/5 py-10 px-6">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-400 flex items-center justify-center">
              <BarChart3 className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-base tracking-tight">
              JUNGSAN<span className="text-blue-400">-TIME</span>
            </span>
          </div>
          <p className="text-xs text-slate-600 text-center">
            © 2025 위드라온 · 라이더 정산 자동화 플랫폼 · jimcard@naver.com
          </p>
          <Link
            href="/login"
            className="text-sm text-slate-400 hover:text-blue-400 transition-colors flex items-center gap-1"
          >
            관리자 로그인
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  )
}
