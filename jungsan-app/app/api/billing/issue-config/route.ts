/**
 * GET /api/billing/issue-config
 * 로그인한 관리자에게 빌링키 발급용 storeId·channelKey 를 내려줍니다.
 * 채널 키는 서버 env 우선순위(getBillingChannelKeyServer)로 통일해
 * 해외카드 전용 NEXT_PUBLIC 키와 국내/서버 전용 키를 분리할 수 있습니다.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getBillingChannelKeyServer } from '@/lib/portone/billing-channel-key'
import { getPortOneApiSecret } from '@/lib/portone/api-secret'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() ?? ''
    const channelKey = getBillingChannelKeyServer()

    if (!storeId || !channelKey) {
      return NextResponse.json(
        {
          error:
            '빌링(구독) 채널이 설정되지 않았습니다. 서버에 PORTONE_BILLING_CHANNEL_KEY_DOMESTIC ' +
            '(포트원「국내 정기결제·빌링키」채널 키) 또는 NEXT_PUBLIC_PORTONE_BILLING_CHANNEL_KEY_DOMESTIC 을 설정하세요. ' +
            '해외카드 전용 채널이면 국내 카드가 계속 거절됩니다.',
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        storeId,
        channelKey,
        apiSecretConfigured: getPortOneApiSecret() !== '',
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (e) {
    console.error('[billing/issue-config]', e)
    return NextResponse.json({ error: '설정 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
