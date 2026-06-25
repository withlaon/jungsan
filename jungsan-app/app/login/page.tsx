'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bike, Loader2, UserPlus } from 'lucide-react'
import { merchantHasAppAccessFromBillingApiPayload } from '@/lib/subscription/merchant-subscription-access'

const LOGIN_STEP_TIMEOUT_MS = 6_000   // 개별 단계 타임아웃
const BILLING_FETCH_TIMEOUT_MS = 5_000 // billing/status 타임아웃

/** 타임아웃이 되면 undefined 반환 */
function raceTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    Promise.resolve(promise).then((v) => v as T | undefined).catch((): undefined => undefined),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ])
}

/**
 * 로그인 후 이동할 경로를 결정합니다.
 * - 각 단계에 타임아웃 적용 (네트워크 지연 방어)
 * - billing/status 타임아웃 시에는 '/subscription' 대신 safe URL(대시보드)로 이동
 *   (이미 인증이 완료된 사용자를 불필요하게 구독 페이지로 보내지 않음)
 */
async function resolvePostLoginRedirect(
  supabase: ReturnType<typeof createClient>,
  redirectTo: string,
  knownUserId?: string | null
): Promise<string> {
  const safe = redirectTo.startsWith('/') ? redirectTo : '/dashboard'

  try {
    // userId가 없으면 서버 검증 필요 (타임아웃 적용)
    let uid = knownUserId
    if (!uid) {
      const userResult = await raceTimeout(supabase.auth.getUser(), LOGIN_STEP_TIMEOUT_MS)
      uid = userResult?.data?.user?.id ?? null
    }
    if (!uid) return safe

    // profiles 쿼리 + billing 상태를 병렬로 실행 (타임아웃 각각 적용)
    // billing fetch용 AbortController (구형 브라우저 AbortSignal.timeout 미지원 대비)
    const billingAbort = new AbortController()
    const billingAbortTimer = setTimeout(() => billingAbort.abort(), BILLING_FETCH_TIMEOUT_MS)

    const [profRes, billingRes] = await Promise.all([
      raceTimeout(
        supabase.from('profiles').select('username').eq('id', uid).maybeSingle(),
        LOGIN_STEP_TIMEOUT_MS
      ),
      raceTimeout(
        fetch('/api/billing/status', {
          credentials: 'include',
          signal: billingAbort.signal,
        }).catch(() => null).finally(() => clearTimeout(billingAbortTimer)),
        BILLING_FETCH_TIMEOUT_MS + 500
      ),
    ])

    if (profRes?.data?.username?.toLowerCase() === 'admin') return '/site-admin'

    // billingRes === undefined: 타임아웃 → 이미 로그인 완료이므로 대시보드로 이동
    // billingRes === null: fetch 자체가 실패 → 마찬가지로 대시보드로 이동
    if (billingRes === undefined || billingRes === null) return safe

    const billingResponse = billingRes
    if (!billingResponse.ok) return '/subscription'

    const data = await raceTimeout(
      billingResponse.json().catch(() => ({})) as Promise<Record<string, unknown>>,
      2_000
    ) ?? {}

    if (
      merchantHasAppAccessFromBillingApiPayload(
        data as {
          is_trial_active: boolean
          grace_access_active?: boolean
          status: string
          has_card: boolean
          failed_count?: number
        }
      )
    ) {
      return safe
    }
    return '/subscription'
  } catch {
    // 예상치 못한 예외 시에도 대시보드로 이동 (로그인은 성공했으므로)
    return safe
  }
}

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'

  // 클라이언트 sessionStorage 세션 확인 → 있으면 대시보드로, 없으면 로그인 폼 표시
  useEffect(() => {
    // 로그아웃 직후 접속이면 세션 체크 없이 바로 로그인 폼 표시
    if (searchParams.get('logout') === '1') {
      setCheckingSession(false)
      return
    }
    // 랜딩 페이지의 로그인 버튼에서 온 경우: 기존 세션을 강제 sign out 후 폼 표시
    if (searchParams.get('force') === '1') {
      supabase.auth.signOut().finally(() => {
        try { localStorage.clear() } catch { /* ignore */ }
        try { sessionStorage.clear() } catch { /* ignore */ }
        setCheckingSession(false)
      })
      return
    }
    raceTimeout(supabase.auth.getSession(), LOGIN_STEP_TIMEOUT_MS)
      .then(async (result) => {
        const session = result?.data?.session ?? null
        if (session) {
          const userId = session.user?.id ?? null
          if (userId) {
            Promise.all([
              import('@/hooks/useSettlements').then(m => m.prefetchSettlementsForUser(userId)),
              import('@/hooks/useAdvancePayments').then(m => m.prefetchPaymentsForUser(userId)),
              import('@/hooks/useRiders').then(m => m.revalidateRiders()),
            ]).catch(() => {})
          }
          const dest = await resolvePostLoginRedirect(
            supabase,
            redirectTo.startsWith('/') ? redirectTo : '/dashboard',
            userId
          )
          router.replace(dest)
        } else {
          setCheckingSession(false)
        }
      })
      .catch(() => setCheckingSession(false))
  }, [router, searchParams, redirectTo])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const trimmedUsername = username.trim()
      let email: string | null = null

      // windcall 계정만 허용
      if (trimmedUsername.toLowerCase() !== 'windcall') {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
        return
      }

      // admin: API로 사용자 생성/확인 + 비밀번호 동기화 후 로그인
      if (trimmedUsername.toLowerCase() === 'admin') {
        email = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@jungsan.local'
        try {
          const res = await raceTimeout(
            fetch('/api/auth/admin-setup', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: trimmedUsername, password }),
            }),
            LOGIN_STEP_TIMEOUT_MS
          )
          if (res && !res.ok) {
            const data = await res.json().catch(() => ({}))
            console.warn('[admin-setup] failed:', data?.error)
            // admin-setup 실패해도 이미 계정이 있을 수 있으므로 signIn 계속 시도
          }
        } catch {
          // admin-setup 예외 시에도 signIn 시도 (이미 admin 계정이 있는 경우)
          console.warn('[admin-setup] exception, proceeding to signIn')
        }
      } else {
        // 일반 회원: 서버 API로 email 조회 (Admin Client 사용, RPC 의존 없음)
        let emailFromApi: string | null = null
        try {
          const apiRes = await raceTimeout(
            fetch('/api/auth/email-by-username', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: trimmedUsername }),
            }),
            LOGIN_STEP_TIMEOUT_MS
          )
          if (apiRes?.ok) {
            const apiData = await apiRes.json().catch(() => ({}))
            emailFromApi = typeof apiData?.email === 'string' ? apiData.email : null
          }
        } catch {
          // API 실패 시 RPC fallback
        }

        if (emailFromApi) {
          email = emailFromApi
        } else {
          // Fallback: RPC (DB에 get_email_by_username 함수가 있는 경우)
          const rpcResult = await raceTimeout(
            supabase.rpc('get_email_by_username', { p_username: trimmedUsername }),
            LOGIN_STEP_TIMEOUT_MS
          )
          if (rpcResult && !rpcResult.error) {
            const rpcEmail = rpcResult.data
            if (typeof rpcEmail === 'string') email = rpcEmail
            else if (Array.isArray(rpcEmail) && rpcEmail[0]) {
              const first = rpcEmail[0]
              email = typeof first === 'string' ? first : (first as { email?: string }).email ?? null
            }
          }
        }
      }

      if (!email) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
        return
      }

      // signInWithPassword 타임아웃 10초
      const signInResult = await raceTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        10_000
      )
      if (!signInResult) {
        setError('로그인 요청 시간이 초과되었습니다. 다시 시도해 주세요.')
        return
      }
      const { error: authError, data: authData } = signInResult

      if (authError) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
        return
      }

      const loggedInUserId = authData.user?.id ?? null

      // admin 로그인 시: 라이더 정산 시스템 전체관리자 페이지로 이동
      if (trimmedUsername.toLowerCase() === 'admin') {
        router.push('/site-admin')
        return
      }

      // 로그인 직후 데이터 프리페치 시작 (resolvePostLoginRedirect와 병렬 실행)
      if (loggedInUserId) {
        Promise.all([
          import('@/hooks/useSettlements').then(m => m.prefetchSettlementsForUser(loggedInUserId)),
          import('@/hooks/useAdvancePayments').then(m => m.prefetchPaymentsForUser(loggedInUserId)),
          import('@/hooks/useRiders').then(m => m.revalidateRiders()),
        ]).catch(() => {})
      }

      // resolvePostLoginRedirect 전체에도 12초 타임아웃 적용
      const safeRedirect = redirectTo.startsWith('/') ? redirectTo : '/dashboard'
      const dest = await raceTimeout(
        resolvePostLoginRedirect(supabase, safeRedirect, loggedInUserId),
        12_000
      ) ?? safeRedirect

      router.push(dest)
    } catch (err) {
      console.error('[handleLogin] unexpected error:', err)
      setError('로그인 중 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      // 어떤 경우에도 loading 상태 해제 (영구 고정 방지)
      setLoading(false)
    }
  }

  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="text-sm">로딩 중...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 rounded-2xl p-4 mb-4 shadow-lg">
            <Bike className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">라이더 정산 시스템</h1>
          <p className="mt-2 text-red-400 text-lg font-bold text-center">이 사이트는 폐쇄되었습니다. 불편드려 죄송합니다.</p>
          <p className="text-slate-400 mt-1 text-sm">관리자 전용 페이지</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white text-xl">관리자 로그인</CardTitle>
            <CardDescription className="text-slate-400">
              아이디와 비밀번호를 입력해 주세요
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-slate-300">아이디</Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="아이디 입력"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoComplete="username"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-slate-300">비밀번호</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
                />
              </div>

              {error && (
                <div className="bg-red-900/30 border border-red-700 rounded-md p-3 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-11"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-slate-700" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-slate-800/50 px-2 text-slate-500">또는</span>
                </div>
              </div>

              <Link href="/signup">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white h-11"
                >
                  <UserPlus className="mr-2 h-4 w-4" />
                  회원가입
                </Button>
              </Link>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center">
        <div className="text-slate-400">로딩 중...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
