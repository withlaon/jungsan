import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { readFilings, sanitizeFilingFiles, writeFiling } from '@/lib/tax-report/filings-store'

export const dynamic = 'force-dynamic'

const noStore = { 'Cache-Control': 'no-store' }

async function requireUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

export async function GET() {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: noStore })
  try {
    const filings = await readFilings(user.id)
    return NextResponse.json({ filings }, { headers: noStore })
  } catch {
    return NextResponse.json({ filings: [] }, { headers: noStore })
  }
}

export async function PUT(request: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401, headers: noStore })

  const body = await request.json().catch(() => null) as { month?: string; files?: unknown; supplyAmount?: unknown } | null
  const month = body?.month?.trim() ?? ''
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: '신고월이 필요합니다.' }, { status: 400, headers: noStore })
  }
  const files = sanitizeFilingFiles(body?.files)
  if (files.length === 0) {
    return NextResponse.json({ error: '저장할 정산 파일이 없습니다.' }, { status: 400, headers: noStore })
  }
  const supplyAmount = Math.max(0, Math.round(Number(body?.supplyAmount) || 0))

  try {
    const filing = { month, savedAt: new Date().toISOString(), supplyAmount, files }
    await writeFiling(user.id, filing)
    return NextResponse.json({ filing }, { headers: noStore })
  } catch {
    return NextResponse.json({ error: '저장에 실패했습니다.' }, { status: 500, headers: noStore })
  }
}
