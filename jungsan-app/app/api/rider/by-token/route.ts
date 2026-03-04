import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/rider/by-token?token=<access_token>
 * 라이더 토큰으로 라이더 정보 조회 (RLS 우회)
 */
export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token')
    if (!token) {
      return NextResponse.json({ error: 'token이 필요합니다.' }, { status: 400 })
    }

    let db: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>
    try {
      db = createAdminClient()
    } catch {
      db = await createClient()
    }

    const { data, error } = await db
      .from('riders')
      .select('*')
      .eq('access_token', token)
      .single()

    if (error || !data) {
      return NextResponse.json({ error: '라이더를 찾을 수 없습니다.' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('rider by-token error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
