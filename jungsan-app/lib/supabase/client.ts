import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        // sessionStorage 사용: 탭/브라우저 닫으면 세션 자동 삭제 → 재접속 시 로그인 페이지
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        persistSession: true,
      },
    }
  )
}
