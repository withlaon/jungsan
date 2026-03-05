import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// 로그인 없이 접근 가능한 경로
const PUBLIC_PATHS = new Set(['/', '/login', '/signup'])

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
  '/manual',
  '/notice',
]

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const { pathname } = request.nextUrl

  // 라이더 토큰 페이지, API, 정적 파일은 인증 불필요
  if (
    pathname.startsWith('/rider/') ||
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/')
  ) {
    return supabaseResponse
  }

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
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              // expires / maxAge 제거 → 세션 쿠키로 설정
              // 브라우저/탭을 닫으면 쿠키가 자동 삭제되어 재접속 시 로그인 페이지로 이동
              supabaseResponse.cookies.set(name, value, {
                ...options,
                expires: undefined,
                maxAge: undefined,
              })
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const isProtected = PROTECTED_PREFIXES.some(p => pathname.startsWith(p))

    // 미인증 상태에서 보호 경로 접근 → 로그인 페이지로 리다이렉트
    if (isProtected && !user) {
      const redirectUrl = new URL('/', request.url)
      const from = pathname + request.nextUrl.search
      if (from && from !== '/') redirectUrl.searchParams.set('redirect', from)
      return NextResponse.redirect(redirectUrl)
    }

    // 인증된 상태에서 루트(/) 또는 /login 접근 → 대시보드로 리다이렉트
    if (user && (pathname === '/' || pathname === '/login')) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  } catch {
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
