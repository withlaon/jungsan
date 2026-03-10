import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // @supabase/ssr 0.8+: auth.storage 오버라이드 없이 기본 쿠키 스토리지 사용
  // → 서버 API 라우트에서 쿠키를 통해 세션을 읽을 수 있음
  // 자동 로그아웃은 InactivityGuard 컴포넌트가 처리
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
