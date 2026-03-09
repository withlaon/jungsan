'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog'
import {
  Users, Pencil, Loader2, RefreshCw, Eye, ExternalLink,
  MessageSquare, ChevronLeft, ChevronRight, Send,
  Clock, CheckCircle2, EyeOff, BarChart3, TrendingUp,
  UserPlus, CalendarDays, Activity, Globe, MousePointerClick,
} from 'lucide-react'
import { toast } from 'sonner'

const PAGE_SIZE = 20

/* ─── 타입 ─── */
interface MemberProfile {
  id: string
  username: string | null
  company_name: string | null
  business_number: string | null
  manager_name: string | null
  phone: string | null
  email: string | null
  platform: string | null
  created_at: string | null
  plain_password: string | null
}

interface InquiryItem {
  id: string
  title: string
  status: 'pending' | 'answered'
  created_at: string
  profiles: { username: string | null; company_name: string | null } | null
}

interface InquiryMessage {
  id: string
  sender_type: 'member' | 'admin'
  content: string
  created_at: string
}

/* ─── 유틸 ─── */
function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function PlatformBadge({ platform }: { platform: string | null }) {
  if (!platform) return <span className="text-slate-600 text-xs">-</span>
  const isBaemin  = platform === 'baemin'  || platform === '배민'
  const isCoupang = platform === 'coupang' || platform === '쿠팡'
  if (isBaemin) return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-emerald-900/50 text-emerald-300 border border-emerald-700/50 whitespace-nowrap">
      배달의 민족
    </span>
  )
  if (isCoupang) return (
    <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-yellow-900/50 text-yellow-300 border border-yellow-700/50 whitespace-nowrap">
      쿠팡이츠
    </span>
  )
  return <span className="text-slate-400 text-xs">{platform}</span>
}

interface VisitStats {
  total: number
  today: number
  week: number
  month: number
  weeklyStats: { label: string; count: number }[]
  dailyStats:  { label: string; count: number }[]
  topPaths: { path: string; count: number }[]
}

/* ─── 접속통계 패널 ─── */
function StatsPanel({
  members,
  inquiries,
  inquiryTotal,
  loading,
}: {
  members: MemberProfile[]
  inquiries: InquiryItem[]
  inquiryTotal: number
  loading: boolean
}) {
  const now = new Date()

  /* ── 방문자 데이터 ── */
  const [visitStats, setVisitStats] = useState<VisitStats | null>(null)
  const [visitLoading, setVisitLoading] = useState(true)

  useEffect(() => {
    setVisitLoading(true)
    fetch('/api/site-admin/visits')
      .then(r => r.json())
      .then(data => setVisitStats(data))
      .catch(() => {})
      .finally(() => setVisitLoading(false))
  }, [])

  const startOf = (unit: 'day' | 'week' | 'month') => {
    const d = new Date(now)
    if (unit === 'day') { d.setHours(0, 0, 0, 0) }
    else if (unit === 'week') { const day = d.getDay(); d.setDate(d.getDate() - day); d.setHours(0, 0, 0, 0) }
    else { d.setDate(1); d.setHours(0, 0, 0, 0) }
    return d
  }

  const todayCount  = members.filter(m => m.created_at && new Date(m.created_at) >= startOf('day')).length
  const weekCount   = members.filter(m => m.created_at && new Date(m.created_at) >= startOf('week')).length
  const monthCount  = members.filter(m => m.created_at && new Date(m.created_at) >= startOf('month')).length
  const totalCount  = members.length

  const baeminCount  = members.filter(m => m.platform === 'baemin'  || m.platform === '배민').length
  const coupangCount = members.filter(m => m.platform === 'coupang' || m.platform === '쿠팡').length
  const etcCount     = totalCount - baeminCount - coupangCount

  const pendingInquiries  = inquiries.filter(i => i.status === 'pending').length
  const answeredInquiries = inquiries.filter(i => i.status === 'answered').length

  // 최근 8주 가입 추이
  const weeklyData: { label: string; count: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const weekStart = new Date(now)
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() - i * 7)
    weekStart.setHours(0, 0, 0, 0)
    const weekEnd = new Date(weekStart)
    weekEnd.setDate(weekEnd.getDate() + 7)
    const month = weekStart.getMonth() + 1
    const date  = weekStart.getDate()
    weeklyData.push({
      label: `${month}/${date}`,
      count: members.filter(m => {
        if (!m.created_at) return false
        const d = new Date(m.created_at)
        return d >= weekStart && d < weekEnd
      }).length,
    })
  }
  const maxWeekly = Math.max(...weeklyData.map(w => w.count), 1)

  // 최근 가입 5명
  const recentMembers = [...members]
    .filter(m => m.created_at)
    .sort((a, b) => new Date(b.created_at!).getTime() - new Date(a.created_at!).getTime())
    .slice(0, 5)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-40">
        <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
      </div>
    )
  }

  const maxDaily   = Math.max(...(visitStats?.dailyStats  ?? []).map(d => d.count), 1)
  const maxVisitW  = Math.max(...(visitStats?.weeklyStats ?? []).map(w => w.count), 1)

  return (
    <div className="space-y-8">

      {/* ══ 방문자 현황 섹션 ══ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Globe className="h-4 w-4 text-cyan-400" />
          <h3 className="text-sm font-semibold text-white">사이트 방문자 현황 (jungsan-time.com)</h3>
          {visitLoading && <Loader2 className="h-3 w-3 animate-spin text-slate-500" />}
        </div>

        {/* 방문자 요약 카드 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {[
            { icon: Globe,            label: '전체 방문',   value: visitStats?.total ?? '-', color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/30' },
            { icon: CalendarDays,     label: '이번달 방문', value: visitStats?.month ?? '-', color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
            { icon: TrendingUp,       label: '이번주 방문', value: visitStats?.week  ?? '-', color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30' },
            { icon: MousePointerClick,label: '오늘 방문',   value: visitStats?.today ?? '-', color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <Card key={label} className={`border ${border} ${bg} bg-transparent`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-xs font-medium">{label}</span>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-1">회</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 일별 방문 (7일) */}
          <Card className="border-slate-700 bg-slate-900 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <Activity className="h-4 w-4 text-cyan-400" />
                일별 방문 추이 (최근 7일)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visitLoading ? (
                <div className="flex items-center justify-center h-28">
                  <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
                </div>
              ) : (
                <div className="flex items-end gap-2 h-28 mt-2">
                  {(visitStats?.dailyStats ?? []).map((d, idx) => {
                    const hp = maxDaily === 0 ? 0 : Math.max((d.count / maxDaily) * 100, d.count > 0 ? 8 : 0)
                    const isToday = idx === (visitStats?.dailyStats.length ?? 1) - 1
                    return (
                      <div key={d.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                        <span className="text-xs text-slate-400 tabular-nums">{d.count > 0 ? d.count : ''}</span>
                        <div className="w-full flex items-end" style={{ height: '80px' }}>
                          <div
                            className={`w-full rounded-t-sm transition-all ${isToday ? 'bg-cyan-500' : 'bg-slate-600'}`}
                            style={{ height: `${hp}%`, minHeight: d.count > 0 ? '4px' : '0' }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{d.label}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 인기 페이지 TOP 5 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <MousePointerClick className="h-4 w-4 text-emerald-400" />
                인기 페이지 TOP 5
              </CardTitle>
            </CardHeader>
            <CardContent>
              {visitLoading ? (
                <div className="flex items-center justify-center h-20">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
                </div>
              ) : (visitStats?.topPaths ?? []).length === 0 ? (
                <p className="text-slate-500 text-xs py-4 text-center">데이터 없음</p>
              ) : (
                <div className="space-y-2.5">
                  {(visitStats?.topPaths ?? []).map(({ path, count }) => (
                    <div key={path}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-300 truncate max-w-[130px]" title={path}>{path || '/'}</span>
                        <span className="text-cyan-400 font-semibold ml-1">{count}회</span>
                      </div>
                      <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500/60 rounded-full"
                          style={{ width: visitStats!.total > 0 ? `${(count / visitStats!.total) * 100}%` : '0%' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* 주간 방문 추이 (8주) */}
        <Card className="border-slate-700 bg-slate-900 mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-400" />
              주간 방문 추이 (최근 8주)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {visitLoading ? (
              <div className="flex items-center justify-center h-28">
                <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
              </div>
            ) : (
              <div className="flex items-end gap-2 h-28 mt-2">
                {(visitStats?.weeklyStats ?? []).map((w, idx) => {
                  const hp = maxVisitW === 0 ? 0 : Math.max((w.count / maxVisitW) * 100, w.count > 0 ? 8 : 0)
                  const isLast = idx === (visitStats?.weeklyStats.length ?? 1) - 1
                  return (
                    <div key={w.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <span className="text-xs text-slate-400 tabular-nums">{w.count > 0 ? w.count : ''}</span>
                      <div className="w-full flex items-end" style={{ height: '80px' }}>
                        <div
                          className={`w-full rounded-t-sm transition-all ${isLast ? 'bg-blue-500' : 'bg-slate-600'}`}
                          style={{ height: `${hp}%`, minHeight: w.count > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{w.label}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 구분선 */}
      <div className="border-t border-slate-700/60" />

      {/* ══ 회원 현황 섹션 ══ */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">회원 현황</h3>
        </div>

        {/* 요약 카드 4개 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: Users,        label: '전체 회원',   value: totalCount,  color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30' },
            { icon: UserPlus,     label: '이번달 신규', value: monthCount,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
            { icon: CalendarDays, label: '이번주 신규', value: weekCount,   color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/30' },
            { icon: Activity,     label: '오늘 신규',   value: todayCount,  color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30' },
          ].map(({ icon: Icon, label, value, color, bg, border }) => (
            <Card key={label} className={`border ${border} ${bg} bg-transparent`}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-slate-400 text-xs font-medium">{label}</span>
                  <Icon className={`h-4 w-4 ${color}`} />
                </div>
                <p className={`text-3xl font-bold ${color}`}>{value}</p>
                <p className="text-slate-500 text-xs mt-1">명</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* 주간 가입 추이 */}
          <Card className="border-slate-700 bg-slate-900 lg:col-span-2">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-400" />
                주간 신규 가입 추이 (최근 8주)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-2 h-36 mt-2">
                {weeklyData.map((w, idx) => {
                  const heightPct = maxWeekly === 0 ? 0 : Math.max((w.count / maxWeekly) * 100, w.count > 0 ? 8 : 0)
                  const isLast = idx === weeklyData.length - 1
                  return (
                    <div key={w.label} className="flex flex-col items-center gap-1 flex-1 min-w-0">
                      <span className="text-xs text-slate-400 tabular-nums">{w.count > 0 ? w.count : ''}</span>
                      <div className="w-full flex items-end" style={{ height: '96px' }}>
                        <div
                          className={`w-full rounded-t-sm transition-all ${isLast ? 'bg-blue-500' : 'bg-slate-600'}`}
                          style={{ height: `${heightPct}%`, minHeight: w.count > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums whitespace-nowrap">{w.label}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* 플랫폼 분포 + 문의 현황 */}
          <div className="space-y-4">
            <Card className="border-slate-700 bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-400" />
                  플랫폼 분포
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: '배달의 민족', count: baeminCount,  color: 'bg-emerald-500', textColor: 'text-emerald-400' },
                  { label: '쿠팡이츠',   count: coupangCount, color: 'bg-yellow-500',  textColor: 'text-yellow-400' },
                  { label: '기타/미설정', count: etcCount,     color: 'bg-slate-500',  textColor: 'text-slate-400' },
                ].map(({ label, count, color, textColor }) => (
                  <div key={label}>
                    <div className="flex items-center justify-between text-xs mb-1.5">
                      <span className="text-slate-300">{label}</span>
                      <span className={`font-semibold ${textColor}`}>{count}명</span>
                    </div>
                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${color} rounded-full transition-all`}
                        style={{ width: totalCount > 0 ? `${(count / totalCount) * 100}%` : '0%' }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="border-slate-700 bg-slate-900">
              <CardHeader className="pb-2">
                <CardTitle className="text-white text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-violet-400" />
                  문의 현황
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: '전체 문의', count: inquiryTotal,      color: 'text-white' },
                  { label: '답변 대기', count: pendingInquiries,  color: 'text-amber-400' },
                  { label: '답변 완료', count: answeredInquiries, color: 'text-emerald-400' },
                ].map(({ label, count, color }) => (
                  <div key={label} className="flex items-center justify-between">
                    <span className="text-slate-400 text-sm">{label}</span>
                    <span className={`text-sm font-semibold ${color}`}>{count}건</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

        {/* 최근 가입 회원 */}
        <Card className="border-slate-700 bg-slate-900 mt-6">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-sm flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-emerald-400" />
              최근 가입 회원 (최신 5명)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {recentMembers.length === 0 ? (
              <p className="text-slate-500 text-sm py-6 text-center">등록된 회원이 없습니다.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-800/50">
                    <th className="text-left py-2.5 px-4 text-slate-400 font-medium">아이디</th>
                    <th className="text-left py-2.5 px-4 text-slate-400 font-medium">회사명</th>
                    <th className="text-left py-2.5 px-4 text-slate-400 font-medium">플랫폼</th>
                    <th className="text-left py-2.5 px-4 text-slate-400 font-medium whitespace-nowrap">가입일시</th>
                  </tr>
                </thead>
                <tbody>
                  {recentMembers.map((m) => (
                    <tr key={m.id} className="border-b border-slate-800 last:border-0">
                      <td className="py-2.5 px-4 text-blue-400 font-medium">{m.username ?? '-'}</td>
                      <td className="py-2.5 px-4 text-slate-300">{m.company_name ?? '-'}</td>
                      <td className="py-2.5 px-4"><PlatformBadge platform={m.platform} /></td>
                      <td className="py-2.5 px-4 text-slate-400 text-xs">{m.created_at ? formatDate(m.created_at) : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      </div>

    </div>
  )
}

/* ════════════════════════════════════════ */
export default function SiteAdminPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'members' | 'inquiries' | 'stats'>('inquiries')

  /* ── 회원 목록 상태 ── */
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [membersLoading, setMembersLoading] = useState(true)
  const [memberPage, setMemberPage] = useState(1)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<MemberProfile | null>(null)
  const [form, setForm] = useState({ username:'', company_name:'', business_number:'', manager_name:'', phone:'', email:'' })
  const [saving, setSaving] = useState(false)

  const memberPageCount = Math.max(1, Math.ceil(members.length / PAGE_SIZE))
  const pagedMembers = members.slice((memberPage - 1) * PAGE_SIZE, memberPage * PAGE_SIZE)

  /* ── 문의 목록 상태 ── */
  const [inquiries, setInquiries] = useState<InquiryItem[]>([])
  const [inquiriesLoading, setInquiriesLoading] = useState(false)
  const [inquiryPage, setInquiryPage] = useState(1)
  const [inquiryTotal, setInquiryTotal] = useState(0)

  const [threadOpen, setThreadOpen] = useState(false)
  const [threadInquiry, setThreadInquiry] = useState<(InquiryItem & { content?: string }) | null>(null)
  const [messages, setMessages] = useState<InquiryMessage[]>([])
  const [threadLoading, setThreadLoading] = useState(false)
  const [adminReply, setAdminReply] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const inquiryTotalPages = Math.max(1, Math.ceil(inquiryTotal / PAGE_SIZE))

  /* ── 회원 목록 로드 ── */
  const fetchMembers = useCallback(async () => {
    setMembersLoading(true)
    try {
      const res = await fetch('/api/admin/profiles')
      const data = await res.json()
      if (!res.ok) { toast.error('회원 목록 조회 실패'); setMembers([]) }
      else setMembers((Array.isArray(data) ? data : []) as MemberProfile[])
    } catch { toast.error('회원 목록 조회 실패'); setMembers([]) }
    setMembersLoading(false)
  }, [])

  useEffect(() => { fetchMembers() }, [fetchMembers])

  /* ── 문의 목록 로드 ── */
  const fetchInquiries = useCallback(async (p = 1) => {
    setInquiriesLoading(true)
    try {
      const res = await fetch(`/api/site-admin/inquiries?page=${p}`)
      const json = await res.json()
      setInquiries(json.data ?? [])
      setInquiryTotal(json.count ?? 0)
    } catch { toast.error('문의 목록 조회 실패') }
    setInquiriesLoading(false)
  }, [])

  useEffect(() => {
    if (activeTab === 'inquiries') fetchInquiries(inquiryPage)
  }, [activeTab, inquiryPage, fetchInquiries])

  /* ── 실시간: 문의 목록 갱신 (신규 문의/재문의 감지) ── */
  useEffect(() => {
    if (activeTab !== 'inquiries') return
    const channel = supabase
      .channel('site_admin_inquiries')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'inquiries' }, () => {
        fetchInquiries(inquiryPage)
      })
      .subscribe()
    return () => { channel.unsubscribe() }
  }, [activeTab, inquiryPage, fetchInquiries, supabase])

  /* ── 문의 스레드 열기 ── */
  const openThread = async (inq: InquiryItem) => {
    setThreadOpen(true)
    setThreadLoading(true)
    setAdminReply('')
    setMessages([])
    setThreadInquiry(inq)
    try {
      const res = await fetch(`/api/site-admin/inquiries/${inq.id}`)
      const json = await res.json()
      setThreadInquiry({ ...inq, content: json.inquiry?.content })
      setMessages(json.messages ?? [])
    } finally {
      setThreadLoading(false)
    }
  }

  /* ── 스레드 실시간 구독 ── */
  useEffect(() => {
    if (!threadInquiry) return
    realtimeRef.current?.unsubscribe()
    const channel = supabase
      .channel(`admin_thread_${threadInquiry.id}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'inquiry_messages',
        filter: `inquiry_id=eq.${threadInquiry.id}`,
      }, (payload) => {
        const newMsg = payload.new as InquiryMessage
        setMessages(prev => prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg])
        if (newMsg.sender_type === 'member') {
          // 회원이 재문의 → 목록에서 해당 항목을 pending으로 표시
          setInquiries(prev => prev.map(i =>
            i.id === threadInquiry.id ? { ...i, status: 'pending' } : i
          ))
          setThreadInquiry(prev => prev ? { ...prev, status: 'pending' } : prev)
        }
      })
      .subscribe()
    realtimeRef.current = channel
    return () => { channel.unsubscribe() }
  }, [threadInquiry?.id, supabase])

  /* ── 스크롤 ── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  /* ── 답변 등록 ── */
  const handleReply = async () => {
    if (!adminReply.trim() || !threadInquiry) return
    setReplyLoading(true)
    try {
      const res = await fetch(`/api/site-admin/inquiries/${threadInquiry.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: adminReply.trim() }),
      })
      if (!res.ok) { const j = await res.json(); toast.error(j.error ?? '답변 등록 실패'); return }
      setAdminReply('')
      setInquiries(prev => prev.map(i =>
        i.id === threadInquiry.id ? { ...i, status: 'answered' } : i
      ))
      setThreadInquiry(prev => prev ? { ...prev, status: 'answered' } : prev)
    } finally {
      setReplyLoading(false)
    }
  }

  /* ── 회원 수정 ── */
  const [showPw, setShowPw] = useState(false)
  const openDetail = (m: MemberProfile) => { setEditing(m); setDetailOpen(true); setShowPw(false) }
  const openEdit = (m: MemberProfile) => {
    setEditing(m)
    setForm({ username: m.username ?? '', company_name: m.company_name ?? '',
      business_number: m.business_number ?? '', manager_name: m.manager_name ?? '',
      phone: m.phone ?? '', email: m.email ?? '' })
    setDetailOpen(false); setEditOpen(true)
  }
  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/profiles', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, ...form }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error('저장 실패: ' + (data?.error ?? res.statusText)); return }
      toast.success('저장되었습니다.')
      setEditOpen(false); setEditing(null); fetchMembers()
    } finally { setSaving(false) }
  }

  /* ════ RENDER ════ */
  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">라이더 정산 시스템 전체관리자</h2>
          <p className="text-slate-400 text-sm mt-1">회원 정보 및 문의 관리</p>
        </div>
        {activeTab === 'members' && (
          <Button variant="outline" onClick={fetchMembers} disabled={membersLoading}
            className="border-slate-600 text-slate-300">
            <RefreshCw className={`h-4 w-4 mr-2 ${membersLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        )}
        {activeTab === 'inquiries' && (
          <Button variant="outline" onClick={() => fetchInquiries(inquiryPage)} disabled={inquiriesLoading}
            className="border-slate-600 text-slate-300">
            <RefreshCw className={`h-4 w-4 mr-2 ${inquiriesLoading ? 'animate-spin' : ''}`} />
            새로고침
          </Button>
        )}
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-slate-700">
        <button
          onClick={() => setActiveTab('inquiries')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'inquiries'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <MessageSquare className="h-4 w-4" />
          문의하기
          {inquiries.filter(i => i.status === 'pending').length > 0 && (
            <span className="bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">
              {inquiries.filter(i => i.status === 'pending').length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('members')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'members'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <Users className="h-4 w-4" />
          회원 목록
          <span className="bg-slate-700 text-slate-300 text-xs px-1.5 py-0.5 rounded-full">
            {members.length}
          </span>
        </button>
        <button
          onClick={() => setActiveTab('stats')}
          className={`flex items-center gap-2 px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'stats'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-slate-400 hover:text-slate-300'
          }`}
        >
          <BarChart3 className="h-4 w-4" />
          접속통계
        </button>
      </div>

      {/* ══ 회원 목록 탭 ══ */}
      {activeTab === 'members' && (
        <>
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2 text-base">
                <Users className="h-5 w-5" />
                회원정보 ({members.length}명)
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {membersLoading ? (
                <div className="py-12 flex justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
                </div>
              ) : pagedMembers.length === 0 ? (
                <div className="py-12 text-center text-slate-500">등록된 회원이 없습니다.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/50">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">아이디</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">회사명</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">사업자번호</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">업체</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">담당자</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">연락처</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">이메일</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium whitespace-nowrap">가입일자</th>
                        <th className="w-20 py-3 px-4"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedMembers.map((m) => (
                        <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/30">
                          <td className="py-3 px-4">
                            <button onClick={() => m.username && window.open(`${window.location.origin}/dashboard`, '_blank')}
                              className="text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 group"
                              title={m.username ? '관리자 사이트 열기' : ''}>
                              {m.username ?? '-'}
                              {m.username && <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
                            </button>
                          </td>
                          <td className="py-3 px-4">
                            <button onClick={() => m.username && window.open(`${window.location.origin}/dashboard`, '_blank')}
                              className="text-slate-300 hover:text-white flex items-center gap-1 group">
                              {m.company_name ?? '-'}
                              {m.company_name && m.username && <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-blue-400" />}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-slate-300">{m.business_number ?? '-'}</td>
                          <td className="py-3 px-4"><PlatformBadge platform={m.platform} /></td>
                          <td className="py-3 px-4 text-slate-300">{m.manager_name ?? '-'}</td>
                          <td className="py-3 px-4 text-slate-300">{m.phone ?? '-'}</td>
                          <td className="py-3 px-4 text-slate-300">{m.email ?? '-'}</td>
                          <td className="py-3 px-4 text-slate-400 text-xs whitespace-nowrap">
                            {m.created_at ? formatDate(m.created_at) : '-'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => openDetail(m)}
                                className="text-slate-400 hover:text-white hover:bg-slate-700" title="상세보기">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => openEdit(m)}
                                className="text-slate-400 hover:text-white hover:bg-slate-700" title="수정">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          {/* 회원 페이지네이션 */}
          {memberPageCount > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setMemberPage(p => Math.max(1, p - 1))}
                disabled={memberPage <= 1} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-slate-400 text-sm px-3">{memberPage} / {memberPageCount}</span>
              <Button variant="outline" size="sm" onClick={() => setMemberPage(p => Math.min(memberPageCount, p + 1))}
                disabled={memberPage >= memberPageCount} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ══ 접속통계 탭 ══ */}
      {activeTab === 'stats' && (
        <StatsPanel members={members} inquiries={inquiries} inquiryTotal={inquiryTotal} loading={membersLoading} />
      )}

      {/* ══ 문의하기 탭 ══ */}
      {activeTab === 'inquiries' && (
        <>
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-3 border-b border-slate-700">
              <CardTitle className="text-white text-base flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-blue-400" />
                  회원 문의 목록
                </span>
                <span className="text-slate-400 text-sm font-normal">총 {inquiryTotal}건</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {inquiriesLoading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
                </div>
              ) : inquiries.length === 0 ? (
                <div className="text-center text-slate-500 py-12">
                  <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">등록된 문의가 없습니다.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 bg-slate-800/50">
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">상태</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">아이디</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">회사명</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">제목</th>
                        <th className="text-left py-3 px-4 text-slate-400 font-medium">등록일시</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inquiries.map((inq) => (
                        <tr key={inq.id}
                          onClick={() => openThread(inq)}
                          className="border-b border-slate-800 hover:bg-slate-800/40 cursor-pointer transition-colors">
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={
                              inq.status === 'answered'
                                ? 'border-green-600 text-green-400 bg-green-950/30 text-xs'
                                : 'border-amber-600 text-amber-400 bg-amber-950/30 text-xs'
                            }>
                              {inq.status === 'answered' ? (
                                <><CheckCircle2 className="h-3 w-3 mr-1 inline" />답변완료</>
                              ) : (
                                <><Clock className="h-3 w-3 mr-1 inline" />답변대기</>
                              )}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-blue-400 font-medium">
                            {inq.profiles?.username ?? '-'}
                          </td>
                          <td className="py-3 px-4 text-slate-300">
                            {inq.profiles?.company_name ?? '-'}
                          </td>
                          <td className="py-3 px-4 text-white font-medium">{inq.title}</td>
                          <td className="py-3 px-4 text-slate-400 text-xs">{formatDate(inq.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
          {/* 문의 페이지네이션 */}
          {inquiryTotalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" size="sm"
                onClick={() => { const p = Math.max(1, inquiryPage - 1); setInquiryPage(p); fetchInquiries(p) }}
                disabled={inquiryPage <= 1} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-slate-400 text-sm px-3">{inquiryPage} / {inquiryTotalPages}</span>
              <Button variant="outline" size="sm"
                onClick={() => { const p = Math.min(inquiryTotalPages, inquiryPage + 1); setInquiryPage(p); fetchInquiries(p) }}
                disabled={inquiryPage >= inquiryTotalPages} className="border-slate-600 text-slate-300 hover:bg-slate-700">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </>
      )}

      {/* ══ 문의 스레드 다이얼로그 ══ */}
      <Dialog open={threadOpen} onOpenChange={(o) => { setThreadOpen(o); if (!o) realtimeRef.current?.unsubscribe() }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              {threadInquiry?.title ?? '문의 상세'}
              {threadInquiry && (
                <Badge variant="outline" className={
                  threadInquiry.status === 'answered'
                    ? 'border-green-600 text-green-400 bg-green-950/30 text-xs ml-1'
                    : 'border-amber-600 text-amber-400 bg-amber-950/30 text-xs ml-1'
                }>
                  {threadInquiry.status === 'answered' ? '답변완료' : '답변대기'}
                </Badge>
              )}
            </DialogTitle>
            {threadInquiry?.profiles && (
              <p className="text-slate-400 text-xs mt-1">
                작성자: <span className="text-blue-400">{threadInquiry.profiles.username}</span>
                {threadInquiry.profiles.company_name && ` · ${threadInquiry.profiles.company_name}`}
              </p>
            )}
          </DialogHeader>

          {threadLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <>
              {/* 메시지 스레드 */}
              <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.sender_type === 'admin'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-100 border border-slate-600'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${msg.sender_type === 'admin' ? 'text-blue-200' : 'text-amber-400'}`}>
                          {msg.sender_type === 'admin' ? '전체관리자' : (threadInquiry?.profiles?.username ?? '회원')}
                        </span>
                        <span className={`text-xs ${msg.sender_type === 'admin' ? 'text-blue-200' : 'text-slate-500'}`}>
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* 답변 입력 */}
              <div className="shrink-0 border-t border-slate-700 pt-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Textarea value={adminReply} onChange={e => setAdminReply(e.target.value)}
                    placeholder="답변을 입력하세요... (Shift+Enter로 줄바꿈)"
                    rows={3} maxLength={2000}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() } }}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 resize-none flex-1 text-sm" />
                  <Button onClick={handleReply} disabled={replyLoading || !adminReply.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white self-end gap-1.5 shrink-0">
                    {replyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    답변
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ 회원 상세 다이얼로그 ══ */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle>회원정보 상세</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">아이디</p>
                  <p className="text-white font-medium">{editing.username ?? '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">비밀번호</p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-mono text-sm">
                      {editing.plain_password
                        ? (showPw ? editing.plain_password : '•'.repeat(Math.min(editing.plain_password.length, 10)))
                        : '-'}
                    </p>
                    {editing.plain_password && (
                      <button type="button" onClick={() => setShowPw(v => !v)}
                        className="text-slate-400 hover:text-white shrink-0">
                        {showPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
                <div><p className="text-slate-500 text-xs mb-0.5">회사명</p><p className="text-white">{editing.company_name ?? '-'}</p></div>
                <div><p className="text-slate-500 text-xs mb-0.5">사업자등록번호</p><p className="text-white">{editing.business_number ?? '-'}</p></div>
                <div><p className="text-slate-500 text-xs mb-0.5">업체 (플랫폼)</p><PlatformBadge platform={editing.platform} /></div>
                <div><p className="text-slate-500 text-xs mb-0.5">담당자</p><p className="text-white">{editing.manager_name ?? '-'}</p></div>
                <div className="col-span-2"><p className="text-slate-500 text-xs mb-0.5">연락처</p><p className="text-white">{editing.phone ?? '-'}</p></div>
                <div className="col-span-2"><p className="text-slate-500 text-xs mb-0.5">이메일</p><p className="text-white">{editing.email ?? '-'}</p></div>
                <div className="col-span-2"><p className="text-slate-500 text-xs mb-0.5">가입일자</p><p className="text-slate-300 text-sm">{editing.created_at ? formatDate(editing.created_at) : '-'}</p></div>
              </div>

              <DialogFooter className="border-t border-slate-700 pt-4 flex-col gap-2 sm:flex-row">
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="border-slate-600 text-slate-300">닫기</Button>
                <Button variant="outline" onClick={() => window.open(`${window.location.origin}/dashboard`, '_blank')}
                  className="border-blue-700 text-blue-300 hover:bg-blue-900/30 gap-2">
                  <ExternalLink className="h-4 w-4" />관리자 사이트 열기
                </Button>
                <Button onClick={() => editing && openEdit(editing)} className="bg-blue-600 hover:bg-blue-700">
                  <Pencil className="h-4 w-4 mr-2" />수정
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══ 회원 수정 다이얼로그 ══ */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader><DialogTitle>회원 정보 수정</DialogTitle></DialogHeader>
          <div className="space-y-4 py-4">
            {(['username','company_name','business_number','manager_name','phone','email'] as const).map((field) => (
              <div key={field} className="space-y-2">
                <Label className="text-slate-300">
                  {{ username:'아이디', company_name:'회사명', business_number:'사업자등록번호', manager_name:'담당자', phone:'연락처', email:'이메일' }[field]}
                </Label>
                <Input type={field === 'email' ? 'email' : 'text'} value={form[field]}
                  onChange={e => setForm(p => ({ ...p, [field]: e.target.value }))}
                  className="bg-slate-800 border-slate-600 text-white" />
              </div>
            ))}
          </div>
          <DialogFooter className="border-t border-slate-700 pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-slate-600 text-slate-300">취소</Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
