'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Bike, Loader2, CheckCircle, XCircle, ArrowLeft, Package } from 'lucide-react'

type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken'
type BizStatus = 'idle' | 'checking' | 'available' | 'taken'
type Platform = 'baemin' | 'coupang'

const PLATFORMS: { id: Platform; label: string; desc: string; color: string; border: string; icon: React.ReactNode }[] = [
  {
    id: 'baemin',
    label: '배달의 민족',
    desc: '배민 라이더 정산',
    color: 'text-teal-300',
    border: 'border-teal-500 bg-teal-900/30',
    icon: <Bike className="h-6 w-6 text-teal-400" />,
  },
  {
    id: 'coupang',
    label: '쿠팡이츠',
    desc: '쿠팡 라이더 정산',
    color: 'text-red-300',
    border: 'border-red-500 bg-red-900/30',
    icon: <Package className="h-6 w-6 text-red-400" />,
  },
]

export default function SignupPage() {
  const router = useRouter()
  const supabase = createClient()

  const [platform, setPlatform] = useState<Platform | null>(null)
  const [form, setForm] = useState({
    username: '',
    password: '',
    passwordConfirm: '',
    company_name: '',
    business_number: '',
    manager_name: '',
    phone: '',
    email: '',
  })
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle')
  const [bizStatus, setBizStatus] = useState<BizStatus>('idle')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const setField = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm(prev => ({ ...prev, [key]: e.target.value }))
    if (key === 'username') {
      const val = e.target.value.trim().toLowerCase()
      setUsernameStatus(val === 'admin' ? 'taken' : 'idle')
    }
    if (key === 'business_number') {
      setBizStatus('idle')
    }
  }

  // 사업자등록번호 자동 형식화: 숫자만 추출 후 000-00-00000 형태로 변환
  const handleBizNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/[^0-9]/g, '')
    let formatted = digits
    if (digits.length > 5) {
      formatted = digits.slice(0, 3) + '-' + digits.slice(3, 5) + '-' + digits.slice(5, 10)
    } else if (digits.length > 3) {
      formatted = digits.slice(0, 3) + '-' + digits.slice(3)
    }
    setForm(prev => ({ ...prev, business_number: formatted }))
    setBizStatus('idle')
  }

  const checkUsername = async () => {
    const username = form.username.trim()
    if (!username) return
    if (username.length < 4) {
      setError('아이디는 4자 이상이어야 합니다.')
      return
    }
    // admin 아이디는 예약어로 사용 불가
    if (username.toLowerCase() === 'admin') {
      setUsernameStatus('taken')
      setError('해당 아이디는 사용할 수 없습니다.')
      return
    }
    setUsernameStatus('checking')
    setError('')
    const { data: exists } = await supabase.rpc('check_username_exists', { p_username: username })
    setUsernameStatus(exists ? 'taken' : 'available')
  }

  const checkBusinessNumber = async () => {
    const biz = form.business_number.trim()
    const digits = biz.replace(/[^0-9]/g, '')
    if (!biz) return
    if (digits.length !== 10) {
      setError('사업자등록번호는 10자리 숫자로 입력해주세요. (예: 000-00-00000)')
      return
    }
    setBizStatus('checking')
    setError('')
    const { data: exists } = await supabase.rpc('check_business_number_exists', { p_business_number: biz })
    setBizStatus(exists ? 'taken' : 'available')
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!platform) {
      setError('사용하실 플랫폼을 먼저 선택해주세요.')
      return
    }
    if (form.username.trim().toLowerCase() === 'admin') {
      setError('해당 아이디는 사용할 수 없습니다.')
      return
    }
    if (usernameStatus !== 'available') {
      setError('아이디 중복 확인을 먼저 해주세요.')
      return
    }
    if (form.password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }
    if (form.password !== form.passwordConfirm) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }
    if (!form.company_name.trim() || !form.manager_name.trim() || !form.business_number.trim() || !form.phone.trim() || !form.email.trim()) {
      setError('필수 항목을 모두 입력해주세요.')
      return
    }
    const bizDigits = form.business_number.replace(/[^0-9]/g, '')
    if (bizDigits.length !== 10) {
      setError('사업자등록번호는 10자리 숫자로 입력해주세요. (예: 000-00-00000)')
      return
    }
    if (bizStatus !== 'available') {
      setError('사업자등록번호 중복 확인을 먼저 해주세요.')
      return
    }

    setLoading(true)

    const authEmail = form.email.trim()

    // Supabase Auth 회원가입
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: authEmail,
      password: form.password,
    })

    if (authError || !authData.user) {
      setError(authError?.message === 'User already registered'
        ? '이미 등록된 이메일 또는 아이디입니다.'
        : '회원가입 실패: ' + authError?.message)
      setLoading(false)
      return
    }

    // SECURITY DEFINER RPC로 프로필 저장 (이메일 인증 전에도 동작)
    const { error: profileError } = await supabase.rpc('create_profile_on_signup', {
      p_id: authData.user.id,
      p_username: form.username.trim(),
      p_company_name: form.company_name.trim(),
      p_business_number: form.business_number.trim(),
      p_manager_name: form.manager_name.trim(),
      p_phone: form.phone.trim(),
      p_email: authEmail,
    })

    if (profileError) {
      const msg = profileError.message
      if (msg.includes('이미 등록된 사업자등록번호')) {
        setError('이미 사용 중인 사업자등록번호입니다. 확인 후 다시 시도해주세요.')
        setBizStatus('taken')
      } else {
        setError('프로필 저장 실패: ' + msg)
      }
      setLoading(false)
      return
    }

    // 플랫폼 + 비밀번호 저장 (프로필 생성 후 업데이트)
    await supabase.from('profiles').update({ platform, plain_password: form.password }).eq('id', authData.user.id)

    // site-admin 회원 목록 실시간 갱신 알림 (서버에서 처리)
    fetch('/api/notify/member-change', { method: 'POST' }).catch(() => {})

    setLoading(false)
    router.push('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4 py-10">
      <div className="w-full max-w-lg">
        <div className="flex flex-col items-center mb-6">
          <div className="bg-blue-600 rounded-2xl p-4 mb-4 shadow-lg">
            <Bike className="h-10 w-10 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">라이더 정산 시스템</h1>
          <p className="text-slate-400 mt-1 text-sm">관리자 계정 가입</p>
        </div>

        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur shadow-2xl">
          <CardHeader>
            <CardTitle className="text-white text-xl">회원가입</CardTitle>
            <CardDescription className="text-slate-400">
              <span className="text-red-400">*</span> 표시는 필수 입력 항목입니다
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSignup} className="space-y-4">

              {/* 플랫폼 선택 */}
              <div className="space-y-2">
                <Label className="text-slate-300">
                  사용 플랫폼 <span className="text-red-400">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  {PLATFORMS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setPlatform(p.id)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all
                        ${platform === p.id
                          ? p.border + ' shadow-lg scale-[1.02]'
                          : 'border-slate-600 bg-slate-800/50 hover:border-slate-500'
                        }`}
                    >
                      {p.icon}
                      <span className={`font-bold text-sm ${platform === p.id ? p.color : 'text-slate-300'}`}>
                        {p.label}
                      </span>
                      <span className="text-slate-500 text-xs">{p.desc}</span>
                      {platform === p.id && (
                        <CheckCircle className={`h-4 w-4 ${p.color}`} />
                      )}
                    </button>
                  ))}
                </div>
                {!platform && (
                  <p className="text-slate-500 text-xs text-center">플랫폼을 선택하면 맞춤형 정산 시스템이 제공됩니다</p>
                )}
              </div>

              {/* 구분선 */}
              <div className="border-t border-slate-700 pt-1">
                <p className="text-slate-500 text-xs">계정 정보</p>
              </div>

              {/* 아이디 */}
              <div className="space-y-1.5">
                <Label className="text-slate-300">
                  아이디 <span className="text-red-400">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="4~20자 영문, 숫자"
                    value={form.username}
                    onChange={setField('username')}
                    required
                    maxLength={20}
                    className={`flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500
                      ${usernameStatus === 'available' ? 'border-emerald-500 focus:border-emerald-500' : ''}
                      ${usernameStatus === 'taken' ? 'border-red-500 focus:border-red-500' : ''}`}
                  />
                  <Button
                    type="button"
                    onClick={checkUsername}
                    disabled={!form.username || usernameStatus === 'checking'}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shrink-0"
                  >
                    {usernameStatus === 'checking' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : '중복확인'}
                  </Button>
                </div>
                {usernameStatus === 'available' && (
                  <p className="flex items-center gap-1 text-emerald-400 text-xs">
                    <CheckCircle className="h-3.5 w-3.5" /> 사용 가능한 아이디입니다.
                  </p>
                )}
                {usernameStatus === 'taken' && (
                  <p className="flex items-center gap-1 text-red-400 text-xs">
                    <XCircle className="h-3.5 w-3.5" />
                    {form.username.trim().toLowerCase() === 'admin' ? '해당 아이디는 사용할 수 없습니다.' : '이미 사용 중인 아이디입니다.'}
                  </p>
                )}
              </div>

              {/* 비밀번호 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">
                    비밀번호 <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="password"
                    placeholder="6자 이상"
                    value={form.password}
                    onChange={setField('password')}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">
                    비밀번호 확인 <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="password"
                    placeholder="비밀번호 재입력"
                    value={form.passwordConfirm}
                    onChange={setField('passwordConfirm')}
                    required
                    autoComplete="new-password"
                    className={`bg-slate-700 border-slate-600 text-white placeholder:text-slate-500
                      ${form.passwordConfirm && form.password !== form.passwordConfirm ? 'border-red-500' : ''}
                      ${form.passwordConfirm && form.password === form.passwordConfirm ? 'border-emerald-500' : ''}`}
                  />
                </div>
              </div>
              {form.passwordConfirm && form.password !== form.passwordConfirm && (
                <p className="text-red-400 text-xs -mt-2 flex items-center gap-1">
                  <XCircle className="h-3.5 w-3.5" /> 비밀번호가 일치하지 않습니다.
                </p>
              )}

              {/* 구분선 */}
              <div className="border-t border-slate-700 pt-1">
                <p className="text-slate-500 text-xs mb-3">회사 정보</p>
              </div>

              {/* 회사명 */}
              <div className="space-y-1.5">
                <Label className="text-slate-300">
                  회사명 <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="text"
                  placeholder="(주)라이더배달"
                  value={form.company_name}
                  onChange={setField('company_name')}
                  required
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>

              {/* 사업자등록번호 */}
              <div className="space-y-1.5">
                <Label className="text-slate-300">
                  사업자등록번호 <span className="text-red-400">*</span>
                </Label>
                <div className="flex gap-2">
                  <Input
                    type="text"
                    placeholder="000-00-00000"
                    value={form.business_number}
                    onChange={handleBizNumberChange}
                    maxLength={12}
                    required
                    className={`flex-1 bg-slate-700 border-slate-600 text-white placeholder:text-slate-500
                      ${bizStatus === 'available' ? 'border-emerald-500 focus:border-emerald-500' : ''}
                      ${bizStatus === 'taken' ? 'border-red-500 focus:border-red-500' : ''}`}
                  />
                  <Button
                    type="button"
                    onClick={checkBusinessNumber}
                    disabled={!form.business_number || bizStatus === 'checking'}
                    variant="outline"
                    className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white shrink-0"
                  >
                    {bizStatus === 'checking' ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : '중복확인'}
                  </Button>
                </div>
                {bizStatus === 'available' && (
                  <p className="flex items-center gap-1 text-emerald-400 text-xs">
                    <CheckCircle className="h-3.5 w-3.5" /> 사용 가능한 사업자등록번호입니다.
                  </p>
                )}
                {bizStatus === 'taken' && (
                  <p className="flex items-center gap-1 text-red-400 text-xs">
                    <XCircle className="h-3.5 w-3.5" /> 이미 등록된 사업자등록번호입니다.
                  </p>
                )}
              </div>

              {/* 담당자 + 연락처 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-slate-300">
                    담당자 <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="text"
                    placeholder="홍길동"
                    value={form.manager_name}
                    onChange={setField('manager_name')}
                    required
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-slate-300">
                    연락처 <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    type="tel"
                    placeholder="010-0000-0000"
                    value={form.phone}
                    onChange={setField('phone')}
                    required
                    className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>
              </div>

              {/* 이메일 */}
              <div className="space-y-1.5">
                <Label className="text-slate-300">
                  이메일 <span className="text-red-400">*</span>
                </Label>
                <Input
                  type="email"
                  placeholder="admin@company.com"
                  value={form.email}
                  onChange={setField('email')}
                  required
                  autoComplete="email"
                  className="bg-slate-700 border-slate-600 text-white placeholder:text-slate-500"
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
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium h-11 mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    가입 처리 중...
                  </>
                ) : (
                  '회원가입'
                )}
              </Button>

              <div className="text-center pt-1">
                <Link
                  href="/"
                  className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white text-sm transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  이미 계정이 있으신가요? 로그인
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
