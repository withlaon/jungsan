import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

/**
 * 창 닫힘 시 navigator.sendBeacon() 으로 호출되는 서버사이드 로그아웃 엔드포인트
 * - sendBeacon은 브라우저가 응답을 기다리지 않고 전송만 함
 * - 서버에서 Supabase 세션(refresh token)을 무효화하여 재접속 시 로그인 필요하게 만듦
 */
export async function POST(request: NextRequest) {
  const response = new NextResponse(null, { status: 200 })

  try {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              // maxAge: 0 으로 쿠키 즉시 삭제
              response.cookies.set(name, value, { ...options, maxAge: 0 })
            })
          },
        },
      }
    )

    await supabase.auth.signOut()
  } catch {
    // 오류가 있어도 200 반환 (beacon은 응답을 확인하지 않음)
  }

  return response
}
