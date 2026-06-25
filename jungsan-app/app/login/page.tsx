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

const LOGIN_STEP_TIMEOUT_MS = 6_000

/** 타임아웃이 되면 undefined 반환 */
function raceTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T | undefined> {
  return Promise.race([
    Promise.resolve(promise).then((v) => v as T | undefined).catch((): undefined => undefined),
    new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms)),
  ])
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
          router.replace(redirectTo.startsWith('/') ? redirectTo : '/dashboard')
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

      // email 조회: 서버 API 사용
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
          email = typeof apiData?.email === 'string' ? apiData.email : null
        }
      } catch {
        // 무시
      }

      if (!email) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
        return
      }

      // signInWithPassword
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
      if (loggedInUserId) {
        Promise.all([
          import('@/hooks/useSettlements').then(m => m.prefetchSettlementsForUser(loggedInUserId)),
          import('@/hooks/useAdvancePayments').then(m => m.prefetchPaymentsForUser(loggedInUserId)),
          import('@/hooks/useRiders').then(m => m.revalidateRiders()),
        ]).catch(() => {})
      }

      router.push(redirectTo.startsWith('/') ? redirectTo : '/dashboard')
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
