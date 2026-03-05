'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Megaphone, CheckCircle2, RefreshCw, AlignLeft, AlignCenter, AlignRight, ChevronDown, ChevronUp, Minus, Plus } from 'lucide-react'
import { Separator } from '@/components/ui/separator'

// ──────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────
const SIZE = 1080
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', sans-serif"
type TemplateId = 1 | 2 | 3 | 4
type Align = 'left' | 'center' | 'right'

// ──────────────────────────────────────────────
// 스타일 옵션 타입
// ──────────────────────────────────────────────
interface StyleOptions {
  titleSize: number       // 40~120
  contentSize: number     // 24~72
  titleColor: string
  contentColor: string
  textAlign: Align
  titleBold: boolean
  verticalOffset: number  // -200~200 (제목 수직 위치 조정)
}

// 템플릿별 기본 스타일
const TEMPLATE_DEFAULTS: Record<TemplateId, StyleOptions> = {
  1: { titleSize: 72, contentSize: 40, titleColor: '#ffffff', contentColor: '#94a3b8', textAlign: 'left',   titleBold: true,  verticalOffset: 0 },
  2: { titleSize: 64, contentSize: 38, titleColor: '#1e293b', contentColor: '#475569', textAlign: 'left',   titleBold: true,  verticalOffset: 0 },
  3: { titleSize: 70, contentSize: 40, titleColor: '#ffffff', contentColor: '#a7f3d0', textAlign: 'left',   titleBold: true,  verticalOffset: 0 },
  4: { titleSize: 66, contentSize: 38, titleColor: '#1c1917', contentColor: '#44403c', textAlign: 'left',   titleBold: true,  verticalOffset: 0 },
}

// ──────────────────────────────────────────────
// 텍스트 줄바꿈 헬퍼
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

function applyAlign(ctx: CanvasRenderingContext2D, align: Align) {
  ctx.textAlign = align
}

function xByAlign(align: Align, pad: number): number {
  if (align === 'center') return SIZE / 2
  if (align === 'right')  return SIZE - pad
  return pad
}

// ──────────────────────────────────────────────
// Template 1: 다크 비즈니스
// ──────────────────────────────────────────────
function drawT1(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string, s: StyleOptions) {
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  bg.addColorStop(0, '#0c1228'); bg.addColorStop(1, '#0f2044')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE)

  ctx.fillStyle = 'rgba(255,255,255,0.025)'
  for (let x = 50; x < SIZE; x += 70) for (let y = 50; y < SIZE; y += 70) {
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
    const weight = s.titleBold ? '800' : '500'
    ctx.font = `${weight} ${s.titleSize}px ${FONT}`
    ctx.fillStyle = s.titleColor
    applyAlign(ctx, s.textAlign)
    const lines = wrapText(ctx, title, SIZE - PAD * 2)
    const lineH = Math.round(s.titleSize * 1.25)
    for (const l of lines) { ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    curY += 12

    const accentGrad = ctx.createLinearGradient(PAD, 0, PAD + 200, 0)
    accentGrad.addColorStop(0, '#06b6d4'); accentGrad.addColorStop(1, 'transparent')
    ctx.strokeStyle = accentGrad; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(PAD + 200, curY); ctx.stroke()
    curY += 36
  }
  if (content) {
    ctx.font = `400 ${s.contentSize}px ${FONT}`
    ctx.fillStyle = s.contentColor
    applyAlign(ctx, s.textAlign)
    const lines = wrapText(ctx, content, SIZE - PAD * 2)
    const lineH = Math.round(s.contentSize * 1.5)
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
  }
  ctx.fillStyle = topBar; ctx.fillRect(0, SIZE - 12, SIZE, 12)
}

// ──────────────────────────────────────────────
// Template 2: 클린 화이트
// ──────────────────────────────────────────────
function drawT2(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string, s: StyleOptions) {
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, SIZE, SIZE)

  const headerH = 240
  const headerGrad = ctx.createLinearGradient(0, 0, SIZE, 0)
  headerGrad.addColorStop(0, '#1e40af'); headerGrad.addColorStop(1, '#3b82f6')
  ctx.fillStyle = headerGrad; ctx.fillRect(0, 0, SIZE, headerH)

  ctx.beginPath(); ctx.arc(SIZE - 80, headerH / 2, 220, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill()
  ctx.beginPath(); ctx.arc(SIZE - 80, headerH / 2, 140, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill()

  ctx.font = `800 52px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText('공지사항', 80, 120)
  if (company) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillText(company, 80, 170) }
  if (date) { ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - 80, 170) }

  const cardX = 60, cardY = 290, cardW = SIZE - 120, cardH = SIZE - 360
  ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 8
  ctx.fillStyle = '#ffffff'
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 24); else ctx.rect(cardX, cardY, cardW, cardH)
  ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(cardX, cardY, 8, cardH)

  const PAD = 72
  let curY = cardY + 76 + s.verticalOffset

  if (title) {
    const weight = s.titleBold ? '800' : '500'
    ctx.font = `${weight} ${s.titleSize}px ${FONT}`; ctx.fillStyle = s.titleColor
    applyAlign(ctx, s.textAlign)
    const lines = wrapText(ctx, title, cardW - PAD - 20)
    const lineH = Math.round(s.titleSize * 1.25)
    for (const l of lines) { ctx.fillText(l, s.textAlign === 'left' ? cardX + PAD : s.textAlign === 'right' ? cardX + cardW - 40 : cardX + cardW / 2, curY); curY += lineH }
    curY += 8
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2; ctx.textAlign = 'left'
    ctx.beginPath(); ctx.moveTo(cardX + PAD, curY); ctx.lineTo(cardX + cardW - 40, curY); ctx.stroke(); curY += 44
  }
  if (content) {
    ctx.font = `400 ${s.contentSize}px ${FONT}`; ctx.fillStyle = s.contentColor
    applyAlign(ctx, s.textAlign)
    const lines = wrapText(ctx, content, cardW - PAD - 20)
    const lineH = Math.round(s.contentSize * 1.5)
    const xPos = s.textAlign === 'left' ? cardX + PAD : s.textAlign === 'right' ? cardX + cardW - 40 : cardX + cardW / 2
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xPos, curY); curY += lineH }
  }
}

// ──────────────────────────────────────────────
// Template 3: 에메랄드 그린
// ──────────────────────────────────────────────
function drawT3(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string, s: StyleOptions) {
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

  const goldGrad = ctx.createLinearGradient(PAD, 0, SIZE - PAD, 0)
  goldGrad.addColorStop(0, 'transparent'); goldGrad.addColorStop(0.15, '#fbbf24'); goldGrad.addColorStop(0.85, '#fbbf24'); goldGrad.addColorStop(1, 'transparent')
  ctx.strokeStyle = goldGrad; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(PAD, 124); ctx.lineTo(SIZE - PAD, 124); ctx.stroke()

  let curY = 220 + s.verticalOffset
  if (title) {
    const weight = s.titleBold ? '800' : '500'
    ctx.font = `${weight} ${s.titleSize}px ${FONT}`; ctx.fillStyle = s.titleColor
    applyAlign(ctx, s.textAlign)
    const lines = wrapText(ctx, title, SIZE - PAD * 2)
    const lineH = Math.round(s.titleSize * 1.25)
    for (const l of lines) { ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    curY += 10
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(PAD + 120, curY); ctx.stroke(); curY += 46
  }
  if (content) {
    ctx.font = `400 ${s.contentSize}px ${FONT}`; ctx.fillStyle = s.contentColor
    applyAlign(ctx, s.textAlign)
    const lines = wrapText(ctx, content, SIZE - PAD * 2)
    const lineH = Math.round(s.contentSize * 1.5)
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
  }
  if (date) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - PAD, SIZE - 56) }
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, SIZE - 8, SIZE, 8)
}

// ──────────────────────────────────────────────
// Template 4: 웜 오렌지
// ──────────────────────────────────────────────
function drawT4(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string, s: StyleOptions) {
  ctx.fillStyle = '#fffbf5'; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#fef3c7'; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#fffbf5'
  ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(40, 40, SIZE - 80, SIZE - 80, 0); else ctx.rect(40, 40, SIZE - 80, SIZE - 80)
  ctx.fill()

  const headerH = 200
  const orangeGrad = ctx.createLinearGradient(0, 0, SIZE, 0)
  orangeGrad.addColorStop(0, '#ea580c'); orangeGrad.addColorStop(1, '#f97316')
  ctx.fillStyle = orangeGrad; ctx.fillRect(40, 40, SIZE - 80, headerH)

  ctx.beginPath(); ctx.arc(SIZE - 100, 40 + headerH / 2, 160, 0, Math.PI * 2); ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill()

  ctx.font = `800 48px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'; ctx.fillText('공지사항', 110, 40 + 96)
  if (company) { ctx.font = `400 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillText(company, 110, 40 + 152) }
  if (date) { ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right'; ctx.fillText(date, SIZE - 110, 40 + 152) }

  ctx.fillStyle = orangeGrad; ctx.fillRect(40, 40 + headerH, 8, SIZE - 80 - headerH)

  const PAD = 110
  let curY = 40 + headerH + 90 + s.verticalOffset

  if (title) {
    const weight = s.titleBold ? '800' : '500'
    ctx.font = `${weight} ${s.titleSize}px ${FONT}`; ctx.fillStyle = s.titleColor
    applyAlign(ctx, s.textAlign)
    const lines = wrapText(ctx, title, SIZE - PAD - 60)
    const lineH = Math.round(s.titleSize * 1.25)
    for (const l of lines) { ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
    curY += 8
    ctx.fillStyle = '#f97316'; ctx.fillRect(PAD, curY, 80, 6); curY += 44
  }
  if (content) {
    ctx.font = `400 ${s.contentSize}px ${FONT}`; ctx.fillStyle = s.contentColor
    applyAlign(ctx, s.textAlign)
    const lines = wrapText(ctx, content, SIZE - PAD - 60)
    const lineH = Math.round(s.contentSize * 1.5)
    for (const l of lines) { if (!l) { curY += lineH * 0.4; continue }; ctx.fillText(l, xByAlign(s.textAlign, PAD), curY); curY += lineH }
  }
  ctx.fillStyle = orangeGrad; ctx.fillRect(40, SIZE - 48, SIZE - 80, 8)
}

// ──────────────────────────────────────────────
// 템플릿 목록
// ──────────────────────────────────────────────
const TEMPLATES = [
  { id: 1 as TemplateId, name: '다크 비즈니스', colors: ['#0c1228', '#0f2044'], accent: '#38bdf8' },
  { id: 2 as TemplateId, name: '클린 화이트',   colors: ['#1e40af', '#3b82f6'], accent: '#3b82f6' },
  { id: 3 as TemplateId, name: '에메랄드 그린', colors: ['#022c22', '#064e3b'], accent: '#34d399' },
  { id: 4 as TemplateId, name: '웜 오렌지',     colors: ['#ea580c', '#f97316'], accent: '#f97316' },
]

// ──────────────────────────────────────────────
// 슬라이더 컴포넌트
// ──────────────────────────────────────────────
function SizeControl({ label, value, min, max, step = 2, onChange }: {
  label: string; value: number; min: number; max: number; step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-slate-400 text-xs">{label}</Label>
        <div className="flex items-center gap-1">
          <button onClick={() => onChange(Math.max(min, value - step))}
            className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300">
            <Minus className="h-3 w-3" />
          </button>
          <span className="text-white text-xs font-mono w-8 text-center">{value}</span>
          <button onClick={() => onChange(Math.min(max, value + step))}
            className="w-6 h-6 rounded bg-slate-700 hover:bg-slate-600 flex items-center justify-center text-slate-300">
            <Plus className="h-3 w-3" />
          </button>
        </div>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none bg-slate-700 accent-blue-500 cursor-pointer"
      />
    </div>
  )
}

// ──────────────────────────────────────────────
// 색상 피커 컴포넌트
// ──────────────────────────────────────────────
function ColorControl({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center justify-between">
      <Label className="text-slate-400 text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <span className="text-slate-500 text-xs font-mono">{value.toUpperCase()}</span>
        <label className="relative cursor-pointer">
          <div className="w-8 h-8 rounded-lg border-2 border-slate-600 shadow-inner overflow-hidden"
            style={{ background: value }}>
          </div>
          <input type="color" value={value} onChange={e => onChange(e.target.value)}
            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" />
        </label>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// 정렬 버튼 컴포넌트
// ──────────────────────────────────────────────
function AlignControl({ value, onChange }: { value: Align; onChange: (v: Align) => void }) {
  const btns: { v: Align; Icon: React.ElementType }[] = [
    { v: 'left',   Icon: AlignLeft   },
    { v: 'center', Icon: AlignCenter },
    { v: 'right',  Icon: AlignRight  },
  ]
  return (
    <div className="flex items-center justify-between">
      <Label className="text-slate-400 text-xs">텍스트 정렬</Label>
      <div className="flex gap-1">
        {btns.map(({ v, Icon }) => (
          <button key={v} onClick={() => onChange(v)}
            className={`w-8 h-8 rounded flex items-center justify-center transition-colors ${
              value === v ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
            }`}>
            <Icon className="h-4 w-4" />
          </button>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────
export default function NoticePage() {
  const supabase = createClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [selectedTpl, setSelectedTpl] = useState<TemplateId>(1)
  const [title, setTitle]           = useState('')
  const [content, setContent]       = useState('')
  const [date, setDate]             = useState(() =>
    new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
  )
  const [companyName, setCompanyName] = useState('')
  const [styleOpen, setStyleOpen]   = useState(true)
  const [styles, setStyles]         = useState<StyleOptions>(TEMPLATE_DEFAULTS[1])

  const setStyle = <K extends keyof StyleOptions>(key: K, val: StyleOptions[K]) =>
    setStyles(prev => ({ ...prev, [key]: val }))

  // 템플릿 변경 시 기본 스타일 적용
  const handleSelectTpl = (id: TemplateId) => {
    setSelectedTpl(id)
    setStyles(TEMPLATE_DEFAULTS[id])
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
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, SIZE, SIZE)
    const args = [ctx, title, content, date, companyName, styles] as const
    switch (selectedTpl) {
      case 1: drawT1(...args); break
      case 2: drawT2(...args); break
      case 3: drawT3(...args); break
      case 4: drawT4(...args); break
    }
  }, [selectedTpl, title, content, date, companyName, styles])

  useEffect(() => { render() }, [render])

  const handleDownload = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `공지사항_${title || '이미지'}.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handleReset = () => {
    setTitle(''); setContent('')
    setDate(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }))
    setStyles(TEMPLATE_DEFAULTS[selectedTpl])
  }

  const tplConfig = TEMPLATES.find(t => t.id === selectedTpl)!

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-blue-400" />공지사항 생성
        </h2>
        <p className="text-slate-400 text-sm mt-1">라이더에게 문자·카카오톡으로 발송할 공지 이미지를 생성하세요</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── 왼쪽: 설정 패널 ── */}
        <div className="space-y-4">

          {/* 템플릿 선택 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">① 배경 템플릿 선택</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map(tpl => (
                  <button key={tpl.id} onClick={() => handleSelectTpl(tpl.id)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                      selectedTpl === tpl.id
                        ? 'border-blue-500 ring-2 ring-blue-500/40 scale-[0.97]'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}>
                    <div className="h-20 w-full flex flex-col items-start justify-end p-3 gap-1"
                      style={{ background: `linear-gradient(135deg, ${tpl.colors[0]}, ${tpl.colors[1]})` }}>
                      <div className="h-2 rounded-full opacity-80" style={{ width: '60%', background: tpl.accent }} />
                      <div className="h-1.5 rounded-full opacity-40 bg-white" style={{ width: '80%' }} />
                      <div className="h-1.5 rounded-full opacity-30 bg-white" style={{ width: '55%' }} />
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

          {/* 공지 내용 입력 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">② 공지 내용 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">회사명</Label>
                  <Input value={companyName} onChange={e => setCompanyName(e.target.value)}
                    placeholder="회사명" className="bg-slate-800 border-slate-600 text-white h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-400 text-xs">날짜</Label>
                  <Input value={date} onChange={e => setDate(e.target.value)}
                    placeholder="날짜" className="bg-slate-800 border-slate-600 text-white h-9 text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-slate-300 text-xs font-medium">제목 <span className="text-blue-400">*</span></Label>
                  <span className="text-slate-600 text-xs">{title.length}/30</span>
                </div>
                <Input value={title} onChange={e => setTitle(e.target.value)}
                  placeholder="공지사항 제목을 입력하세요"
                  className="bg-slate-800 border-slate-600 text-white h-10" maxLength={30} />
              </div>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <Label className="text-slate-300 text-xs font-medium">내용</Label>
                  <span className="text-slate-600 text-xs">{content.length}/300</span>
                </div>
                <Textarea value={content} onChange={e => setContent(e.target.value)}
                  placeholder={"공지 내용을 입력하세요.\nEnter로 줄바꿈합니다."}
                  className="bg-slate-800 border-slate-600 text-white text-sm resize-none" rows={5} maxLength={300} />
              </div>
            </CardContent>
          </Card>

          {/* 스타일 설정 */}
          <Card className="border-slate-700 bg-slate-900">
            <button className="w-full" onClick={() => setStyleOpen(v => !v)}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-white text-sm">③ 스타일 설정</CardTitle>
                  {styleOpen
                    ? <ChevronUp className="h-4 w-4 text-slate-400" />
                    : <ChevronDown className="h-4 w-4 text-slate-400" />}
                </div>
              </CardHeader>
            </button>
            {styleOpen && (
              <CardContent className="space-y-5 pt-0">
                {/* 제목 스타일 */}
                <div className="space-y-3">
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">제목</p>
                  <SizeControl label="글씨 크기" value={styles.titleSize} min={40} max={120} onChange={v => setStyle('titleSize', v)} />
                  <ColorControl label="글씨 색상" value={styles.titleColor} onChange={v => setStyle('titleColor', v)} />
                  <div className="flex items-center justify-between">
                    <Label className="text-slate-400 text-xs">굵게</Label>
                    <button onClick={() => setStyle('titleBold', !styles.titleBold)}
                      className={`w-10 h-5 rounded-full transition-colors relative ${styles.titleBold ? 'bg-blue-600' : 'bg-slate-700'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${styles.titleBold ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                  </div>
                </div>

                <Separator className="bg-slate-800" />

                {/* 내용 스타일 */}
                <div className="space-y-3">
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">내용</p>
                  <SizeControl label="글씨 크기" value={styles.contentSize} min={24} max={72} onChange={v => setStyle('contentSize', v)} />
                  <ColorControl label="글씨 색상" value={styles.contentColor} onChange={v => setStyle('contentColor', v)} />
                </div>

                <Separator className="bg-slate-800" />

                {/* 배치 */}
                <div className="space-y-3">
                  <p className="text-slate-500 text-xs font-medium uppercase tracking-wider">배치</p>
                  <AlignControl value={styles.textAlign} onChange={v => setStyle('textAlign', v)} />
                  <SizeControl
                    label="텍스트 수직 위치"
                    value={styles.verticalOffset}
                    min={-200} max={200} step={10}
                    onChange={v => setStyle('verticalOffset', v)}
                  />
                  <p className="text-slate-600 text-xs">음수(-) = 위로, 양수(+) = 아래로</p>
                </div>

                <button onClick={() => setStyles(TEMPLATE_DEFAULTS[selectedTpl])}
                  className="text-slate-500 hover:text-slate-300 text-xs underline underline-offset-2">
                  스타일 기본값으로 초기화
                </button>
              </CardContent>
            )}
          </Card>

          {/* 액션 버튼 */}
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}
              className="border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white gap-2">
              <RefreshCw className="h-4 w-4" />전체 초기화
            </Button>
            <Button onClick={handleDownload} className="flex-1 gap-2"
              style={{ background: tplConfig.accent }}
              disabled={!title && !content}>
              <Download className="h-4 w-4" />이미지 다운로드 (PNG)
            </Button>
          </div>
        </div>

        {/* ── 오른쪽: 미리보기 ── */}
        <div className="space-y-3 xl:sticky xl:top-6">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-sm font-medium">실시간 미리보기</p>
            <span className="text-slate-600 text-xs">다운로드: 1080×1080px PNG</span>
          </div>
          <div className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-950">
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="w-full aspect-square"
              style={{ imageRendering: 'auto' }}
            />
          </div>
          <p className="text-slate-600 text-xs text-center">카카오톡·문자 발송 최적화 사이즈</p>
        </div>
      </div>
    </div>
  )
}
