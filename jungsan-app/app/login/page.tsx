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

function LoginForm() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()
  const redirectTo = searchParams.get('redirect') ?? '/dashboard'

  // 이미 로그인된 경우 → redirect 파라미터 또는 대시보드로 이동
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        router.replace(redirectTo.startsWith('/') ? redirectTo : '/dashboard')
      }
    })
    // /login 경로로 직접 접속 시 루트(/)로 이동
    if (typeof window !== 'undefined' && window.location.pathname === '/login') {
      const qs = searchParams.toString()
      router.replace(qs ? `/?${qs}` : '/')
    }
  }, [router, searchParams, redirectTo])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const trimmedUsername = username.trim()

    let email: string | null = null

    // admin: API로 사용자 생성/확인 후 로그인
    if (trimmedUsername.toLowerCase() === 'admin') {
      email = process.env.NEXT_PUBLIC_ADMIN_EMAIL || 'admin@jungsan.local'
      try {
        const res = await fetch('/api/auth/admin-setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: trimmedUsername, password }),
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setError(data?.error || 'admin 계정 설정 실패. SUPABASE_SERVICE_ROLE_KEY를 .env.local에 추가해주세요.')
          setLoading(false)
          return
        }
      } catch (err) {
        setError('admin 계정 준비 중 오류가 발생했습니다.')
        setLoading(false)
        return
      }
    } else {
      // 일반 회원: username으로 email 조회
      const { data: rpcEmail, error: rpcError } = await supabase.rpc('get_email_by_username', {
        p_username: trimmedUsername,
      })
      if (rpcError) {
        setError('아이디 또는 비밀번호가 올바르지 않습니다.')
        setLoading(false)
        return
      }
      // RPC 반환: 단일 문자열 또는 [{email: "..."}]
      if (typeof rpcEmail === 'string') email = rpcEmail
      else if (Array.isArray(rpcEmail) && rpcEmail[0]) {
        const first = rpcEmail[0]
        email = typeof first === 'string' ? first : (first as { email?: string }).email ?? null
      }
    }

    if (!email) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

    if (authError) {
      setError('아이디 또는 비밀번호가 올바르지 않습니다.')
      setLoading(false)
      return
    }

    // admin 로그인 시: 라이더 정산 시스템 전체관리자 페이지로 이동 (새창 없음)
    if (trimmedUsername.toLowerCase() === 'admin') {
      router.push('/site-admin')
      return
    }

    router.push(redirectTo.startsWith('/') ? redirectTo : '/dashboard')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 rounded-2xl p-4 mb-4 shadow-lg">
            <Bike className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">라이더 정산 시스템</h1>
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
