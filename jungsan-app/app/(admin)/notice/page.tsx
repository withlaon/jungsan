'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Download, Megaphone, CheckCircle2, RefreshCw } from 'lucide-react'

// ──────────────────────────────────────────────
// 상수
// ──────────────────────────────────────────────
const SIZE = 1080
const FONT = "'Apple SD Gothic Neo', 'Malgun Gothic', 'Noto Sans KR', 'Segoe UI', sans-serif"

type TemplateId = 1 | 2 | 3 | 4

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

// ──────────────────────────────────────────────
// Template 1: 다크 비즈니스
// ──────────────────────────────────────────────
function drawT1(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string) {
  // 배경
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  bg.addColorStop(0, '#0c1228')
  bg.addColorStop(1, '#0f2044')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE)

  // 도트 패턴
  ctx.fillStyle = 'rgba(255,255,255,0.025)'
  for (let x = 50; x < SIZE; x += 70) for (let y = 50; y < SIZE; y += 70) {
    ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill()
  }

  // 상단 그라데이션 바
  const topBar = ctx.createLinearGradient(0, 0, SIZE, 0)
  topBar.addColorStop(0, '#06b6d4'); topBar.addColorStop(0.5, '#3b82f6'); topBar.addColorStop(1, '#8b5cf6')
  ctx.fillStyle = topBar; ctx.fillRect(0, 0, SIZE, 12)

  // 오른쪽 장식 원
  ctx.beginPath(); ctx.arc(SIZE + 100, -100, 380, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(59,130,246,0.07)'; ctx.fill()

  const PAD = 90

  // 회사명
  if (company) {
    ctx.font = `500 30px ${FONT}`; ctx.fillStyle = '#64748b'; ctx.textAlign = 'left'
    ctx.fillText(company, PAD, 90)
  }
  // 날짜
  if (date) {
    ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#475569'; ctx.textAlign = 'right'
    ctx.fillText(date, SIZE - PAD, 90)
  }

  // 구분선
  ctx.strokeStyle = 'rgba(51,65,85,0.8)'; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(PAD, 118); ctx.lineTo(SIZE - PAD, 118); ctx.stroke()

  // 공지사항 레이블
  ctx.font = `700 28px ${FONT}`; ctx.fillStyle = '#38bdf8'; ctx.textAlign = 'left'
  ctx.fillText('📢  공지사항', PAD, 170)

  // 제목
  let curY = 230
  if (title) {
    ctx.font = `800 72px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'
    const lines = wrapText(ctx, title, SIZE - PAD * 2)
    for (const l of lines) { ctx.fillText(l, PAD, curY); curY += 88 }
    curY += 20

    // 포인트 라인
    const accentGrad = ctx.createLinearGradient(PAD, 0, PAD + 200, 0)
    accentGrad.addColorStop(0, '#06b6d4'); accentGrad.addColorStop(1, 'transparent')
    ctx.strokeStyle = accentGrad; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(PAD + 200, curY); ctx.stroke()
    curY += 36
  }

  // 내용
  if (content) {
    ctx.font = `400 40px ${FONT}`; ctx.fillStyle = '#94a3b8'; ctx.textAlign = 'left'
    const lines = wrapText(ctx, content, SIZE - PAD * 2)
    for (const l of lines) {
      if (!l) { curY += 24; continue }
      ctx.fillText(l, PAD, curY); curY += 60
    }
  }

  // 하단 바
  ctx.fillStyle = topBar; ctx.fillRect(0, SIZE - 12, SIZE, 12)
}

// ──────────────────────────────────────────────
// Template 2: 클린 화이트
// ──────────────────────────────────────────────
function drawT2(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string) {
  // 배경
  ctx.fillStyle = '#f8fafc'; ctx.fillRect(0, 0, SIZE, SIZE)

  // 헤더 블록
  const headerH = 240
  const headerGrad = ctx.createLinearGradient(0, 0, SIZE, 0)
  headerGrad.addColorStop(0, '#1e40af'); headerGrad.addColorStop(1, '#3b82f6')
  ctx.fillStyle = headerGrad; ctx.fillRect(0, 0, SIZE, headerH)

  // 헤더 원형 장식
  ctx.beginPath(); ctx.arc(SIZE - 80, headerH / 2, 220, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill()
  ctx.beginPath(); ctx.arc(SIZE - 80, headerH / 2, 140, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fill()

  // 헤더 텍스트
  ctx.font = `800 52px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'
  ctx.fillText('공지사항', 80, 120)
  ctx.font = `400 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'
  ctx.fillText(company || '', 80, 170)

  // 날짜 (헤더 우측)
  if (date) {
    ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.textAlign = 'right'
    ctx.fillText(date, SIZE - 80, 170)
  }

  // 카드 영역
  const cardX = 60, cardY = 290, cardW = SIZE - 120, cardH = SIZE - 360
  ctx.shadowColor = 'rgba(0,0,0,0.08)'; ctx.shadowBlur = 40; ctx.shadowOffsetY = 8
  ctx.fillStyle = '#ffffff'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(cardX, cardY, cardW, cardH, 24)
  else ctx.rect(cardX, cardY, cardW, cardH)
  ctx.fill()
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

  // 카드 좌측 파란 테두리
  ctx.fillStyle = '#3b82f6'; ctx.fillRect(cardX, cardY, 8, cardH)

  const PAD = 72
  let curY = cardY + 76

  // 제목
  if (title) {
    ctx.font = `800 64px ${FONT}`; ctx.fillStyle = '#1e293b'; ctx.textAlign = 'left'
    const lines = wrapText(ctx, title, cardW - PAD - 20)
    for (const l of lines) { ctx.fillText(l, cardX + PAD, curY); curY += 80 }
    curY += 8

    // 구분선
    ctx.strokeStyle = '#e2e8f0'; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(cardX + PAD, curY); ctx.lineTo(cardX + cardW - 40, curY); ctx.stroke()
    curY += 44
  }

  // 내용
  if (content) {
    ctx.font = `400 38px ${FONT}`; ctx.fillStyle = '#475569'; ctx.textAlign = 'left'
    const lines = wrapText(ctx, content, cardW - PAD - 20)
    for (const l of lines) {
      if (!l) { curY += 22; continue }
      ctx.fillText(l, cardX + PAD, curY); curY += 58
    }
  }
}

// ──────────────────────────────────────────────
// Template 3: 에메랄드 그린
// ──────────────────────────────────────────────
function drawT3(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string) {
  // 배경
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE)
  bg.addColorStop(0, '#022c22'); bg.addColorStop(1, '#064e3b')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, SIZE, SIZE)

  // 장식 원
  ctx.beginPath(); ctx.arc(SIZE, 0, 500, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(16,185,129,0.06)'; ctx.fill()
  ctx.beginPath(); ctx.arc(0, SIZE, 400, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(16,185,129,0.05)'; ctx.fill()

  // 좌측 세로 바
  const vBar = ctx.createLinearGradient(0, 0, 0, SIZE)
  vBar.addColorStop(0, '#34d399'); vBar.addColorStop(1, '#059669')
  ctx.fillStyle = vBar; ctx.fillRect(0, 0, 10, SIZE)

  const PAD = 80

  // NOTICE 레이블
  ctx.font = `700 30px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'left'
  ctx.fillText('📢  N O T I C E', PAD, 95)

  // 회사명 우측
  if (company) {
    ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'right'
    ctx.fillText(company, SIZE - PAD, 95)
  }

  // 골드 구분선
  const goldGrad = ctx.createLinearGradient(PAD, 0, SIZE - PAD, 0)
  goldGrad.addColorStop(0, 'transparent'); goldGrad.addColorStop(0.15, '#fbbf24')
  goldGrad.addColorStop(0.85, '#fbbf24'); goldGrad.addColorStop(1, 'transparent')
  ctx.strokeStyle = goldGrad; ctx.lineWidth = 2
  ctx.beginPath(); ctx.moveTo(PAD, 124); ctx.lineTo(SIZE - PAD, 124); ctx.stroke()

  let curY = 220

  // 제목
  if (title) {
    ctx.font = `800 70px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'
    const lines = wrapText(ctx, title, SIZE - PAD * 2)
    for (const l of lines) { ctx.fillText(l, PAD, curY); curY += 86 }
    curY += 10

    // 녹색 언더라인
    ctx.strokeStyle = '#10b981'; ctx.lineWidth = 4
    ctx.beginPath(); ctx.moveTo(PAD, curY); ctx.lineTo(PAD + 120, curY); ctx.stroke()
    curY += 46
  }

  // 내용
  if (content) {
    ctx.font = `400 40px ${FONT}`; ctx.fillStyle = '#a7f3d0'; ctx.textAlign = 'left'
    const lines = wrapText(ctx, content, SIZE - PAD * 2)
    for (const l of lines) {
      if (!l) { curY += 24; continue }
      ctx.fillText(l, PAD, curY); curY += 60
    }
  }

  // 날짜 하단
  if (date) {
    ctx.font = `400 28px ${FONT}`; ctx.fillStyle = '#6ee7b7'; ctx.textAlign = 'right'
    ctx.fillText(date, SIZE - PAD, SIZE - 56)
  }

  // 하단 골드 바
  ctx.fillStyle = '#fbbf24'; ctx.fillRect(0, SIZE - 8, SIZE, 8)
}

// ──────────────────────────────────────────────
// Template 4: 웜 미니멀
// ──────────────────────────────────────────────
function drawT4(ctx: CanvasRenderingContext2D, title: string, content: string, date: string, company: string) {
  // 배경
  ctx.fillStyle = '#fffbf5'; ctx.fillRect(0, 0, SIZE, SIZE)

  // 배경 사각형 장식
  ctx.fillStyle = '#fef3c7'; ctx.fillRect(0, 0, SIZE, SIZE)
  ctx.fillStyle = '#fffbf5'
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(40, 40, SIZE - 80, SIZE - 80, 0)
  else ctx.rect(40, 40, SIZE - 80, SIZE - 80)
  ctx.fill()

  // 오렌지 상단 헤더 영역
  const headerH = 200
  const orangeGrad = ctx.createLinearGradient(0, 0, SIZE, 0)
  orangeGrad.addColorStop(0, '#ea580c'); orangeGrad.addColorStop(1, '#f97316')
  ctx.fillStyle = orangeGrad; ctx.fillRect(40, 40, SIZE - 80, headerH)

  // 헤더 내 장식 원
  ctx.beginPath(); ctx.arc(SIZE - 100, 40 + headerH / 2, 160, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.07)'; ctx.fill()

  // 헤더 텍스트
  ctx.font = `800 48px ${FONT}`; ctx.fillStyle = '#ffffff'; ctx.textAlign = 'left'
  ctx.fillText('공지사항', 110, 40 + 96)
  if (company) {
    ctx.font = `400 28px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.75)'
    ctx.fillText(company, 110, 40 + 152)
  }

  // 날짜
  if (date) {
    ctx.font = `400 26px ${FONT}`; ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.textAlign = 'right'
    ctx.fillText(date, SIZE - 110, 40 + 152)
  }

  // 좌측 오렌지 세로 바
  ctx.fillStyle = orangeGrad; ctx.fillRect(40, 40 + headerH, 8, SIZE - 80 - headerH)

  const PAD = 110
  let curY = 40 + headerH + 90

  // 제목
  if (title) {
    ctx.font = `800 66px ${FONT}`; ctx.fillStyle = '#1c1917'; ctx.textAlign = 'left'
    const lines = wrapText(ctx, title, SIZE - PAD - 60)
    for (const l of lines) { ctx.fillText(l, PAD, curY); curY += 82 }
    curY += 8

    // 오렌지 포인트 바
    ctx.fillStyle = '#f97316'; ctx.fillRect(PAD, curY, 80, 6)
    curY += 44
  }

  // 내용
  if (content) {
    ctx.font = `400 38px ${FONT}`; ctx.fillStyle = '#44403c'; ctx.textAlign = 'left'
    const lines = wrapText(ctx, content, SIZE - PAD - 60)
    for (const l of lines) {
      if (!l) { curY += 22; continue }
      ctx.fillText(l, PAD, curY); curY += 58
    }
  }

  // 하단 오렌지 바
  ctx.fillStyle = orangeGrad; ctx.fillRect(40, SIZE - 48, SIZE - 80, 8)
}

// ──────────────────────────────────────────────
// 메인 컴포넌트
// ──────────────────────────────────────────────
const TEMPLATES = [
  { id: 1 as TemplateId, name: '다크 비즈니스', colors: ['#0c1228', '#0f2044'], accent: '#38bdf8', textColor: '#fff' },
  { id: 2 as TemplateId, name: '클린 화이트',   colors: ['#1e40af', '#3b82f6'], accent: '#3b82f6', textColor: '#fff' },
  { id: 3 as TemplateId, name: '에메랄드 그린', colors: ['#022c22', '#064e3b'], accent: '#34d399', textColor: '#6ee7b7' },
  { id: 4 as TemplateId, name: '웜 오렌지',     colors: ['#ea580c', '#f97316'], accent: '#f97316', textColor: '#fff' },
]

export default function NoticePage() {
  const supabase = createClient()
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const [selectedTpl, setSelectedTpl] = useState<TemplateId>(1)
  const [title, setTitle]         = useState('')
  const [content, setContent]     = useState('')
  const [date, setDate]           = useState(() => new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }))
  const [companyName, setCompanyName] = useState('')

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
    switch (selectedTpl) {
      case 1: drawT1(ctx, title, content, date, companyName); break
      case 2: drawT2(ctx, title, content, date, companyName); break
      case 3: drawT3(ctx, title, content, date, companyName); break
      case 4: drawT4(ctx, title, content, date, companyName); break
    }
  }, [selectedTpl, title, content, date, companyName])

  useEffect(() => { render() }, [render])

  const handleDownload = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `공지사항_${title || '이미지'}.png`
    document.body.appendChild(a); a.click(); document.body.removeChild(a)
  }

  const handleReset = () => {
    setTitle(''); setContent('')
    setDate(new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }))
  }

  const tplConfig = TEMPLATES.find(t => t.id === selectedTpl)!

  return (
    <div className="p-6 space-y-6 max-w-6xl">
      <div>
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Megaphone className="h-6 w-6 text-blue-400" />
          공지사항 생성
        </h2>
        <p className="text-slate-400 text-sm mt-1">라이더에게 문자·카카오톡으로 발송할 공지 이미지를 생성하세요</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* ── 왼쪽: 설정 패널 ── */}
        <div className="space-y-5">

          {/* 템플릿 선택 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">배경 템플릿 선택</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                {TEMPLATES.map(tpl => (
                  <button
                    key={tpl.id}
                    onClick={() => setSelectedTpl(tpl.id)}
                    className={`relative rounded-xl overflow-hidden border-2 transition-all ${
                      selectedTpl === tpl.id
                        ? 'border-blue-500 ring-2 ring-blue-500/40 scale-[0.97]'
                        : 'border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {/* 미니 미리보기 */}
                    <div
                      className="h-24 w-full flex flex-col items-start justify-end p-3 gap-1"
                      style={{ background: `linear-gradient(135deg, ${tpl.colors[0]}, ${tpl.colors[1]})` }}
                    >
                      <div className="h-2 rounded-full opacity-80" style={{ width: '60%', background: tpl.accent }} />
                      <div className="h-1.5 rounded-full opacity-40 bg-white" style={{ width: '80%' }} />
                      <div className="h-1.5 rounded-full opacity-30 bg-white" style={{ width: '55%' }} />
                    </div>
                    <div className="bg-slate-800 px-2 py-1.5 flex items-center justify-between">
                      <span className="text-slate-300 text-xs font-medium">{tpl.name}</span>
                      {selectedTpl === tpl.id && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-blue-400" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* 내용 입력 */}
          <Card className="border-slate-700 bg-slate-900">
            <CardHeader className="pb-3">
              <CardTitle className="text-white text-sm">공지 내용 입력</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">회사명</Label>
                <Input
                  value={companyName}
                  onChange={e => setCompanyName(e.target.value)}
                  placeholder="자동으로 불러옵니다 (수정 가능)"
                  className="bg-slate-800 border-slate-600 text-white h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-400 text-xs">날짜</Label>
                <Input
                  value={date}
                  onChange={e => setDate(e.target.value)}
                  placeholder="2025년 3월 5일"
                  className="bg-slate-800 border-slate-600 text-white h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-medium">제목 <span className="text-blue-400">*</span></Label>
                <Input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="공지사항 제목을 입력하세요"
                  className="bg-slate-800 border-slate-600 text-white h-10"
                  maxLength={30}
                />
                <p className="text-slate-600 text-xs text-right">{title.length}/30자</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs font-medium">내용</Label>
                <Textarea
                  value={content}
                  onChange={e => setContent(e.target.value)}
                  placeholder={"공지 내용을 입력하세요.\n줄바꿈은 Enter로 입력합니다."}
                  className="bg-slate-800 border-slate-600 text-white text-sm resize-none"
                  rows={6}
                  maxLength={300}
                />
                <p className="text-slate-600 text-xs text-right">{content.length}/300자</p>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="border-slate-600 text-slate-400 hover:bg-slate-800 hover:text-white gap-2"
                >
                  <RefreshCw className="h-4 w-4" />초기화
                </Button>
                <Button
                  onClick={handleDownload}
                  className="flex-1 gap-2"
                  style={{ background: tplConfig.accent }}
                  disabled={!title && !content}
                >
                  <Download className="h-4 w-4" />
                  이미지 다운로드 (PNG)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* ── 오른쪽: 미리보기 ── */}
        <div className="space-y-3">
          <p className="text-slate-400 text-sm font-medium">미리보기 <span className="text-slate-600 text-xs">(실제 다운로드: 1080×1080px)</span></p>
          <div className="rounded-xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-950 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={SIZE}
              height={SIZE}
              className="w-full max-w-[540px] aspect-square"
              style={{ imageRendering: 'auto' }}
            />
          </div>
          <p className="text-slate-600 text-xs text-center">
            1080×1080 정사각형 · 카카오톡/문자 발송에 최적화된 사이즈
          </p>
        </div>
      </div>
    </div>
  )
}
