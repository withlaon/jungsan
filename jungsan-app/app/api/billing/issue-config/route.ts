/**
 * GET /api/billing/issue-config
 * 로그인한 관리자에게 빌링키 발급용 storeId·channelKey 를 내려줍니다.
 * 채널 키는 서버 env 우선순위(getBillingChannelKeyServer)로 통일해
 * 해외카드 전용 NEXT_PUBLIC 키와 국내/서버 전용 키를 분리할 수 있습니다.
 *
 * NHN KCP: requestIssueBillingKey에는 일반 결제 채널이 아닌 정기·빌링용 채널(배치결제그룹아이디 설정)을 사용해야 합니다.
 * @see https://help.portone.io/content/kcp_channel
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
            '(콘솔에서 NHN KCP 「정기·빌링」 결제모듈 + 배치결제그룹아이디 필수 입력 채널의 키)를 설정하세요. ' +
            '일반 결제 채널 키는 빌링키 발급에 사용할 수 없습니다. https://help.portone.io/content/kcp_channel',
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
