import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/rider/by-ssn?ssn=<id_number>
 * 주민등록번호로 라이더 조회 (RLS 우회)
 * - 정규화된 형식(숫자만), 하이픈 포함 형식 모두 비교
 */
export async function GET(req: NextRequest) {
  try {
    const ssn = req.nextUrl.searchParams.get('ssn')
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

    const { data, error } = await db
      .from('riders')
      .select('*')
      .or(`id_number.eq.${ssn},id_number.eq.${normalized},id_number.eq.${formatted}`)
      .eq('status', 'active')
      .maybeSingle()

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
