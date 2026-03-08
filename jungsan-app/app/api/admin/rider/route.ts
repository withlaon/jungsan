import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * 라이더 개별 등록
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const body = await request.json()
    const { join_date, name, rider_username, id_number, phone, bank_name, bank_account, account_holder, status = 'active' } = body ?? {}

    if (!name?.trim()) return NextResponse.json({ error: '라이더명을 입력해주세요.' }, { status: 400 })

    const row = {
      user_id: user.id,
      join_date: join_date?.trim() || null,
      name: String(name).trim(),
      rider_username: rider_username?.trim() || null,
      id_number: id_number?.trim() || null,
      phone: phone?.trim() || null,
      bank_name: bank_name?.trim() || null,
      bank_account: bank_account?.trim() || null,
      account_holder: account_holder?.trim() || null,
      status: status === 'inactive' ? 'inactive' : 'active',
    }

    const admin = createAdminClient()
    const { error } = await admin.from('riders').insert(row)
    if (error) {
      const msg = /unique|duplicate/i.test(error.message) ? '이미 사용 중인 아이디입니다.' : error.message
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('rider insert error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/**
 * 라이더 수정
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const body = await request.json()
    const { id, join_date, name, rider_username, id_number, phone, bank_name, bank_account, account_holder, status } = body ?? {}

    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: '라이더명을 입력해주세요.' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('riders').update({
      join_date: join_date?.trim() || null,
      name: String(name).trim(),
      rider_username: rider_username?.trim() || null,
      id_number: id_number?.trim() || null,
      phone: phone?.trim() || null,
      bank_name: bank_name?.trim() || null,
      bank_account: bank_account?.trim() || null,
      account_holder: account_holder?.trim() || null,
      status: status === 'inactive' ? 'inactive' : 'active',
    }).eq('id', id)

    if (error) {
      const msg = /unique|duplicate/i.test(error.message) ? '이미 사용 중인 아이디입니다.' : error.message
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('rider update error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/**
 * 라이더 삭제
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

    const admin = createAdminClient()
    const { error } = await admin.from('riders').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('rider delete error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
