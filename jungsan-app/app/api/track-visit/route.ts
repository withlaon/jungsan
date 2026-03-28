import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const path = typeof body.path === 'string' ? body.path.slice(0, 200) : '/'
    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, 500) : null
    const userAgent = req.headers.get('user-agent')?.slice(0, 300) ?? null

    // IP를 단방향 해시로 저장 (개인정보 보호)
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim()
      ?? req.headers.get('x-real-ip')
      ?? 'unknown'
    const ipHash = crypto.createHash('sha256').update(ip + 'jungsan-salt').digest('hex').slice(0, 16)

    // KST(UTC+9) 기준 오늘 날짜 범위 계산
    const KST_OFFSET = 9 * 60 * 60 * 1000
    const nowKST = new Date(Date.now() + KST_OFFSET)
    const pad = (n: number) => String(n).padStart(2, '0')
    const todayKST = `${nowKST.getUTCFullYear()}-${pad(nowKST.getUTCMonth() + 1)}-${pad(nowKST.getUTCDate())}`
    const tomorrowKST = new Date(nowKST.getTime() + 24 * 60 * 60 * 1000)
    const tomorrowStr = `${tomorrowKST.getUTCFullYear()}-${pad(tomorrowKST.getUTCMonth() + 1)}-${pad(tomorrowKST.getUTCDate())}`

    const supabase = createAdminClient()

    // 동일 IP가 오늘(KST 0시 기준) 이미 방문한 경우 카운팅 제외
    const { count: existing } = await supabase
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .eq('ip_hash', ipHash)
      .gte('visited_at', `${todayKST}T00:00:00+09:00`)
      .lt('visited_at', `${tomorrowStr}T00:00:00+09:00`)

    if ((existing ?? 0) > 0) {
      return NextResponse.json({ ok: true })
    }

    await supabase.from('site_visits').insert({ path, referrer, user_agent: userAgent, ip_hash: ipHash })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
