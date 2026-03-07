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
  Clock, CheckCircle2, KeyRound, EyeOff,
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

/* ════════════════════════════════════════ */
export default function SiteAdminPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<'members' | 'inquiries'>('inquiries')

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

  /* ── 비밀번호 재설정 ── */
  const [newPw, setNewPw] = useState('')
  const [showNewPw, setShowNewPw] = useState(false)
  const [pwResetting, setPwResetting] = useState(false)
  const handleResetPassword = async () => {
    if (!editing) return
    if (newPw.length < 6) { toast.error('비밀번호는 6자 이상이어야 합니다.'); return }
    setPwResetting(true)
    try {
      const res = await fetch('/api/admin/profiles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editing.id, password: newPw }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { toast.error('재설정 실패: ' + (data?.error ?? res.statusText)); return }
      toast.success('비밀번호가 재설정되었습니다.')
      setNewPw('')
    } finally { setPwResetting(false) }
  }

  /* ── 회원 수정 ── */
  const openDetail = (m: MemberProfile) => { setEditing(m); setDetailOpen(true); setNewPw(''); setShowNewPw(false) }
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
                <div><p className="text-slate-500 text-xs mb-0.5">아이디</p><p className="text-white font-medium">{editing.username ?? '-'}</p></div>
                <div><p className="text-slate-500 text-xs mb-0.5">회사명</p><p className="text-white">{editing.company_name ?? '-'}</p></div>
                <div><p className="text-slate-500 text-xs mb-0.5">사업자등록번호</p><p className="text-white">{editing.business_number ?? '-'}</p></div>
                <div><p className="text-slate-500 text-xs mb-0.5">업체 (플랫폼)</p><PlatformBadge platform={editing.platform} /></div>
                <div><p className="text-slate-500 text-xs mb-0.5">담당자</p><p className="text-white">{editing.manager_name ?? '-'}</p></div>
                <div className="col-span-2"><p className="text-slate-500 text-xs mb-0.5">연락처</p><p className="text-white">{editing.phone ?? '-'}</p></div>
                <div className="col-span-2"><p className="text-slate-500 text-xs mb-0.5">이메일</p><p className="text-white">{editing.email ?? '-'}</p></div>
                <div className="col-span-2"><p className="text-slate-500 text-xs mb-0.5">가입일자</p><p className="text-slate-300 text-sm">{editing.created_at ? formatDate(editing.created_at) : '-'}</p></div>
              </div>

              {/* 비밀번호 재설정 */}
              <div className="border-t border-slate-700 pt-3">
                <p className="text-slate-400 text-xs mb-2 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />비밀번호 재설정
                </p>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showNewPw ? 'text' : 'password'}
                      placeholder="새 비밀번호 (6자 이상)"
                      value={newPw}
                      onChange={e => setNewPw(e.target.value)}
                      className="bg-slate-800 border-slate-600 text-white h-9 pr-9 text-sm"
                    />
                    <button type="button" onClick={() => setShowNewPw(v => !v)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                      {showNewPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button onClick={handleResetPassword} disabled={pwResetting || newPw.length < 6}
                    className="bg-amber-600 hover:bg-amber-700 text-white h-9 px-3 text-sm shrink-0">
                    {pwResetting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                    <span className="ml-1.5">재설정</span>
                  </Button>
                </div>
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
