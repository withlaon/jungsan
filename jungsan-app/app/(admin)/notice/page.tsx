'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Download, Megaphone, CheckCircle2, RefreshCw,
  AlignLeft, AlignCenter, AlignRight, Minus, Plus, MousePointer2,
} from 'lucide-react'

// ──────────────────────────────────────────────
// 상수 / 타입
// ──────────────────────────────────────────────
const SIZE = 1080
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', sans-serif"
type TemplateId = 1 | 2 | 3 | 4
type Align = 'left' | 'center' | 'right'
type StyleTab = 'title' | 'content' | 'layout'

interface StyleOptions {
  titleSize: number       // 40~120
  contentSize: number     // 24~72
  titleColor: string
  contentColor: string
  textAlign: Align
  titleBold: boolean
  verticalOffset: number  // -200~200
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
// 헬퍼
// ──────────────────────────────────────────────
function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (!text) return []
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
  return lines
}

function xByAlign(align: Align, pad: number): number {
  if (align === 'center') return SIZE / 2
  if (align === 'right')  return SIZE - pad
  return pad
}

// ──────────────────────────────────────────────
// Template 1: 다크 비즈니스
// ──────────────────────────────────────────────
function drawT1(
  ctx: CanvasRenderingContext2D,
  title: string, content: string, date: string, company: string,
  s: StyleOptions, bounds: Bounds,
) {
  bounds.title = null; bounds.content = null

  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  bg.addColorStop(0, '#0c1228'); bg.addColorStop(1, '#0f2044')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.fillStyle = 'rgba(255,255,255,0.025)'
  for (let x = 50; x < SIZE; x += 70)
    for (let y = 50; y < SIZE; y += 70) {
      ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill()
    }

  const topBar = ctx.createLinearGradient(0, 0, SIZE, 0)
  topBar.addColorStop(0, '#06b6d4'); topBar.addColorStop(0.5, '#3b82f6'); topBar.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = topBar; ctx.fillRect(0, 0, SIZE, 12)

  ctx.beginPath(); ctx.arc(SIZE + 100, -100, 380, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(59,130,246,0.07)'; ctx.fill()

  const PAD = 90
  if (company) { ctx.font = `500 30px ${FONT}`; ctx.fillStyle = '#64748b'; ctx.textAlign = 'left'; ctx.fillText(company, PAD, 90) }
  if (date)    { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#475569'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - PAD, 90) }

  ctx.strokeStyle = 'rgba(51,65,85,0.8)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, 118); ctx.lineTo(SIZE - PAD, 118); ctx.stroke()

  ctx.font = `700 28px ${FONT}`; ctx.fillStyle = '#38bdf8'; ctx.textAlign = 'left'
  ctx.fillText('📢  공지사항', PAD, 170)

  let curY = 230 + s.verticalOffset

  if (title) {
    const titleY1 = curY
    const weight = s.titleBold ? '800' : '500'
    ctx.font = `${weight} ${s.titleSize}px ${FONT}`; ctx.fillStyle = s.titleColor; ctx.textAlign = s.textAlign
    const lines = wrapText(ctx, title, SIZE - PAD * 2)
    const lineH = Math.round(s.titleSize * 1.25)
    for (const l of lines) { ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    curY += 12
    bounds.title = { y1: titleY1, y2: curY }

    const ag = ctx.createLinearGradient(PAD, 0, PAD + 200, 0)
    ag.addColorStop(0, '#06b6d4'); ag.addColorStop(1, 'transparent')
    ctx.strokeStyle = ag; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(PAD + 200, curY); ctx.stroke()
    curY += 36
  }
  if (content) {
    const contentY1 = curY
    ctx.font = `400 ${s.contentSize}px ${FONT}`; ctx.fillStyle = s.contentColor; ctx.textAlign = s.textAlign
    const lines = wrapText(ctx, content, SIZE - PAD * 2)
    const lineH = Math.round(s.contentSize * 1.5)
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    bounds.content = { y1: contentY1, y2: curY }
  }
  ctx.fillStyle = topBar; ctx.fillRect(0, SIZE - 12, SIZE, 12)
}

// ──────────────────────────────────────────────
// Template 2: 클린 화이트
// ──────────────────────────────────────────────
function drawT2(
  ctx: CanvasRenderingContext2D,
  title: string, content: string, date: string, company: string,
  s: StyleOptions, bounds: Bounds,
) {
  bounds.title = null; bounds.content = null

  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, SIZE, SIZE)

  const headerH = 240
  const hg = ctx.createLinearGradient(0, 0, SIZE, 0)
  hg.addColorStop(0, '#1e40af'); hg.addColorStop(1, '#3b82f6')
  ctx.fillStyle = hg; ctx.fillRect(0, 0, SIZE, headerH)

  ctx.beginPath(); ctx.arc(SIZE - 80, headerH / 2, 220, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill()
  ctx.beginPath(); ctx.arc(SIZE - 80, headerH / 2, 140, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill()

  ctx.font = `800 52px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText('공지사항', 80, 120)
  if (company) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(company, 80, 170) }
  if (date)    { ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - 80, 170) }

  const cardX = 60, cardY = 290, cardW = SIZE - 120, cardH = SIZE - 360
  ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 8
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 24); else ctx.rect(cardX, cardY, cardW, cardH)
  ctx.fill()
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(cardX, cardY, 8, cardH)

  const PAD = 72
  let curY = cardY + 76 + s.verticalOffset

  if (title) {
    const titleY1 = curY
    const weight = s.titleBold ? '800' : '500'
    ctx.font = `${weight} ${s.titleSize}px ${FONT}`; ctx.fillStyle = s.titleColor; ctx.textAlign = s.textAlign
    const lines = wrapText(ctx, title, cardW - PAD - 20)
    const lineH = Math.round(s.titleSize * 1.25)
    const xPos = s.textAlign === 'left' ? cardX + PAD : s.textAlign === 'right' ? cardX + cardW - 40 : cardX + cardW / 2
    for (const l of lines) { ctx.fillText(l, xPos, curY); curY += lineH }
    curY += 8
    bounds.title = { y1: titleY1, y2: curY }

    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.textAlign = 'left'
    ctx.beginPath(); ctx.moveTo(cardX + PAD, curY); ctx.lineTo(cardX + cardW - 40, curY); ctx.stroke()
    curY += 44
  }
  if (content) {
    const contentY1 = curY
    ctx.font = `400 ${s.contentSize}px ${FONT}`; ctx.fillStyle = s.contentColor; ctx.textAlign = s.textAlign
    const lines = wrapText(ctx, content, cardW - PAD - 20)
    const lineH = Math.round(s.contentSize * 1.5)
    const xPos = s.textAlign === 'left' ? cardX + PAD : s.textAlign === 'right' ? cardX + cardW - 40 : cardX + cardW / 2
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xPos, curY); curY += lineH }
    bounds.content = { y1: contentY1, y2: curY }
  }
}

// ──────────────────────────────────────────────
// Template 3: 에메랄드 그린
// ──────────────────────────────────────────────
function drawT3(
  ctx: CanvasRenderingContext2D,
  title: string, content: string, date: string, company: string,
  s: StyleOptions, bounds: Bounds,
) {
  bounds.title = null; bounds.content = null

  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  bg.addColorStop(0, '#022c22'); bg.addColorStop(1, '#064e3b')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.beginPath(); ctx.arc(SIZE, 0, 500, 0, Math.PI * 2); ctx.fillStyle = 'rgba(16,185,129,0.06)'; ctx.fill()
  ctx.beginPath(); ctx.arc(0, SIZE, 400, 0, Math.PI * 2); ctx.fillStyle = 'rgba(16,185,129,0.05)'; ctx.fill()

  const vBar = ctx.createLinearGradient(0, 0, 0, SIZE)
  vBar.addColorStop(0, '#34d399'); vBar.addColorStop(1, '#059669')
  ctx.fillStyle = vBar; ctx.fillRect(0, 0, 10, SIZE)

  const PAD = 80
  ctx.font = `700 30px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'left'; ctx.fillText('📢  N O T I C E', PAD, 95)
  if (company) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'right'; ctx.fillText(company, SIZE - PAD, 95) }

  const gg = ctx.createLinearGradient(PAD, 0, SIZE - PAD, 0)
  gg.addColorStop(0, 'transparent'); gg.addColorStop(0.15, '#fbbf24'); gg.addColorStop(0.85, '#fbbf24'); gg.addColorStop(1, 'transparent')
  ctx.strokeStyle = gg; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(PAD, 124); ctx.lineTo(SIZE - PAD, 124); ctx.stroke()

  let curY = 220 + s.verticalOffset

  if (title) {
    const titleY1 = curY
    const weight = s.titleBold ? '800' : '500'
    ctx.font = `${weight} ${s.titleSize}px ${FONT}`; ctx.fillStyle = s.titleColor; ctx.textAlign = s.textAlign
    const lines = wrapText(ctx, title, SIZE - PAD * 2)
    const lineH = Math.round(s.titleSize * 1.25)
    for (const l of lines) { ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    curY += 10
    bounds.title = { y1: titleY1, y2: curY }

    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(PAD + 120, curY); ctx.stroke()
    curY += 46
  }
  if (content) {
    const contentY1 = curY
    ctx.font = `400 ${s.contentSize}px ${FONT}`; ctx.fillStyle = s.contentColor; ctx.textAlign = s.textAlign
    const lines = wrapText(ctx, content, SIZE - PAD * 2)
    const lineH = Math.round(s.contentSize * 1.5)
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    bounds.content = { y1: contentY1, y2: curY }
  }
  if (date) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - PAD, SIZE - 56) }
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, SIZE - 8, SIZE, 8)
}

// ──────────────────────────────────────────────
// Template 4: 웜 오렌지
// ──────────────────────────────────────────────
function drawT4(
  ctx: CanvasRenderingContext2D,
  title: string, content: string, date: string, company: string,
  s: StyleOptions, bounds: Bounds,
) {
  bounds.title = null; bounds.content = null

  ctx.fillStyle = '#fef3c7'; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#fffbf5'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(40, 40, SIZE - 80, SIZE - 80, 0); else ctx.rect(40, 40, SIZE - 80, SIZE - 80)
  ctx.fill()

  const headerH = 200
  const og = ctx.createLinearGradient(0, 0, SIZE, 0)
  og.addColorStop(0, '#ea580c'); og.addColorStop(1, '#f97316')
  ctx.fillStyle = og; ctx.fillRect(40, 40, SIZE - 80, headerH)

  ctx.beginPath(); ctx.arc(SIZE - 100, 40 + headerH / 2, 160, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill()
  ctx.font = `800 48px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText('공지사항', 110, 40 + 96)
  if (company) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(company, 110, 40 + 152) }
  if (date)    { ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - 110, 40 + 152) }

  ctx.fillStyle = og; ctx.fillRect(40, 40 + headerH, 8, SIZE - 80 - headerH)

  const PAD = 110
  let curY = 40 + headerH + 90 + s.verticalOffset

  if (title) {
    const titleY1 = curY
    const weight = s.titleBold ? '800' : '500'
    ctx.font = `${weight} ${s.titleSize}px ${FONT}`; ctx.fillStyle = s.titleColor; ctx.textAlign = s.textAlign
    const lines = wrapText(ctx, title, SIZE - PAD - 60)
    const lineH = Math.round(s.titleSize * 1.25)
    for (const l of lines) { ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    curY += 8
    bounds.title = { y1: titleY1, y2: curY }

    ctx.fillStyle = '#f97316'; ctx.fillRect(PAD, curY, 80, 6)
    curY += 44
  }
  if (content) {
    const contentY1 = curY
    ctx.font = `400 ${s.contentSize}px ${FONT}`; ctx.fillStyle = s.contentColor; ctx.textAlign = s.textAlign
    const lines = wrapText(ctx, content, SIZE - PAD - 60)
    const lineH = Math.round(s.contentSize * 1.5)
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    bounds.content = { y1: contentY1, y2: curY }
  }
  ctx.fillStyle = og; ctx.fillRect(40, SIZE - 48, SIZE - 80, 8)
}

// ──────────────────────────────────────────────
// 선택 오버레이
// ──────────────────────────────────────────────
function drawSelectionOverlay(
  ctx: CanvasRenderingContext2D,
  selection: 'title' | 'content' | null,
  bounds: Bounds,
) {
  const b = selection === 'title' ? bounds.title : selection === 'content' ? bounds.content : null
  if (!b) return
  const pad = 18
  const y = Math.max(0, b.y1 - pad)
  const h = Math.min(SIZE - y, (b.y2 - b.y1) + pad * 2)

  ctx.save()
  ctx.fillStyle = 'rgba(59,130,246,0.10)'
  ctx.fillRect(0, y, SIZE, h)
  ctx.strokeStyle = 'rgba(59,130,246,0.80)'
  ctx.lineWidth = 6
  ctx.setLineDash([20, 10])
  ctx.strokeRect(4, y + 4, SIZE - 8, h - 8)
  ctx.setLineDash([])
  ctx.restore()
}

// ──────────────────────────────────────────────
// 컴팩트 컨트롤 컴포넌트
// ──────────────────────────────────────────────
function SizeRow({ label, value, min, max, step = 2, onChange }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2 h-7">
      <span className="text-slate-400 text-xs w-14 shrink-0">{label}</span>
      <button onClick={() => onChange(Math.max(min, value - step))}
        className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center shrink-0">
        <Minus className="h-2.5 w-2.5 text-slate-300" />
      </button>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="flex-1 h-1 rounded-full accent-blue-500 cursor-pointer"
      />
      <button onClick={() => onChange(Math.min(max, value + step))}
        className="w-5 h-5 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center shrink-0">
        <Plus className="h-2.5 w-2.5 text-slate-300" />
      </button>
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
        <input type="color" value={value} onChange={e => onChange(e.target.value)}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
      </label>
    </div>
  )
}

// ──────────────────────────────────────────────
// 메인
// ──────────────────────────────────────────────
export default function NoticePage() {
  const supabase = createClient()
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const boundsRef  = useRef<Bounds>({ title: null, content: null })

  const [selectedTpl, setSelectedTpl]       = useState<TemplateId>(1)
  const [title, setTitle]                   = useState('')
  const [content, setContent]               = useState('')
  const [date, setDate]                     = useState(() =>
    new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  )
  const [companyName, setCompanyName]       = useState('')
  const [styles, setStyles]                 = useState<StyleOptions>(TEMPLATE_DEFAULTS[1])
  const [styleTab, setStyleTab]             = useState<StyleTab>('title')
  const [canvasSelection, setCanvasSelection] = useState<'title' | 'content' | null>(null)
  const [canvasCursor, setCanvasCursor]     = useState<'default' | 'pointer'>('default')

  const setStyle = <K extends keyof StyleOptions>(key: K, val: StyleOptions[K]) =>
    setStyles(prev => ({ ...prev, [key]: val }))

  const handleSelectTpl = (id: TemplateId) => {
    setSelectedTpl(id); setStyles(TEMPLATE_DEFAULTS[id]); setCanvasSelection(null)
  }

  // 회사명 자동 로드
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('company_name').eq('id', user.id).maybeSingle()
        .then(({ data }) => { if (data?.company_name) setCompanyName(data.company_name) })
    })
  }, [])

  // 캔버스 렌더
  const render = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    ctx.clearRect(0, 0, SIZE, SIZE)
    const newBounds: Bounds = { title: null, content: null }
    const args = [ctx, title, content, date, companyName, styles, newBounds] as const
    switch (selectedTpl) {
      case 1: drawT1(...args); break
      case 2: drawT2(...args); break
      case 3: drawT3(...args); break
      case 4: drawT4(...args); break
    }
    boundsRef.current = newBounds
    drawSelectionOverlay(ctx, canvasSelection, newBounds)
  }, [selectedTpl, title, content, date, companyName, styles, canvasSelection])

  useEffect(() => { render() }, [render])

  // 캔버스 좌표 변환
  const getCanvasY = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current; if (!canvas) return -1
    const rect = canvas.getBoundingClientRect()
    return (e.clientY - rect.top) * (SIZE / rect.height)
  }

  const inBounds = (y: number, b: { y1: number; y2: number } | null, pad = 20) =>
    b ? y >= b.y1 - pad && y <= b.y2 + pad : false

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const y = getCanvasY(e)
    const b = boundsRef.current
    setCanvasCursor(inBounds(y, b.title) || inBounds(y, b.content) ? 'pointer' : 'default')
  }

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const y = getCanvasY(e)
    const b = boundsRef.current
    if (inBounds(y, b.title)) {
      setCanvasSelection('title'); setStyleTab('title')
    } else if (inBounds(y, b.content)) {
      setCanvasSelection('content'); setStyleTab('content')
    } else {
      setCanvasSelection(null)
    }
  }

  // 탭 → 캔버스 선택 동기화
  const handleTabChange = (tab: StyleTab) => {
    setStyleTab(tab)
    setCanvasSelection(tab === 'layout' ? null : tab)
  }

  // 다운로드: 오버레이 없는 오프스크린 캔버스 사용
  const handleDownload = () => {
    const offscreen = document.createElement('canvas')
    offscreen.width = SIZE; offscreen.height = SIZE
    const ctx = offscreen.getContext('2d')!
    const newBounds: Bounds = { title: null, content: null }
    const args = [ctx, title, content, date, companyName, styles, newBounds] as const
    switch (selectedTpl) {
      case 1: drawT1(...args); break
      case 2: drawT2(...args); break
      case 3: drawT3(...args); break
      case 4: drawT4(...args); break
    }
    const a = document.createElement('a')
    a.href = offscreen.toDataURL('image/png')
    a.download = `공지사항_${title || '이미지'}.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handleReset = () => {
    setTitle(''); setContent('')
    setDate(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }))
    setStyles(TEMPLATE_DEFAULTS[selectedTpl]); setCanvasSelection(null)
  }

  const tplConfig = TEMPLATES.find(t => t.id === selectedTpl)!

  const tabCls = (tab: StyleTab) =>
    `flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
      styleTab === tab
        ? 'bg-blue-600 text-white'
        : 'text-slate-400 hover:text-slate-200'
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

        {/* ── 왼쪽: 설정 ── */}
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

          {/* 내용 입력 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">② 공지 내용 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
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
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-slate-300 text-xs font-medium">제목 <span className="text-blue-400">*</span></Label>
                  <span className="text-slate-600 text-xs">{title.length}/30</span>
                </div>
                <Input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="공지사항 제목" className="bg-slate-800 border-slate-600 text-white h-9" maxLength={30} />
              </div>
              <div className="space-y-1">
                <div className="flex justify-between">
                  <Label className="text-slate-300 text-xs font-medium">내용</Label>
                  <span className="text-slate-600 text-xs">{content.length}/300</span>
                </div>
                <Textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder={"내용을 입력하세요\nEnter로 줄바꿈"}
                  className="bg-slate-800 border-slate-600 text-white text-sm resize-none" rows={4} maxLength={300} />
              </div>
            </CardContent>
          </Card>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}
              className="border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white gap-2">
              <RefreshCw className="h-4 w-4" />초기화
            </Button>
            <Button onClick={handleDownload} className="flex-1 gap-2"
              style={{ background: tplConfig.accent }}
              disabled={!title && !content}>
              <Download className="h-4 w-4" />이미지 다운로드 (PNG)
            </Button>
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 + 스타일 패널 ── */}
        <div className="space-y-3">

          {/* 캔버스 */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-slate-400 text-sm font-medium">실시간 미리보기</p>
              <span className="text-slate-600 text-xs">다운로드: 1080×1080px</span>
            </div>
            <div className="rounded-xl overflow-hidden border border-slate-700 bg-slate-950">
              <canvas
                ref={canvasRef}
                width={SIZE} height={SIZE}
                className="w-full aspect-square"
                style={{ cursor: canvasCursor }}
                onClick={handleCanvasClick}
                onMouseMove={handleCanvasMouseMove}
                onMouseLeave={() => setCanvasCursor('default')}
              />
            </div>
            <p className="text-slate-600 text-xs text-center mt-1.5 flex items-center justify-center gap-1">
              <MousePointer2 className="h-3 w-3" />
              제목·내용 영역을 클릭하면 해당 스타일을 편집합니다
            </p>
          </div>

          {/* ─ 스타일 패널 (컴팩트) ─ */}
          <Card className="border-slate-700 bg-slate-900">
            <CardContent className="p-3 space-y-3">

              {/* 탭 */}
              <div className="flex gap-1 bg-slate-800 rounded-lg p-1">
                {(['title', 'content', 'layout'] as StyleTab[]).map(tab => (
                  <button key={tab} onClick={() => handleTabChange(tab)} className={tabCls(tab)}>
                    {tab === 'title' ? '제목 스타일' : tab === 'content' ? '내용 스타일' : '배치'}
                  </button>
                ))}
              </div>

              {/* 제목 탭 */}
              {styleTab === 'title' && (
                <div className="space-y-2">
                  <SizeRow  label="글씨 크기" value={styles.titleSize}   min={40}   max={120}  onChange={v => setStyle('titleSize',   v)} />
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

              {/* 내용 탭 */}
              {styleTab === 'content' && (
                <div className="space-y-2">
                  <SizeRow  label="글씨 크기" value={styles.contentSize}  min={24}   max={72}   onChange={v => setStyle('contentSize',  v)} />
                  <ColorRow label="글씨 색상" value={styles.contentColor} onChange={v => setStyle('contentColor', v)} />
                </div>
              )}

              {/* 배치 탭 */}
              {styleTab === 'layout' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 h-7">
                    <span className="text-slate-400 text-xs w-14 shrink-0">정렬</span>
                    <div className="flex gap-1">
                      {([
                        { v: 'left'   as Align, Icon: AlignLeft   },
                        { v: 'center' as Align, Icon: AlignCenter },
                        { v: 'right'  as Align, Icon: AlignRight  },
                      ]).map(({ v, Icon }) => (
                        <button key={v} onClick={() => setStyle('textAlign', v)}
                          className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                            styles.textAlign === v ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}>
                          <Icon className="h-3.5 w-3.5" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <SizeRow
                    label="수직 위치" value={styles.verticalOffset}
                    min={-200} max={200} step={10}
                    onChange={v => setStyle('verticalOffset', v)}
                  />
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
    </div>
  )
}
