import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })
  // proxy.ts replaces middleware.ts in Next.js 16

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
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const { pathname } = request.nextUrl

    // 라이더 사이트는 인증 불필요
    if (pathname.startsWith('/rider')) {
      return supabaseResponse
    }

    // 회원가입 페이지는 인증 불필요
    if (pathname === '/signup') {
      return supabaseResponse
    }

    // 로그인 페이지 또는 루트: 이미 로그인된 경우 대시보드로
    if (pathname === '/login' || pathname === '/') {
      if (user) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
      return supabaseResponse
    }

    // 관리자 페이지: 로그인 필요 (메인/로그인 페이지로 리다이렉트)
    if (!user) {
      const redirectUrl = new URL('/', request.url)
      const from = pathname + request.nextUrl.search
      if (from && from !== '/') redirectUrl.searchParams.set('redirect', from)
      return NextResponse.redirect(redirectUrl)
    }

    // 새로고침(직접 URL 접근) 시 대시보드로 이동
    const isPageRequest = request.headers.get('accept')?.includes('text/html')
    const isNextInternal = request.headers.get('next-router-prefetch') || request.headers.get('rsc')
    if (isPageRequest && !isNextInternal && pathname !== '/dashboard') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    return supabaseResponse
  } catch {
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
}
