import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    // site-admin 인증 확인
    const supabaseUser = await createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabaseUser
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .single()
    if (profile?.username !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admin = createAdminClient()

    // KST(UTC+9) 기준 날짜 계산
    const KST_OFFSET = 9 * 60 * 60 * 1000
    const nowKST = new Date(Date.now() + KST_OFFSET)
    const pad = (n: number) => String(n).padStart(2, '0')
    const kstDateStr = (d: Date) =>
      `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`

    const todayStr = kstDateStr(nowKST)
    const tomorrowStr = kstDateStr(new Date(nowKST.getTime() + 24 * 60 * 60 * 1000))

    // 이번주 일요일 0시 (KST)
    const weekStartKST = new Date(nowKST.getTime() - nowKST.getUTCDay() * 24 * 60 * 60 * 1000)
    const weekStartStr = `${kstDateStr(weekStartKST)}T00:00:00+09:00`

    // 이번달 1일 0시 (KST)
    const monthStartStr = `${nowKST.getUTCFullYear()}-${pad(nowKST.getUTCMonth() + 1)}-01T00:00:00+09:00`

    // 전체 방문 수
    const { count: total } = await admin
      .from('site_visits')
      .select('*', { count: 'exact', head: true })

    // 오늘 (KST 0시 기준, 중복 IP 없음)
    const { count: today } = await admin
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .gte('visited_at', `${todayStr}T00:00:00+09:00`)
      .lt('visited_at', `${tomorrowStr}T00:00:00+09:00`)

    // 이번주
    const { count: week } = await admin
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .gte('visited_at', weekStartStr)

    // 이번달
    const { count: month } = await admin
      .from('site_visits')
      .select('*', { count: 'exact', head: true })
      .gte('visited_at', monthStartStr)

    // 최근 8주 주간 방문 추이
    const weeklyStats: { label: string; count: number }[] = []
    for (let i = 7; i >= 0; i--) {
      const wsDays = nowKST.getUTCDay() + i * 7
      const ws = new Date(nowKST.getTime() - wsDays * 24 * 60 * 60 * 1000)
      const we = new Date(ws.getTime() + 7 * 24 * 60 * 60 * 1000)
      const { count: wc } = await admin
        .from('site_visits')
        .select('*', { count: 'exact', head: true })
        .gte('visited_at', `${kstDateStr(ws)}T00:00:00+09:00`)
        .lt('visited_at', `${kstDateStr(we)}T00:00:00+09:00`)
      weeklyStats.push({
        label: `${ws.getUTCMonth() + 1}/${ws.getUTCDate()}`,
        count: wc ?? 0,
      })
    }

    // 경로별 방문 TOP 5
    const { data: pathRows } = await admin
      .from('site_visits')
      .select('path')
      .order('visited_at', { ascending: false })
      .limit(1000)

    const pathMap: Record<string, number> = {}
    for (const row of pathRows ?? []) {
      pathMap[row.path] = (pathMap[row.path] ?? 0) + 1
    }
    const topPaths = Object.entries(pathMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([path, count]) => ({ path, count }))

    // 일별 방문 (최근 7일, KST 0시 기준)
    const dailyStats: { label: string; count: number }[] = []
    for (let i = 6; i >= 0; i--) {
      const d = new Date(nowKST.getTime() - i * 24 * 60 * 60 * 1000)
      const dateStr = kstDateStr(d)
      const nextD = new Date(d.getTime() + 24 * 60 * 60 * 1000)
      const nextDateStr = kstDateStr(nextD)
      const { count: dc } = await admin
        .from('site_visits')
        .select('*', { count: 'exact', head: true })
        .gte('visited_at', `${dateStr}T00:00:00+09:00`)
        .lt('visited_at', `${nextDateStr}T00:00:00+09:00`)
      dailyStats.push({
        label: `${d.getUTCMonth() + 1}/${d.getUTCDate()}`,
        count: dc ?? 0,
      })
    }

    return NextResponse.json({ total, today, week, month, weeklyStats, dailyStats, topPaths })
  } catch (e) {
    console.error(e)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
