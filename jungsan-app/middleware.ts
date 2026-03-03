import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

// 로그인 없이 접근 가능한 경로
const PUBLIC_PATHS = ['/', '/login', '/signup']

// 보호 대상 경로 접두사 (이 경로 아래는 모두 로그인 필요)
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/riders',
  '/advance-payments',
  '/promotions',
  '/settings',
  '/settlement',
  '/rider-site',
  '/site-admin',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API 라우트, 라이더 토큰 페이지, 정적 파일은 미들웨어 제외
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/rider/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Supabase 쿠키 기반 세션 확인
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))
  const isPublic    = PUBLIC_PATHS.includes(pathname)

  // 미인증 상태에서 보호 경로 접근 → 로그인 페이지로 이동
  if (isProtected && !user) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.searchParams.set('redirect', pathname)
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
