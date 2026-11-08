import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { readTaxSettings, writeTaxSettings } from '@/lib/tax-report/settings-store'

async function getAuthUser() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

/**
 * ?�이??개별 ?�록
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: '로그?�이 ?�요?�니??' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    const body = await request.json()
    const { join_date, name, rider_username, id_number, phone, bank_name, bank_account, account_holder, status = 'active' } = body ?? {}

    if (!name?.trim()) return NextResponse.json({ error: '?�이?�명???�력?�주?�요.' }, { status: 400 })

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

    const { data: inserted, error } = await admin.from('riders').insert(row).select().single()
    if (error) {
      const msg = /unique|duplicate/i.test(error.message) ? '?��? ?�용 중인 ?�이?�입?�다.' : error.message
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ success: true, rider: inserted })
  } catch (err) {
    console.error('rider insert error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/**
 * ?�이???�정
 */
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: '로그?�이 ?�요?�니??' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('username')
      .eq('id', user.id)
      .maybeSingle()

    const body = await request.json()
    const { id, join_date, name, rider_username, id_number, phone, bank_name, bank_account, account_holder, status } = body ?? {}

    if (!id) return NextResponse.json({ error: 'id가 ?�요?�니??' }, { status: 400 })
    if (!name?.trim()) return NextResponse.json({ error: '?�이?�명???�력?�주?�요.' }, { status: 400 })

  const trim = (v: unknown) => (v != null && String(v).trim()) || null

    const { data: updated, error } = await admin.from('riders').update({
      join_date:       trim(join_date),
      name:            String(name).trim(),
      rider_username:  trim(rider_username),
      id_number:       trim(id_number),
      phone:           trim(phone),
      bank_name:       trim(bank_name),
      bank_account:    trim(bank_account),
      account_holder:  trim(account_holder),
      status: status === 'inactive' ? 'inactive' : 'active',
    }).eq('id', id).select().single()

    if (error) {
      const msg = /unique|duplicate/i.test(error.message) ? '?��? ?�용 중인 ?�이?�입?�다.' : error.message
      return NextResponse.json({ error: msg }, { status: 500 })
    }
    return NextResponse.json({ success: true, rider: updated })
  } catch (err) {
    console.error('rider update error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}

/**
 * ?�이????��
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthUser()
    if (!user) return NextResponse.json({ error: '로그?�이 ?�요?�니??' }, { status: 401 })

    const admin = createAdminClient()
    const body = await request.json().catch(() => ({}))
    const id = typeof body?.id === 'string' ? body.id : ''
    if (!id) return NextResponse.json({ error: 'id가 필요합니다.' }, { status: 400 })

    const { data: rider, error: riderError } = await admin
      .from('riders')
      .select('id, user_id')
      .eq('id', id)
      .maybeSingle()
    if (riderError) return NextResponse.json({ error: riderError.message }, { status: 500 })
    if (!rider) return NextResponse.json({ error: '라이더를 찾을 수 없습니다.' }, { status: 404 })
    if (rider.user_id && rider.user_id !== user.id) {
      return NextResponse.json({ error: '삭제 권한이 없습니다.' }, { status: 403 })
    }

    const relatedTables = [
      'settlement_details',
      'advance_payments',
      'promotions',
      'management_fees',
      'insurance_fees',
    ] as const

    for (const table of relatedTables) {
      for (;;) {
        const { data, error } = await admin.from(table).delete().eq('rider_id', id).select('id')
        if (error) return NextResponse.json({ error: `${table} 삭제 실패: ${error.message}` }, { status: 500 })
        if (!data || data.length < 1000) break
      }
    }

    const { error } = await admin.from('riders').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    try {
      const settings = await readTaxSettings(user.id)
      const next = settings.filter((row) => row.rider_id !== id)
      if (next.length !== settings.length) await writeTaxSettings(user.id, next)
    } catch (settingsError) {
      console.warn('tax settings cleanup:', settingsError)
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('rider delete error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Server error' }, { status: 500 })
  }
}
