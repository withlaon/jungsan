'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart3,
  Users,
  Wallet,
  Gift,
  Settings,
  Upload,
  FileText,
  Globe,
  Bike,
  LogOut,
  ChevronRight,
  Pencil,
  Loader2,
  Eye,
  EyeOff,
  UserX,
  AlertTriangle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const navItems = [
  {
    href: '/dashboard',
    label: '주간정산현황',
    icon: BarChart3,
  },
  {
    href: '/riders',
    label: '라이더 관리',
    icon: Users,
  },
  {
    href: '/advance-payments',
    label: '선지급금 관리',
    icon: Wallet,
  },
  {
    href: '/promotions',
    label: '프로모션 설정',
    icon: Gift,
  },
  {
    href: '/settings',
    label: '관리비 설정',
    icon: Settings,
  },
  {
    href: '/settlement/upload',
    label: '정산파일 등록',
    icon: Upload,
  },
  {
    href: '/settlement/result',
    label: '정산결과보기',
    icon: FileText,
  },
  {
    href: '/rider-site',
    label: '라이더사이트',
    icon: Globe,
  },
]

interface Profile {
  username: string
  company_name: string
  business_number: string
  manager_name: string
  phone: string
  email: string
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()

  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<Profile>({ username: '', company_name: '', business_number: '', manager_name: '', phone: '', email: '' })
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawMsg, setWithdrawMsg] = useState('')

  useEffect(() => {
    if (profileOpen) {
      fetchProfile()
      setNewPassword('')
      setNewPasswordConfirm('')
      setSaveMsg('')
    }
  }, [profileOpen])

  const fetchProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    if (data) setProfile({
      username: data.username ?? '',
      company_name: data.company_name ?? '',
      business_number: data.business_number ?? '',
      manager_name: data.manager_name ?? '',
      phone: data.phone ?? '',
      email: data.email ?? '',
    })
  }

  const handleSaveProfile = async () => {
    // 비밀번호 입력 시 유효성 검사
    if (newPassword) {
      if (newPassword.length < 6) { setSaveMsg('비밀번호는 6자 이상이어야 합니다.'); return }
      if (newPassword !== newPasswordConfirm) { setSaveMsg('비밀번호가 일치하지 않습니다.'); return }
    }
    setSaving(true)
    setSaveMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // 프로필 정보 저장
    const { error } = await supabase.from('profiles').update({
      company_name: profile.company_name,
      business_number: profile.business_number,
      manager_name: profile.manager_name,
      phone: profile.phone,
      email: profile.email,
    }).eq('id', user.id)

    if (error) { setSaving(false); setSaveMsg('저장 실패: ' + error.message); return }

    // 비밀번호 변경 (입력한 경우만)
    if (newPassword) {
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
      if (pwError) { setSaving(false); setSaveMsg('비밀번호 변경 실패: ' + pwError.message); return }
    }

    setSaving(false)
    setSaveMsg('저장되었습니다.')
    setTimeout(() => { setSaveMsg(''); setProfileOpen(false) }, 1000)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/')
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setWithdrawMsg('')
    const { error } = await supabase.rpc('delete_own_account')
    if (error) {
      setWithdrawMsg('탈퇴 처리 실패: ' + error.message)
      setWithdrawing(false)
      return
    }
    await supabase.auth.signOut()
    router.push('/')
  }

  return (
    <>
    <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-700 flex flex-col">
      <div className="p-5 flex items-center gap-3 border-b border-slate-700">
        <div className="bg-blue-600 rounded-xl p-2 shrink-0">
          <Bike className="h-6 w-6 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-white font-bold text-sm leading-tight">라이더 정산</h1>
          <p className="text-slate-400 text-xs">관리자 시스템</p>
        </div>
        <button
          onClick={() => setProfileOpen(true)}
          className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors text-xs"
        >
          <Pencil className="h-3 w-3" />
          정보수정
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + '/')

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              )}
            >
              <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-white')} />
              <span className="truncate">{item.label}</span>
              {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
            </Link>
          )
        })}
      </nav>

      <div className="p-3 border-t border-slate-700 space-y-1">
        <Separator className="bg-slate-700 mb-2" />
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800 gap-3"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
        <Button
          variant="ghost"
          onClick={() => { setWithdrawMsg(''); setWithdrawOpen(true) }}
          className="w-full justify-start text-rose-500 hover:text-rose-400 hover:bg-rose-900/20 gap-3"
        >
          <UserX className="h-4 w-4" />
          회원탈퇴
        </Button>
      </div>
    </aside>

    {/* 정보수정 다이얼로그 */}
    <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <Pencil className="h-4 w-4 text-blue-400" />
            관리자 정보 수정
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label className="text-slate-400 text-xs">아이디 (변경 불가)</Label>
            <Input
              value={profile.username}
              disabled
              className="bg-slate-800 border-slate-600 text-slate-500 h-9"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">회사명 <span className="text-red-400">*</span></Label>
            <Input
              value={profile.company_name}
              onChange={e => setProfile(p => ({ ...p, company_name: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-white h-9"
              placeholder="(주)라이더배달"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">사업자등록번호 <span className="text-red-400">*</span></Label>
            <Input
              value={profile.business_number}
              onChange={e => setProfile(p => ({ ...p, business_number: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-white h-9"
              placeholder="000-00-00000"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">담당자 <span className="text-red-400">*</span></Label>
              <Input
                value={profile.manager_name}
                onChange={e => setProfile(p => ({ ...p, manager_name: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white h-9"
                placeholder="홍길동"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">연락처 <span className="text-red-400">*</span></Label>
              <Input
                value={profile.phone}
                onChange={e => setProfile(p => ({ ...p, phone: e.target.value }))}
                className="bg-slate-800 border-slate-600 text-white h-9"
                placeholder="010-0000-0000"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-slate-300 text-xs">이메일</Label>
            <Input
              type="email"
              value={profile.email}
              onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
              className="bg-slate-800 border-slate-600 text-white h-9"
              placeholder="admin@company.com"
            />
          </div>

          {/* 비밀번호 변경 섹션 */}
          <div className="border-t border-slate-700 pt-3">
            <p className="text-slate-400 text-xs mb-3">비밀번호 변경 <span className="text-slate-500">(변경 시에만 입력)</span></p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">새 비밀번호</Label>
                <div className="relative">
                  <Input
                    type={showPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="bg-slate-800 border-slate-600 text-white h-9 pr-9"
                    placeholder="6자 이상"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPw(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">새 비밀번호 확인</Label>
                <div className="relative">
                  <Input
                    type={showPwConfirm ? 'text' : 'password'}
                    value={newPasswordConfirm}
                    onChange={e => setNewPasswordConfirm(e.target.value)}
                    className={`bg-slate-800 border-slate-600 text-white h-9 pr-9
                      ${newPasswordConfirm && newPassword !== newPasswordConfirm ? 'border-red-500' : ''}
                      ${newPasswordConfirm && newPassword === newPasswordConfirm && newPassword ? 'border-emerald-500' : ''}`}
                    placeholder="비밀번호 재입력"
                    autoComplete="new-password"
                  />
                  <button type="button" onClick={() => setShowPwConfirm(v => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                    {showPwConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {newPasswordConfirm && newPassword !== newPasswordConfirm && (
                  <p className="text-red-400 text-xs">비밀번호가 일치하지 않습니다.</p>
                )}
                {newPasswordConfirm && newPassword === newPasswordConfirm && newPassword && (
                  <p className="text-emerald-400 text-xs">비밀번호가 일치합니다.</p>
                )}
              </div>
            </div>
          </div>

          {saveMsg && (
            <p className={`text-sm text-center ${saveMsg.startsWith('저장 실패') ? 'text-red-400' : 'text-emerald-400'}`}>
              {saveMsg}
            </p>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="ghost" onClick={() => setProfileOpen(false)}
              className="flex-1 text-slate-400 hover:text-white border border-slate-700">
              취소
            </Button>
            <Button onClick={handleSaveProfile} disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700">
              {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />저장 중</> : '저장'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    {/* 회원탈퇴 확인 다이얼로그 */}
    <Dialog open={withdrawOpen} onOpenChange={v => { if (!withdrawing) setWithdrawOpen(v) }}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            회원탈퇴
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="bg-rose-900/20 border border-rose-700/40 rounded-lg p-4 space-y-2">
            <p className="text-rose-300 text-sm font-medium">탈퇴 시 다음 데이터가 모두 삭제됩니다.</p>
            <ul className="text-rose-400/80 text-xs space-y-1 list-disc list-inside">
              <li>관리자 계정 및 프로필 정보</li>
              <li>라이더 정보 및 정산 내역</li>
              <li>프로모션, 관리비, 선지급금 설정</li>
            </ul>
          </div>
          <p className="text-slate-400 text-sm">이 작업은 되돌릴 수 없습니다. 정말 탈퇴하시겠습니까?</p>

          {withdrawMsg && (
            <p className="text-rose-400 text-sm text-center">{withdrawMsg}</p>
          )}

          <div className="flex gap-2">
            <Button
              variant="ghost"
              onClick={() => setWithdrawOpen(false)}
              disabled={withdrawing}
              className="flex-1 border border-slate-700 text-slate-400 hover:text-white"
            >
              취소
            </Button>
            <Button
              onClick={handleWithdraw}
              disabled={withdrawing}
              className="flex-1 bg-rose-600 hover:bg-rose-700 text-white"
            >
              {withdrawing
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />탈퇴 중...</>
                : <><UserX className="h-4 w-4 mr-1" />탈퇴하기</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  )
}
