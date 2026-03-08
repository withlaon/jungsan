'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  MessageSquare, Plus, ChevronLeft, ChevronRight,
  Send, RefreshCw, Clock, CheckCircle2, Loader2,
} from 'lucide-react'

const PAGE_SIZE = 20

interface Inquiry {
  id: string
  title: string
  status: 'pending' | 'answered'
  created_at: string
  updated_at: string
}

interface Message {
  id: string
  sender_type: 'member' | 'admin'
  content: string
  created_at: string
}

interface InquiryDetail {
  id: string
  title: string
  content: string
  status: 'pending' | 'answered'
  created_at: string
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

export default function InquiryPage() {
  const supabase = createClient()

  const [inquiries, setInquiries] = useState<Inquiry[]>([])
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage] = useState(1)
  const [listLoading, setListLoading] = useState(false)

  // ??ë¬¸ì˜ ?‘ì„±
  const [newOpen, setNewOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [newLoading, setNewLoading] = useState(false)
  const [newError, setNewError] = useState('')

  // ë¬¸ì˜ ?ì„¸ / ?¤ë ˆ??
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailInquiry, setDetailInquiry] = useState<InquiryDetail | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const [replyLoading, setReplyLoading] = useState(false)
  const [replyError, setReplyError] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const realtimeRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const fetchInquiries = useCallback(async (p = 1) => {
    setListLoading(true)
    try {
      const res = await fetch(`/api/admin/inquiries?page=${p}`)
      const json = await res.json()
      setInquiries(json.data ?? [])
      setTotalCount(json.count ?? 0)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchInquiries(page)
  }, [fetchInquiries, page])

  const openDetail = async (id: string) => {
    setDetailOpen(true)
    setDetailLoading(true)
    setReplyContent('')
    setReplyError('')
    setMessages([])
    setDetailInquiry(null)
    try {
      const res = await fetch(`/api/admin/inquiries/${id}`)
      const json = await res.json()
      setDetailInquiry(json.inquiry)
      setMessages(json.messages ?? [])
    } finally {
      setDetailLoading(false)
    }
  }

  // ?¤ë ˆ???¤ì‹œê°?êµ¬ë…
  useEffect(() => {
    if (!detailInquiry) return
    realtimeRef.current?.unsubscribe()

    const channel = supabase
      .channel(`inquiry_messages_${detailInquiry.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'inquiry_messages',
        filter: `inquiry_id=eq.${detailInquiry.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message
        setMessages(prev => {
          if (prev.some(m => m.id === newMsg.id)) return prev
          return [...prev, newMsg]
        })
        // ??ë©”ì‹œì§€ê°€ admin ?µë??´ë©´ inquiries ëª©ë¡ ?íƒœ???…ë°?´íŠ¸
        if (newMsg.sender_type === 'admin') {
          setInquiries(prev => prev.map(i =>
            i.id === detailInquiry.id ? { ...i, status: 'answered' } : i
          ))
          setDetailInquiry(prev => prev ? { ...prev, status: 'answered' } : prev)
        }
      })
      .subscribe()

    realtimeRef.current = channel
    return () => { channel.unsubscribe() }
  }, [detailInquiry?.id, supabase])

  // ë©”ì‹œì§€ ì¶”ê? ???ë™ ?¤í¬ë¡?
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleNew = async () => {
    if (!newTitle.trim() || !newContent.trim()) {
      setNewError('?œëª©ê³??´ìš©??ëª¨ë‘ ?…ë ¥?´ì£¼?¸ìš”.')
      return
    }
    setNewLoading(true)
    setNewError('')
    try {
      const res = await fetch('/api/admin/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim(), content: newContent.trim() }),
      })
      if (!res.ok) {
        const j = await res.json()
        setNewError(j.error ?? '?±ë¡ ?¤íŒ¨')
        return
      }
      setNewOpen(false)
      setNewTitle('')
      setNewContent('')
      fetchInquiries(1)
      setPage(1)
    } finally {
      setNewLoading(false)
    }
  }

  const handleReply = async () => {
    if (!replyContent.trim() || !detailInquiry) return
    setReplyLoading(true)
    setReplyError('')
    try {
      const res = await fetch(`/api/admin/inquiries/${detailInquiry.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: replyContent.trim() }),
      })
      if (!res.ok) {
        const j = await res.json()
        setReplyError(j.error ?? '?„ì†¡ ?¤íŒ¨')
        return
      }
      setReplyContent('')
      // ëª©ë¡ ê°±ì‹ 
      fetchInquiries(page)
    } finally {
      setReplyLoading(false)
    }
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-4xl mx-auto">
      {/* ?¤ë” */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 rounded-xl p-2.5">
            <MessageSquare className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">ë¬¸ì˜?˜ê¸°</h1>
            <p className="text-slate-400 text-sm">?„ì²´ê´€ë¦¬ì?ê²Œ ë¬¸ì˜ë¥??¨ê¸°?¸ìš”</p>
          </div>
        </div>
        <Button onClick={() => { setNewTitle(''); setNewContent(''); setNewError(''); setNewOpen(true) }}
          className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
          <Plus className="h-4 w-4" />
          ??ë¬¸ì˜
        </Button>
      </div>

      {/* ë¬¸ì˜ ëª©ë¡ */}
      <Card className="bg-slate-800 border-slate-700">
        <CardHeader className="pb-3 border-b border-slate-700">
          <CardTitle className="text-white text-base flex items-center justify-between">
            <span>ë¬¸ì˜ ëª©ë¡</span>
            <span className="text-slate-400 text-sm font-normal">ì´?{totalCount}ê±?/span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="h-5 w-5 animate-spin text-blue-400" />
            </div>
          ) : inquiries.length === 0 ? (
            <div className="text-center text-slate-500 py-12">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm">?±ë¡??ë¬¸ì˜ê°€ ?†ìŠµ?ˆë‹¤.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-700">
              {inquiries.map((inq) => (
                <button
                  key={inq.id}
                  onClick={() => openDetail(inq.id)}
                  className="w-full text-left px-5 py-4 hover:bg-slate-700/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {inq.status === 'answered' ? (
                        <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                      ) : (
                        <Clock className="h-4 w-4 text-amber-400 shrink-0" />
                      )}
                      <span className="text-white font-medium truncate">{inq.title}</span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <Badge variant="outline" className={
                        inq.status === 'answered'
                          ? 'border-green-600 text-green-400 bg-green-950/30 text-xs'
                          : 'border-amber-600 text-amber-400 bg-amber-950/30 text-xs'
                      }>
                        {inq.status === 'answered' ? '?µë??„ë£Œ' : '?µë??€ê¸?}
                      </Badge>
                      <span className="text-slate-500 text-xs">{formatDate(inq.created_at)}</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ?˜ì´ì§€?¤ì´??*/}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1} className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-slate-400 text-sm px-3">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages} className="border-slate-600 text-slate-300 hover:bg-slate-700">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* ??ë¬¸ì˜ ?‘ì„± ?¤ì´?¼ë¡œê·?*/}
      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              ??ë¬¸ì˜ ?‘ì„±
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-medium">?œëª©</label>
              <Input value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="ë¬¸ì˜ ?œëª©???…ë ¥?˜ì„¸?? maxLength={100}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500" />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-300 font-medium">?´ìš©</label>
              <Textarea value={newContent} onChange={e => setNewContent(e.target.value)}
                placeholder="ë¬¸ì˜ ?´ìš©???…ë ¥?˜ì„¸?? rows={6} maxLength={2000}
                className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 resize-none" />
            </div>
            {newError && <p className="text-red-400 text-sm">{newError}</p>}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setNewOpen(false)}
                className="border-slate-600 text-slate-300 hover:bg-slate-700">ì·¨ì†Œ</Button>
              <Button onClick={handleNew} disabled={newLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2">
                {newLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                ?±ë¡
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ë¬¸ì˜ ?ì„¸ / ?¤ë ˆ???¤ì´?¼ë¡œê·?*/}
      <Dialog open={detailOpen} onOpenChange={(o) => { setDetailOpen(o); if (!o) realtimeRef.current?.unsubscribe() }}>
        <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-400" />
              {detailInquiry?.title ?? 'ë¬¸ì˜ ?ì„¸'}
              {detailInquiry && (
                <Badge variant="outline" className={
                  detailInquiry.status === 'answered'
                    ? 'border-green-600 text-green-400 bg-green-950/30 text-xs ml-2'
                    : 'border-amber-600 text-amber-400 bg-amber-950/30 text-xs ml-2'
                }>
                  {detailInquiry.status === 'answered' ? '?µë??„ë£Œ' : '?µë??€ê¸?}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          {detailLoading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
            </div>
          ) : (
            <>
              {/* ë©”ì‹œì§€ ?¤ë ˆ??*/}
              <div className="flex-1 overflow-y-auto space-y-3 py-2 min-h-0">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.sender_type === 'member' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-xl px-4 py-3 ${
                      msg.sender_type === 'member'
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-700 text-slate-100 border border-slate-600'
                    }`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-medium ${msg.sender_type === 'member' ? 'text-blue-200' : 'text-green-400'}`}>
                          {msg.sender_type === 'member' ? '?? : '?„ì²´ê´€ë¦¬ì'}
                        </span>
                        <span className={`text-xs ${msg.sender_type === 'member' ? 'text-blue-200' : 'text-slate-500'}`}>
                          {formatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* ?¬ë¬¸???…ë ¥ */}
              <div className="shrink-0 border-t border-slate-700 pt-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Textarea value={replyContent} onChange={e => setReplyContent(e.target.value)}
                    placeholder="ì¶”ê? ë¬¸ì˜ ?´ìš©???…ë ¥?˜ì„¸??.. (Shift+Enterë¡?ì¤„ë°”ê¿?"
                    rows={3} maxLength={2000}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleReply() }
                    }}
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 resize-none flex-1 text-sm" />
                  <Button onClick={handleReply} disabled={replyLoading || !replyContent.trim()}
                    className="bg-blue-600 hover:bg-blue-700 text-white self-end gap-1.5 shrink-0">
                    {replyLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    ?¬ë¬¸??
                  </Button>
                </div>
                {replyError && <p className="text-red-400 text-xs">{replyError}</p>}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
