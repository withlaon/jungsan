import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/rider/by-ssn?ssn=<id_number>[&username=<admin_username>]
 * 주민등록번호로 라이더 조회 (RLS 우회)
 * - username 파라미터가 있으면 해당 관리자 소속 라이더만 조회 (계정별 독립 분리)
 * - username 없으면 전체 조회 (기존 /rider 호환)
 */
export async function GET(req: NextRequest) {
  try {
    const ssn = req.nextUrl.searchParams.get('ssn')
    const username = req.nextUrl.searchParams.get('username') // 관리자 아이디

    if (!ssn) {
      return NextResponse.json({ error: 'ssn이 필요합니다.' }, { status: 400 })
    }

    const normalized = ssn.replace(/[-\s]/g, '').replace(/\D/g, '')
    if (normalized.length !== 13) {
      return NextResponse.json({ error: '주민등록번호 13자리를 입력해주세요.' }, { status: 400 })
    }
    const formatted = normalized.replace(/^(\d{6})(\d{7})$/, '$1-$2')

    let db: ReturnType<typeof createAdminClient> | Awaited<ReturnType<typeof createClient>>
    try {
      db = createAdminClient()
    } catch {
      db = await createClient()
    }

    // username이 있으면 해당 관리자의 user_id를 먼저 조회
    let adminUserId: string | null = null
    if (username) {
      const { data: profile } = await db
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle()

      if (!profile) {
        return NextResponse.json({ notFound: true }, { status: 404 })
      }
      adminUserId = profile.id
    }

    // SSN으로 라이더 조회 (관리자 필터 적용)
    let query = db
      .from('riders')
      .select('*')
      .or(`id_number.eq.${ssn},id_number.eq.${normalized},id_number.eq.${formatted}`)
      .eq('status', 'active')

    if (adminUserId) {
      query = query.eq('user_id', adminUserId)
    }

    const { data, error } = await query.maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!data) {
      return NextResponse.json({ notFound: true }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('rider by-ssn error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
