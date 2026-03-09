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

    const supabase = createAdminClient()
    await supabase.from('site_visits').insert({ path, referrer, user_agent: userAgent, ip_hash: ipHash })

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 })
  }
}
