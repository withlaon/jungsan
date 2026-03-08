'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Download, Megaphone, CheckCircle2, RefreshCw,
  AlignLeft, AlignCenter, AlignRight, Minus, Plus, Edit3,
  Trash2, Pencil, Clock, SaveAll, X,
} from 'lucide-react'
import { toast } from 'sonner'

// ──────────────────────────────────────────────
// 상수 / 타입
// ──────────────────────────────────────────────
const SIZE = 1080
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', sans-serif"
type TemplateId = 1 | 2 | 3 | 4
type Align     = 'left' | 'center' | 'right'
type StyleTab  = 'title' | 'content' | 'layout'
type EditZone  = 'title' | 'content' | null

interface StyleOptions {
  titleSize: number; contentSize: number
  titleColor: string; contentColor: string
  textAlign: Align; titleBold: boolean; verticalOffset: number
}
interface Bounds {
  title:   { y1: number; y2: number } | null
  content: { y1: number; y2: number } | null
}

const TEMPLATE_DEFAULTS: Record<TemplateId, StyleOptions> = {
  1: { titleSize: 72, contentSize: 40, titleColor: '#ffffff', contentColor: '#94a3b8', textAlign: 'left', titleBold: true,  verticalOffset: 0 },
  2: { titleSize: 64, contentSize: 38, titleColor: '#1e293b', contentColor: '#475569', textAlign: 'left', titleBold: true,  verticalOffset: 0 },
  3: { titleSize: 70, contentSize: 40, titleColor: '#ffffff', contentColor: '#a7f3d0', textAlign: 'left', titleBold: true,  verticalOffset: 0 },
  4: { titleSize: 66, contentSize: 38, titleColor: '#1c1917', contentColor: '#44403c', textAlign: 'left', titleBold: true,  verticalOffset: 0 },
}

const TEMPLATES = [
  { id: 1 as TemplateId, name: '다크 비즈니스', colors: ['#0c1228', '#0f2044'], accent: '#38bdf8' },
  { id: 2 as TemplateId, name: '클린 화이트',   colors: ['#1e40af', '#3b82f6'], accent: '#3b82f6' },
  { id: 3 as TemplateId, name: '에메랄드 그린', colors: ['#022c22', '#064e3b'], accent: '#34d399' },
  { id: 4 as TemplateId, name: '웜 오렌지',     colors: ['#ea580c', '#f97316'], accent: '#f97316' },
]

// ──────────────────────────────────────────────
// 공지사항 레코드 타입
// ──────────────────────────────────────────────
interface Notice {
  id: string
  title: string
  content: string
  date: string
  company_name: string
  template_id: TemplateId
  styles: StyleOptions
  thumbnail: string
  created_at: string
}

const THUMB = 320  // 썸네일 캔버스 크기

// 썸네일(320px) 생성 → base64 PNG 반환
function generateThumbnail(
  title: string, content: string, date: string, company: string,
  templateId: TemplateId, styles: StyleOptions,
): string {
  const off = document.createElement('canvas')
  off.width = THUMB; off.height = THUMB
  const ctx = off.getContext('2d')!
  // SIZE→THUMB 스케일로 동일한 draw 함수 호출하되,
  // ctx.scale로 축소 적용
  ctx.scale(THUMB / SIZE, THUMB / SIZE)
  const nb: Bounds = { title: null, content: null }
  const args = [ctx, title, content, date, company, styles, nb, null, null] as const
  switch (templateId) {
    case 1: drawT1(...args); break; case 2: drawT2(...args); break
    case 3: drawT3(...args); break; case 4: drawT4(...args); break
  }
  return off.toDataURL('image/jpeg', 0.7)
}

// overlay 기준: left pad, right pad (canvas 좌표)
const TPL_REGION: Record<TemplateId, { left: number; right: number }> = {
  1: { left: 90,  right: 90  },
  2: { left: 132, right: 60  },
  3: { left: 80,  right: 80  },
  4: { left: 110, right: 60  },
}

// ──────────────────────────────────────────────
// 캔버스 헬퍼
// ──────────────────────────────────────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return ['']
  const lines: string[] = []
  for (const para of text.split('\n')) {
    if (!para.trim()) { lines.push(''); continue }
    let line = ''
    for (const ch of para) {
      const test = line + ch
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = ch }
      else line = test
    }
    if (line) lines.push(line)
  }
  return lines.length ? lines : ['']
}

function xByAlign(align: Align, pad: number, rightPad = pad): number {
  if (align === 'center') return SIZE / 2
  if (align === 'right')  return SIZE - rightPad
  return pad
}

// 텍스트 존 공통 드로잉 (editingZone 지원)
function drawZone(
  ctx: CanvasRenderingContext2D,
  text: string,
  placeholder: string,
  leftPad: number,
  rightPad: number,
  startY: number,
  maxWidth: number,
  fontSize: number,
  weight: string,
  color: string,
  align: Align,
  lhMul: number,
  editingZone: EditZone,
  zone: 'title' | 'content',
): { y1: number; y2: number } {
  const isEditing = editingZone === zone
  const isEmpty   = !text.trim()
  const display   = isEmpty ? placeholder : text
  const lineH     = Math.round(fontSize * lhMul)
  const effAlign: Align = isEmpty ? 'left' : align

  ctx.globalAlpha = isEditing ? 0.06 : isEmpty ? 0.22 : 1.0
  ctx.font = `${isEmpty ? '400' : weight} ${fontSize}px ${FONT}`
  ctx.fillStyle = isEmpty ? '#94a3b8' : color
  ctx.textAlign  = effAlign

  const lines = wrapText(ctx, display, maxWidth)
  let curY = startY
  for (const l of lines) {
    if (!l) { curY += lineH * 0.4; continue }
    ctx.fillText(l, xByAlign(effAlign, leftPad, rightPad), curY)
    curY += lineH
  }
  ctx.globalAlpha = 1.0
  return { y1: startY, y2: curY }
}

// 선택 하이라이트
function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  selection: 'title' | 'content' | null,
  bounds: Bounds,
) {
  const b = selection === 'title' ? bounds.title : selection === 'content' ? bounds.content : null
  if (!b) return
  const pad = 14
  const y = Math.max(0, b.y1 - pad)
  const h = Math.min(SIZE - y, (b.y2 - b.y1) + pad * 2)
  ctx.save()
  ctx.fillStyle = 'rgba(59,130,246,0.10)'
  ctx.fillRect(0, y, SIZE, h)
  ctx.strokeStyle = 'rgba(59,130,246,0.80)'
  ctx.lineWidth = 6; ctx.setLineDash([20, 10])
  ctx.strokeRect(4, y + 4, SIZE - 8, h - 8)
  ctx.setLineDash([]); ctx.restore()
}

// ──────────────────────────────────────────────
// Template 1: 다크 비즈니스
// ──────────────────────────────────────────────
function drawT1(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string, s: StyleOptions, bounds: Bounds, editingZone: EditZone, selection: 'title' | 'content' | null) {
  bounds.title = null; bounds.content = null
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  bg.addColorStop(0, '#0c1228'); bg.addColorStop(1, '#0f2044')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = 'rgba(255,255,255,0.025)'
  for (let x = 50; x < SIZE; x += 70) for (let y = 50; y < SIZE; y += 70) { ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill() }
  const topBar = ctx.createLinearGradient(0, 0, SIZE, 0)
  topBar.addColorStop(0, '#06b6d4'); topBar.addColorStop(0.5, '#3b82f6'); topBar.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = topBar; ctx.fillRect(0, 0, SIZE, 12)
  ctx.beginPath(); ctx.arc(SIZE + 100, -100, 380, 0, Math.PI * 2); ctx.fillStyle = 'rgba(59,130,246,0.07)'; ctx.fill()
  const PAD = 90
  if (company) { ctx.font = `500 30px ${FONT}`; ctx.fillStyle = '#64748b'; ctx.textAlign = 'left'; ctx.fillText(company, PAD, 90) }
  if (date)    { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#475569'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - PAD, 90) }
  ctx.strokeStyle = 'rgba(51,65,85,0.8)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(PAD, 118); ctx.lineTo(SIZE - PAD, 118); ctx.stroke()
  ctx.font = `700 28px ${FONT}`; ctx.fillStyle = '#38bdf8'; ctx.textAlign = 'left'; ctx.fillText('📢  공지사항', PAD, 170)

  let curY = 230 + s.verticalOffset
  const tr = drawZone(ctx, title, '✏  제목 영역 — 클릭하여 입력', PAD, PAD, curY, SIZE - PAD * 2, s.titleSize, s.titleBold ? '800' : '500', s.titleColor, s.textAlign, 1.25, editingZone, 'title')
  curY = tr.y2 + 12; bounds.title = { y1: tr.y1, y2: curY }
  if (title.trim() && editingZone !== 'title') {
    const ag = ctx.createLinearGradient(PAD, 0, PAD + 200, 0); ag.addColorStop(0, '#06b6d4'); ag.addColorStop(1, 'transparent')
    ctx.strokeStyle = ag; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(PAD + 200, curY); ctx.stroke()
  }
  curY += 36
  const cr = drawZone(ctx, content, '✏  내용 영역 — 클릭하여 입력', PAD, PAD, curY, SIZE - PAD * 2, s.contentSize, '400', s.contentColor, s.textAlign, 1.5, editingZone, 'content')
  bounds.content = { y1: cr.y1, y2: cr.y2 }
  ctx.fillStyle = topBar; ctx.fillRect(0, SIZE - 12, SIZE, 12)
  drawSelectionOverlay(ctx, selection, bounds)
}

// ──────────────────────────────────────────────
// Template 2: 클린 화이트
// ──────────────────────────────────────────────
function drawT2(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string, s: StyleOptions, bounds: Bounds, editingZone: EditZone, selection: 'title' | 'content' | null) {
  bounds.title = null; bounds.content = null
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, SIZE, SIZE)
  const headerH = 240
  const hg = ctx.createLinearGradient(0, 0, SIZE, 0); hg.addColorStop(0, '#1e40af'); hg.addColorStop(1, '#3b82f6')
  ctx.fillStyle = hg; ctx.fillRect(0, 0, SIZE, headerH)
  ctx.beginPath(); ctx.arc(SIZE - 80, headerH / 2, 220, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill()
  ctx.beginPath(); ctx.arc(SIZE - 80, headerH / 2, 140, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill()
  ctx.font = `800 52px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText('공지사항', 80, 120)
  if (company) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(company, 80, 170) }
  if (date)    { ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - 80, 170) }
  const cardX = 60, cardY = 290, cardW = SIZE - 120, cardH = SIZE - 360
  ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 8; ctx.fillStyle = '#ffffff'
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 24); else ctx.rect(cardX, cardY, cardW, cardH)
  ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(cardX, cardY, 8, cardH)

  const lPad = cardX + 72, rPad = 60, maxW = cardW - 72 - 20
  const xT2 = (align: Align) => align === 'left' ? lPad : align === 'right' ? SIZE - rPad : SIZE / 2

  let curY = cardY + 76 + s.verticalOffset

  // Title
  {
    const isEditing = editingZone === 'title', isEmpty = !title.trim()
    const display = isEmpty ? '✏  제목 영역 — 클릭하여 입력' : title
    const weight  = s.titleBold ? '800' : '500'
    const lineH   = Math.round(s.titleSize * 1.25)
    const effAlign: Align = isEmpty ? 'left' : s.textAlign
    const y1 = curY
    ctx.globalAlpha = isEditing ? 0.06 : isEmpty ? 0.22 : 1.0
    ctx.font = `${isEmpty ? '400' : weight} ${s.titleSize}px ${FONT}`
    ctx.fillStyle = isEmpty ? '#94a3b8' : s.titleColor; ctx.textAlign = effAlign
    const lines = wrapText(ctx, display, maxW)
    for (const l of lines) { if (!l) { curY += lineH * 0.3; continue }; ctx.fillText(l, xT2(effAlign), curY); curY += lineH }
    curY += 8; ctx.globalAlpha = 1.0; bounds.title = { y1, y2: curY }
    if (title.trim() && !isEditing) { ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(lPad, curY); ctx.lineTo(lPad + maxW, curY); ctx.stroke() }
    curY += 44
  }
  // Content
  {
    const isEditing = editingZone === 'content', isEmpty = !content.trim()
    const display = isEmpty ? '✏  내용 영역 — 클릭하여 입력' : content
    const lineH = Math.round(s.contentSize * 1.5)
    const effAlign: Align = isEmpty ? 'left' : s.textAlign
    const y1 = curY
    ctx.globalAlpha = isEditing ? 0.06 : isEmpty ? 0.22 : 1.0
    ctx.font = `400 ${s.contentSize}px ${FONT}`; ctx.fillStyle = isEmpty ? '#94a3b8' : s.contentColor; ctx.textAlign = effAlign
    const lines = wrapText(ctx, display, maxW)
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xT2(effAlign), curY); curY += lineH }
    ctx.globalAlpha = 1.0; bounds.content = { y1, y2: curY }
  }
  drawSelectionOverlay(ctx, selection, bounds)
}

// ──────────────────────────────────────────────
// Template 3: 에메랄드 그린
// ──────────────────────────────────────────────
function drawT3(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string, s: StyleOptions, bounds: Bounds, editingZone: EditZone, selection: 'title' | 'content' | null) {
  bounds.title = null; bounds.content = null
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE); bg.addColorStop(0, '#022c22'); bg.addColorStop(1, '#064e3b')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.beginPath(); ctx.arc(SIZE, 0, 500, 0, Math.PI * 2); ctx.fillStyle = 'rgba(16,185,129,0.06)'; ctx.fill()
  ctx.beginPath(); ctx.arc(0, SIZE, 400, 0, Math.PI * 2); ctx.fillStyle = 'rgba(16,185,129,0.05)'; ctx.fill()
  const vBar = ctx.createLinearGradient(0, 0, 0, SIZE); vBar.addColorStop(0, '#34d399'); vBar.addColorStop(1, '#059669')
  ctx.fillStyle = vBar; ctx.fillRect(0, 0, 10, SIZE)
  const PAD = 80
  ctx.font = `700 30px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'left'; ctx.fillText('📢  N O T I C E', PAD, 95)
  if (company) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'right'; ctx.fillText(company, SIZE - PAD, 95) }
  const gg = ctx.createLinearGradient(PAD, 0, SIZE - PAD, 0); gg.addColorStop(0, 'transparent'); gg.addColorStop(0.15, '#fbbf24'); gg.addColorStop(0.85, '#fbbf24'); gg.addColorStop(1, 'transparent')
  ctx.strokeStyle = gg; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(PAD, 124); ctx.lineTo(SIZE - PAD, 124); ctx.stroke()

  let curY = 220 + s.verticalOffset
  const tr = drawZone(ctx, title, '✏  제목 영역 — 클릭하여 입력', PAD, PAD, curY, SIZE - PAD * 2, s.titleSize, s.titleBold ? '800' : '500', s.titleColor, s.textAlign, 1.25, editingZone, 'title')
  curY = tr.y2 + 10; bounds.title = { y1: tr.y1, y2: curY }
  if (title.trim() && editingZone !== 'title') { ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(PAD + 120, curY); ctx.stroke() }
  curY += 46
  const cr = drawZone(ctx, content, '✏  내용 영역 — 클릭하여 입력', PAD, PAD, curY, SIZE - PAD * 2, s.contentSize, '400', s.contentColor, s.textAlign, 1.5, editingZone, 'content')
  bounds.content = { y1: cr.y1, y2: cr.y2 }
  if (date) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - PAD, SIZE - 56) }
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, SIZE - 8, SIZE, 8)
  drawSelectionOverlay(ctx, selection, bounds)
}

// ──────────────────────────────────────────────
// Template 4: 웜 오렌지
// ──────────────────────────────────────────────
function drawT4(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string, s: StyleOptions, bounds: Bounds, editingZone: EditZone, selection: 'title' | 'content' | null) {
  bounds.title = null; bounds.content = null
  ctx.fillStyle = '#fef3c7'; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#fffbf5'; ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(40, 40, SIZE - 80, SIZE - 80, 0); else ctx.rect(40, 40, SIZE - 80, SIZE - 80); ctx.fill()
  const headerH = 200
  const og = ctx.createLinearGradient(0, 0, SIZE, 0); og.addColorStop(0, '#ea580c'); og.addColorStop(1, '#f97316')
  ctx.fillStyle = og; ctx.fillRect(40, 40, SIZE - 80, headerH)
  ctx.beginPath(); ctx.arc(SIZE - 100, 40 + headerH / 2, 160, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill()
  ctx.font = `800 48px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText('공지사항', 110, 40 + 96)
  if (company) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(company, 110, 40 + 152) }
  if (date)    { ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - 110, 40 + 152) }
  ctx.fillStyle = og; ctx.fillRect(40, 40 + headerH, 8, SIZE - 80 - headerH)
  const PAD = 110

  let curY = 40 + headerH + 90 + s.verticalOffset
  const tr = drawZone(ctx, title, '✏  제목 영역 — 클릭하여 입력', PAD, 60, curY, SIZE - PAD - 60, s.titleSize, s.titleBold ? '800' : '500', s.titleColor, s.textAlign, 1.25, editingZone, 'title')
  curY = tr.y2 + 8; bounds.title = { y1: tr.y1, y2: curY }
  if (title.trim() && editingZone !== 'title') { ctx.fillStyle = '#f97316'; ctx.fillRect(PAD, curY, 80, 6) }
  curY += 44
  const cr = drawZone(ctx, content, '✏  내용 영역 — 클릭하여 입력', PAD, 60, curY, SIZE - PAD - 60, s.contentSize, '400', s.contentColor, s.textAlign, 1.5, editingZone, 'content')
  bounds.content = { y1: cr.y1, y2: cr.y2 }
  ctx.fillStyle = og; ctx.fillRect(40, SIZE - 48, SIZE - 80, 8)
  drawSelectionOverlay(ctx, selection, bounds)
}

// ──────────────────────────────────────────────
// 컴팩트 컨트롤
// ──────────────────────────────────────────────
function SizeRow({ label, value, min, max, step = 2, onChange }: {
  label: string; value: number; min: number; max: number; step?: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2 h-7">
      <span className="text-slate-400 text-xs w-14 shrink-0">{label}</span>
      <button onClick={() => onChange(Math.max(min, value - step))} className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center shrink-0"><Minus className="h-2.5 w-2.5 text-slate-300" /></button>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e => onChange(Number(e.target.value))} className="flex-1 h-1 rounded-full accent-blue-500 cursor-pointer" />
      <button onClick={() => onChange(Math.min(max, value + step))} className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center shrink-0"><Plus className="h-2.5 w-2.5 text-slate-300" /></button>
      <span className="text-white text-xs font-mono w-7 text-right shrink-0">{value}</span>
    </div>
  )
}
function ColorRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2 h-7">
      <span className="text-slate-400 text-xs w-14 shrink-0">{label}</span>
      <label className="relative cursor-pointer flex items-center gap-2">
        <div className="w-6 h-6 rounded border border-slate-600 shrink-0" style={{ background: value }} />
        <span className="text-slate-400 text-xs font-mono">{value.toUpperCase()}</span>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
      </label>
    </div>
  )
}

// ──────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────
export default function NoticePage() {
  const supabase     = createClient()
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const wrapperRef   = useRef<HTMLDivElement>(null)
  const boundsRef    = useRef<Bounds>({ title: null, content: null })
  const overlayRef   = useRef<HTMLTextAreaElement>(null)

  const [selectedTpl, setSelectedTpl]         = useState<TemplateId>(1)
  const [title, setTitle]                     = useState('')
  const [content, setContent]                 = useState('')
  const [date, setDate]                       = useState(() =>
    new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  )
  const [companyName, setCompanyName]         = useState('')
  const [styles, setStyles]                   = useState<StyleOptions>(TEMPLATE_DEFAULTS[1])
  const [styleTab, setStyleTab]               = useState<StyleTab>('title')
  const [canvasSelection, setCanvasSelection] = useState<'title' | 'content' | null>(null)
  const [editingZone, setEditingZone]         = useState<EditZone>(null)
  const [overlayBounds, setOverlayBounds]     = useState<{ y1: number; y2: number } | null>(null)
  const [canvasCursor, setCanvasCursor]       = useState('default')
  const [displayScale, setDisplayScale]       = useState(1)
  const [notices, setNotices]                 = useState<Notice[]>([])
  const [noticesLoading, setNoticesLoading]   = useState(false)
  const [editingNoticeId, setEditingNoticeId] = useState<string | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)

  const setStyle = <K extends keyof StyleOptions>(key: K, val: StyleOptions[K]) =>
    setStyles(prev => ({ ...prev, [key]: val }))

  // 디스플레이 스케일 추적
  useEffect(() => {
    const update = () => {
      if (wrapperRef.current) setDisplayScale(wrapperRef.current.offsetWidth / SIZE)
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // 템플릿 전환
  const handleSelectTpl = (id: TemplateId) => {
    setSelectedTpl(id); setStyles(TEMPLATE_DEFAULTS[id])
    setCanvasSelection(null); setEditingZone(null); setOverlayBounds(null)
  }

  // 회사명 자동 로드
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('company_name').eq('id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.company_name) setCompanyName(data.company_name) })
    })
  }, [])

  // 공지사항 목록 로드
  const fetchNotices = useCallback(async () => {
    setNoticesLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setNoticesLoading(false); return }
    const { data } = await supabase
      .from('notices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setNotices((data ?? []) as Notice[])
    setNoticesLoading(false)
  }, [])

  useEffect(() => { fetchNotices() }, [fetchNotices])

  // 공지사항 저장 (DB)
  const saveNotice = async (thumbnail: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    if (editingNoticeId) {
      // 기존 항목 수정
      await supabase.from('notices').update({
        title, content, date, company_name: companyName,
        template_id: selectedTpl, styles, thumbnail,
      }).eq('id', editingNoticeId).eq('user_id', user.id)
      toast.success('공지사항이 업데이트되었습니다.')
    } else {
      // 신규 등록
      await supabase.from('notices').insert({
        user_id: user.id, title, content, date, company_name: companyName,
        template_id: selectedTpl, styles, thumbnail,
      })
      toast.success('공지사항이 저장되었습니다.')
    }
    setEditingNoticeId(null)
    fetchNotices()
  }

  // 공지사항 삭제
  const handleDeleteNotice = async (id: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('notices').delete().eq('id', id).eq('user_id', user.id)
    setDeleteConfirmId(null)
    if (editingNoticeId === id) { setEditingNoticeId(null) }
    toast.success('공지사항이 삭제되었습니다.')
    fetchNotices()
  }

  // 공지사항 수정 (에디터에 로드)
  const handleEditNotice = (notice: Notice) => {
    setTitle(notice.title)
    setContent(notice.content)
    setDate(notice.date)
    setCompanyName(notice.company_name)
    setSelectedTpl(notice.template_id)
    setStyles(notice.styles as StyleOptions)
    setEditingNoticeId(notice.id)
    setCanvasSelection(null); setEditingZone(null); setOverlayBounds(null)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // 캔버스 렌더
  const render = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx    = canvas.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, SIZE, SIZE)
    const nb: Bounds = { title: null, content: null }
    const args = [ctx, title, content, date, companyName, styles, nb, editingZone, canvasSelection] as const
    switch (selectedTpl) {
      case 1: drawT1(...args); break
      case 2: drawT2(...args); break
      case 3: drawT3(...args); break
      case 4: drawT4(...args); break
    }
    boundsRef.current = nb
  }, [selectedTpl, title, content, date, companyName, styles, editingZone, canvasSelection])

  useEffect(() => { render() }, [render])

  // 오버레이 textarea 자동 포커스
  useEffect(() => {
    if (editingZone && overlayRef.current) {
      overlayRef.current.focus()
      const len = overlayRef.current.value.length
      overlayRef.current.setSelectionRange(len, len)
    }
  }, [editingZone])

  // 캔버스 좌표 변환
  const getCanvasY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return -1
    return (e.clientY - canvas.getBoundingClientRect().top) * (SIZE / canvas.getBoundingClientRect().height)
  }
  const inBounds = (y: number, b: { y1: number; y2: number } | null, pad = 20) =>
    b ? y >= b.y1 - pad && y <= b.y2 + pad : false

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const y = getCanvasY(e); const b = boundsRef.current
    setCanvasCursor(inBounds(y, b.title) || inBounds(y, b.content) ? 'text' : 'default')
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const y = getCanvasY(e); const b = boundsRef.current
    if (inBounds(y, b.title)) {
      setEditingZone('title'); setCanvasSelection('title'); setStyleTab('title')
      setOverlayBounds(b.title)
    } else if (inBounds(y, b.content)) {
      setEditingZone('content'); setCanvasSelection('content'); setStyleTab('content')
      setOverlayBounds(b.content)
    } else {
      setEditingZone(null); setOverlayBounds(null); setCanvasSelection(null)
    }
  }

  // 오버레이 닫기
  const closeOverlay = () => {
    setEditingZone(null); setOverlayBounds(null)
  }

  // 스타일 탭 ↔ 캔버스 선택 동기화
  const handleTabChange = (tab: StyleTab) => {
    setStyleTab(tab); setCanvasSelection(tab === 'layout' ? null : tab)
    if (tab !== 'layout') setEditingZone(null)
  }

  // 다운로드 + DB 저장
  const handleDownload = async () => {
    // 1) 전체 해상도 캔버스 → 다운로드
    const off = document.createElement('canvas'); off.width = SIZE; off.height = SIZE
    const ctx = off.getContext('2d')!
    const nb: Bounds = { title: null, content: null }
    const args = [ctx, title, content, date, companyName, styles, nb, null, null] as const
    switch (selectedTpl) {
      case 1: drawT1(...args); break; case 2: drawT2(...args); break
      case 3: drawT3(...args); break; case 4: drawT4(...args); break
    }
    const a = document.createElement('a'); a.href = off.toDataURL('image/png')
    a.download = `공지사항_${title || '이미지'}.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
    // 2) 썸네일 생성 → DB 저장
    const thumb = generateThumbnail(title, content, date, companyName, selectedTpl, styles)
    await saveNotice(thumb)
  }

  const handleReset = () => {
    setTitle(''); setContent('')
    setDate(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }))
    setStyles(TEMPLATE_DEFAULTS[selectedTpl]); setCanvasSelection(null)
    setEditingZone(null); setOverlayBounds(null); setEditingNoticeId(null)
  }

  // 오버레이 위치 계산
  const reg   = TPL_REGION[selectedTpl]
  const oLeft = reg.left  * displayScale
  const oW    = (SIZE - reg.left - reg.right) * displayScale
  const oTop  = overlayBounds ? Math.max(0, (overlayBounds.y1 - 14) * displayScale) : 0
  const oMinH = overlayBounds ? Math.max(60, (overlayBounds.y2 - overlayBounds.y1 + 28) * displayScale) : 60
  const oFS   = (editingZone === 'title' ? styles.titleSize : styles.contentSize) * displayScale
  const oColor = editingZone === 'title' ? styles.titleColor : styles.contentColor
  const oFW   = editingZone === 'title' && styles.titleBold ? '700' : '400'
  const oLH   = editingZone === 'title' ? 1.3 : 1.5

  const tplConfig = TEMPLATES.find(t => t.id === selectedTpl)!

  const tabCls = (tab: StyleTab) =>
    `flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
      styleTab === tab ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-slate-200'
    }`

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-blue-400" />공지사항 생성
        </h2>
        <p className="text-slate-400 text-sm mt-1">라이더에게 문자·카카오톡으로 발송할 공지 이미지를 생성하세요</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* ── 왼쪽 ── */}
        <div className="space-y-4">

          {/* 템플릿 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">① 배경 템플릿 선택</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map(tpl => (
                  <button key={tpl.id} onClick={() => handleSelectTpl(tpl.id)}
                    className={`rounded-xl overflow-hidden border-2 transition-all ${
                      selectedTpl === tpl.id
                        ? 'border-blue-500 ring-2 ring-blue-500/40 scale-[0.97]'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}>
                    <div className="h-14 w-full flex flex-col items-start justify-end p-2 gap-1"
                      style={{ background: `linear-gradient(135deg, ${tpl.colors[0]}, ${tpl.colors[1]})` }}>
                      <div className="h-1.5 rounded-full opacity-80" style={{ width: '55%', background: tpl.accent }} />
                      <div className="h-1 rounded-full opacity-35 bg-white" style={{ width: '75%' }} />
                    </div>
                    <div className="bg-slate-800 px-2 py-1.5 flex items-center justify-between">
                      <span className="text-slate-300 text-xs font-medium">{tpl.name}</span>
                      {selectedTpl === tpl.id && <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 기본 정보 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm">② 기본 정보</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">회사명</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="회사명" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                </div>
                <div className="space-y-1">
                  <Label className="text-slate-400 text-xs">날짜</Label>
                  <Input value={date} onChange={e => setDate(e.target.value)}
                    placeholder="날짜" className="bg-slate-800 border-slate-600 text-white h-8 text-sm" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 안내 */}
          <Card className="border-blue-900/50 bg-blue-950/30">
            <CardContent className="pt-4 pb-3 space-y-2">
              <p className="text-blue-300 text-xs font-medium flex items-center gap-1.5">
                <Edit3 className="h-3.5 w-3.5" />오른쪽 미리보기에서 직접 편집
              </p>
              <ul className="text-slate-400 text-xs space-y-1 pl-5 list-disc">
                <li><span className="text-white">제목/내용 영역 클릭</span> → 텍스트 직접 입력</li>
                <li>입력 후 <kbd className="bg-slate-700 px-1 py-0.5 rounded text-xs">Esc</kbd> 또는 영역 밖 클릭으로 완료</li>
                <li>클릭 선택 후 아래 스타일 패널에서 서식 편집</li>
              </ul>
            </CardContent>
          </Card>

          {/* 편집 중 알림 */}
          {editingNoticeId && (
            <div className="flex items-center gap-2 bg-amber-900/30 border border-amber-700/50 rounded-lg px-3 py-2">
              <Pencil className="h-4 w-4 text-amber-400 shrink-0" />
              <span className="text-amber-300 text-xs flex-1">저장된 공지사항 수정 중</span>
              <button onClick={() => setEditingNoticeId(null)}
                className="text-amber-500 hover:text-amber-300"><X className="h-4 w-4" /></button>
            </div>
          )}

          {/* 액션 */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}
              className="border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white gap-2">
              <RefreshCw className="h-4 w-4" />초기화
            </Button>
            <Button onClick={handleDownload} className="flex-1 gap-2"
              style={{ background: editingNoticeId ? '#d97706' : tplConfig.accent }}
              disabled={!title && !content}>
              {editingNoticeId
                ? <><SaveAll className="h-4 w-4" />업데이트 & 다운로드</>
                : <><Download className="h-4 w-4" />다운로드 & 저장</>}
            </Button>
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 + 스타일 패널 ── */}
        <div className="space-y-3">

          {/* 캔버스 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm font-medium">③ 실시간 미리보기 (클릭하여 직접 편집)</p>
              <span className="text-slate-600 text-xs">1080×1080px</span>
            </div>

            {/* 캔버스 + 오버레이 래퍼 */}
            <div ref={wrapperRef} className="relative rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
              <canvas
                ref={canvasRef}
                width={SIZE} height={SIZE}
                className="w-full aspect-square block"
                style={{ cursor: canvasCursor }}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => setCanvasCursor('default')}
              />

              {/* 텍스트 입력 오버레이 */}
              {editingZone && overlayBounds && (
                <textarea
                  ref={overlayRef}
                  value={editingZone === 'title' ? title : content}
                  onChange={e => {
                    if (editingZone === 'title') setTitle(e.target.value)
                    else setContent(e.target.value)
                  }}
                  onBlur={closeOverlay}
                  onKeyDown={e => { if (e.key === 'Escape') e.currentTarget.blur() }}
                  placeholder={editingZone === 'title' ? '제목을 입력하세요...' : '내용을 입력하세요...'}
                  maxLength={editingZone === 'title' ? 40 : 400}
                  style={{
                    position: 'absolute',
                    top: oTop, left: oLeft,
                    width: oW, minHeight: oMinH,
                    fontSize: oFS, color: oColor,
                    fontWeight: oFW,
                    lineHeight: oLH,
                    fontFamily: "'Malgun Gothic','Noto Sans KR',sans-serif",
                    textAlign: styles.textAlign,
                    background: 'rgba(2,6,30,0.88)',
                    backdropFilter: 'blur(6px)',
                    border: '2.5px solid rgba(59,130,246,0.75)',
                    borderRadius: 8,
                    padding: `${Math.round(10 * displayScale)}px ${Math.round(14 * displayScale)}px`,
                    resize: 'none',
                    outline: 'none',
                    zIndex: 20,
                    boxShadow: '0 0 0 4px rgba(59,130,246,0.18), 0 8px 32px rgba(0,0,0,0.5)',
                    overflowY: 'hidden',
                  }}
                />
              )}

              {/* 편집 중 레이블 */}
              {editingZone && (
                <div className="absolute top-2 right-2 bg-blue-600 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1 z-30 pointer-events-none">
                  <Edit3 className="h-3 w-3" />
                  {editingZone === 'title' ? '제목 편집 중' : '내용 편집 중'}
                </div>
              )}
            </div>
          </div>

          {/* 스타일 패널 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardContent className="p-3 space-y-3">
              <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                {(['title', 'content', 'layout'] as StyleTab[]).map(tab => (
                  <button key={tab} onClick={() => handleTabChange(tab)} className={tabCls(tab)}>
                    {tab === 'title' ? '제목 스타일' : tab === 'content' ? '내용 스타일' : '배치'}
                  </button>
                ))}
              </div>

              {styleTab === 'title' && (
                <div className="space-y-2">
                  <SizeRow label="글씨 크기" value={styles.titleSize}   min={40}   max={120}  onChange={v => setStyle('titleSize',   v)} />
                  <ColorRow label="글씨 색상" value={styles.titleColor}  onChange={v => setStyle('titleColor',  v)} />
                  <div className="flex items-center gap-2 h-7">
                    <span className="text-slate-400 text-xs w-14 shrink-0">굵게</span>
                    <button onClick={() => setStyle('titleBold', !styles.titleBold)}
                      className={`w-9 h-5 rounded-full transition-colors relative shrink-0 ${styles.titleBold ? 'bg-blue-600' : 'bg-slate-700'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${styles.titleBold ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                    <span className="text-slate-500 text-xs">{styles.titleBold ? 'ON' : 'OFF'}</span>
                  </div>
                </div>
              )}

              {styleTab === 'content' && (
                <div className="space-y-2">
                  <SizeRow  label="글씨 크기" value={styles.contentSize}  min={24}   max={72}   onChange={v => setStyle('contentSize',  v)} />
                  <ColorRow label="글씨 색상" value={styles.contentColor} onChange={v => setStyle('contentColor', v)} />
                </div>
              )}

              {styleTab === 'layout' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 h-7">
                    <span className="text-slate-400 text-xs w-14 shrink-0">정렬</span>
                    <div className="flex gap-1">
                      {([{ v: 'left' as Align, Icon: AlignLeft }, { v: 'center' as Align, Icon: AlignCenter }, { v: 'right' as Align, Icon: AlignRight }]).map(({ v, Icon }) => (
                        <button key={v} onClick={() => setStyle('textAlign', v)}
                          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${styles.textAlign === v ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <SizeRow label="수직 위치" value={styles.verticalOffset} min={-200} max={200} step={10} onChange={v => setStyle('verticalOffset', v)} />
                  <p className="text-slate-600 text-xs pl-16">음수 = 위로, 양수 = 아래로</p>
                  <button onClick={() => setStyles(TEMPLATE_DEFAULTS[selectedTpl])}
                    className="text-slate-500 hover:text-slate-300 text-xs underline underline-offset-2 pl-16">
                    기본값 초기화
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

        </div>
      </div>

      {/* ── 저장된 공지사항 목록 ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Clock className="h-5 w-5 text-slate-400" />
            저장된 공지사항
            <span className="bg-slate-700 text-slate-300 text-xs px-2 py-0.5 rounded-full">{notices.length}</span>
          </h3>
          <button onClick={fetchNotices} className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1">
            <RefreshCw className="h-3 w-3" />새로고침
          </button>
        </div>

        {noticesLoading ? (
          <div className="text-slate-500 text-sm text-center py-8">불러오는 중...</div>
        ) : notices.length === 0 ? (
          <div className="border border-dashed border-slate-700 rounded-xl py-12 text-center">
            <Megaphone className="h-10 w-10 text-slate-700 mx-auto mb-3" />
            <p className="text-slate-500 text-sm">아직 저장된 공지사항이 없습니다</p>
            <p className="text-slate-600 text-xs mt-1">이미지를 다운로드하면 자동으로 여기에 저장됩니다</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {notices.map(notice => {
              const tpl = TEMPLATES.find(t => t.id === notice.template_id)!
              const isEditing = editingNoticeId === notice.id
              const isConfirmDelete = deleteConfirmId === notice.id
              return (
                <div key={notice.id}
                  className={`rounded-xl overflow-hidden border transition-all ${
                    isEditing
                      ? 'border-amber-500 ring-2 ring-amber-500/30'
                      : 'border-slate-700 hover:border-slate-500'
                  }`}>
                  {/* 썸네일 */}
                  <div className="relative aspect-square overflow-hidden bg-slate-900">
                    {notice.thumbnail
                      ? <img src={notice.thumbnail} alt={notice.title} className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"
                          style={{ background: `linear-gradient(135deg, ${tpl.colors[0]}, ${tpl.colors[1]})` }}>
                          <Megaphone className="h-8 w-8 opacity-40 text-white" />
                        </div>
                    }
                    {isEditing && (
                      <div className="absolute inset-0 bg-amber-900/30 flex items-center justify-center">
                        <span className="bg-amber-500 text-white text-xs px-2 py-1 rounded-full font-medium">수정 중</span>
                      </div>
                    )}
                  </div>

                  {/* 정보 */}
                  <div className="bg-slate-900 p-2.5 space-y-1.5">
                    <p className="text-white text-xs font-medium truncate">{notice.title || '(제목 없음)'}</p>
                    <p className="text-slate-500 text-xs truncate">{notice.date}</p>

                    {/* 삭제 확인 */}
                    {isConfirmDelete ? (
                      <div className="space-y-1.5 pt-0.5">
                        <p className="text-red-400 text-xs text-center">삭제하시겠습니까?</p>
                        <div className="flex gap-1">
                          <button onClick={() => handleDeleteNotice(notice.id)}
                            className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs py-1 rounded transition-colors">
                            삭제
                          </button>
                          <button onClick={() => setDeleteConfirmId(null)}
                            className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs py-1 rounded transition-colors">
                            취소
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-1 pt-0.5">
                        <button
                          onClick={() => handleEditNotice(notice)}
                          className="flex-1 bg-slate-700 hover:bg-blue-700 text-slate-300 hover:text-white text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors">
                          <Pencil className="h-3 w-3" />수정
                        </button>
                        <button
                          onClick={() => setDeleteConfirmId(notice.id)}
                          className="flex-1 bg-slate-700 hover:bg-red-800 text-slate-300 hover:text-white text-xs py-1.5 rounded flex items-center justify-center gap-1 transition-colors">
                          <Trash2 className="h-3 w-3" />삭제
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

    </div>
  )
}
