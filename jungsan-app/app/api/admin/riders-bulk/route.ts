import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { merchantSubscriptionAccessDenied } from '@/lib/subscription/merchant-subscription-access'

interface RiderRow {
  join_date: string | null
  name: string
  rider_username: string | null
  id_number: string | null
  phone: string | null
  bank_name: string | null
  bank_account: string | null
  account_holder: string | null
  status?: string
}

/**
 * 라이더 엑셀 대량등록 API
 * - admin client로 직접 삽입 (SUPABASE_SERVICE_ROLE_KEY 필요)
 * - 없으면 RPC fallback
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()
    const denied = await merchantSubscriptionAccessDenied(admin, user.id, profile?.username)
    if (denied) return denied

    const body = await request.json()
    const riders = body?.riders as RiderRow[] | undefined
    if (!Array.isArray(riders) || riders.length === 0) {
      return NextResponse.json({ error: '등록할 라이더 데이터가 없습니다.' }, { status: 400 })
    }

    const rows = riders.map((r) => ({
      join_date: r.join_date && r.join_date.trim() ? r.join_date.trim() : null,
      name: String(r.name ?? '').trim(),
      rider_username: r.rider_username && String(r.rider_username).trim() ? String(r.rider_username).trim() : null,
      id_number: r.id_number && String(r.id_number).trim() ? String(r.id_number).trim() : null,
      phone: r.phone && String(r.phone).trim() ? String(r.phone).trim() : null,
      bank_name: r.bank_name && String(r.bank_name).trim() ? String(r.bank_name).trim() : null,
      bank_account: r.bank_account && String(r.bank_account).trim() ? String(r.bank_account).trim() : null,
      account_holder: r.account_holder && String(r.account_holder).trim() ? String(r.account_holder).trim() : null,
      status: (r.status === 'inactive' ? 'inactive' : 'active') as 'active' | 'inactive',
    }))

    const validRows = rows.filter((r) => r.name.length > 0)
    if (validRows.length === 0) {
      return NextResponse.json({ error: '유효한 라이더 데이터가 없습니다. (라이더명 필수)' }, { status: 400 })
    }

    let error: { message: string } | null = null

    try {
      const withUserId = validRows.map((r) => ({ ...r, user_id: user.id }))
      const { error: insertError } = await admin.from('riders').insert(withUserId)
      error = insertError
      if (insertError && /user_id|schema|cache|column/i.test(insertError.message)) {
        const { error: retryError } = await admin.from('riders').insert(validRows)
        error = retryError
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      if (/SUPABASE_SERVICE_ROLE_KEY|설정되지 않았습니다/i.test(msg)) {
        const { error: rpcErr } = await supabase.rpc('insert_riders_bulk', {
          p_user_id: user.id,
          p_riders: validRows,
        })
        error = rpcErr
        if (rpcErr && /user_id|column|undefined|function/i.test(rpcErr.message)) {
          const { error: legacyErr } = await supabase.rpc('insert_riders_bulk_legacy', { p_riders: validRows })
          error = legacyErr
        }
      } else {
        throw e
      }
    }

    if (error) {
      const msg = /unique|duplicate/i.test(error.message)
        ? '아이디 중복이 있습니다. 기존 라이더 또는 파일 내 중복을 확인해주세요.'
        : error.message
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: validRows.length })
  } catch (err) {
    console.error('riders-bulk error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Server error' },
      { status: 500 }
    )
  }
}
