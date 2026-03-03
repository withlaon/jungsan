import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * 라이더 개별 등록 API
 * - 로그인 사용자 확인 후 riders 테이블에 삽입
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      join_date,
      name,
      rider_username,
      id_number,
      phone,
      bank_name,
      bank_account,
      account_holder,
      status = 'active',
    } = body ?? {}

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '라이더명을 입력해주세요.' }, { status: 400 })
    }

    const row = {
      join_date: join_date && String(join_date).trim() ? String(join_date).trim() : null,
      name: String(name).trim(),
      rider_username: rider_username && String(rider_username).trim() ? String(rider_username).trim() : null,
      id_number: id_number && String(id_number).trim() ? String(id_number).trim() : null,
      phone: phone && String(phone).trim() ? String(phone).trim() : null,
      bank_name: bank_name && String(bank_name).trim() ? String(bank_name).trim() : null,
      bank_account: bank_account && String(bank_account).trim() ? String(bank_account).trim() : null,
      account_holder: account_holder && String(account_holder).trim() ? String(account_holder).trim() : null,
      status: (status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    }

    let error: { message: string } | null = null

    try {
      const admin = createAdminClient()
      const withUserId = { ...row, user_id: user.id }
      const { error: insertError } = await admin.from('riders').insert(withUserId)
      error = insertError
      if (insertError && /user_id|schema|cache|column/i.test(insertError.message)) {
        const { error: retryError } = await admin.from('riders').insert(row)
        error = retryError
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/SUPABASE_SERVICE_ROLE_KEY|설정되지 않았습니다/i.test(msg)) {
        const { error: rpcError } = await supabase.rpc('insert_rider', {
          p_join_date: row.join_date,
          p_name: row.name,
          p_rider_username: row.rider_username,
          p_id_number: row.id_number,
          p_phone: row.phone,
          p_bank_name: row.bank_name,
          p_bank_account: row.bank_account,
          p_account_holder: row.account_holder,
          p_status: row.status,
        })
        error = rpcError
      } else {
        throw e
      }
    }

    if (error) {
      const msg = /unique|duplicate/i.test(error.message) ? '이미 사용 중인 아이디입니다.' : error.message
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('rider insert error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
