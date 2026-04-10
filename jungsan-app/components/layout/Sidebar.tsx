'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect, useMemo } from 'react'
import type { LucideIcon } from 'lucide-react'
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
  BookOpen,
  Package,
  ImagePlus,
  Trash2,
  Megaphone,
  MessageSquare,
  Menu,
  X,
  CreditCard,
} from 'lucide-react'
import Image from 'next/image'
import { toast } from 'sonner'
import { useUser, clearUserCache, updateCachedLogoUrl } from '@/hooks/useUser'
import { clearSettlementsCache } from '@/hooks/useSettlements'
import { useSubscriptionAccess } from '@/components/layout/SubscriptionAccessProvider'

const PLATFORM_CONFIG = {
  baemin: {
    label: '배민 라이더 정산',
    sub: '배달의 민족',
    accent: 'bg-teal-600',
    activeNav: 'bg-teal-600 text-white shadow-lg',
    icon: Bike,
  },
  coupang: {
    label: '쿠팡 라이더 정산',
    sub: '쿠팡이츠',
    accent: 'bg-violet-600',
    activeNav: 'bg-violet-600 text-white shadow-lg',
    icon: Package,
  },
} as const
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
  { href: '/dashboard',          label: '주간정산현황',   icon: BarChart3  },
  { href: '/riders',             label: '라이더 관리',    icon: Users      },
  { href: '/advance-payments',   label: '선지급금 관리',  icon: Wallet     },
  { href: '/promotions',         label: '프로모션 설정',  icon: Gift       },
  { href: '/settings',           label: '관리비 설정',    icon: Settings   },
  { href: '/settlement/upload',  label: '정산파일 등록',  icon: Upload     },
  { href: '/settlement/result',  label: '정산결과보기',   icon: FileText   },
  { href: '/notice',             label: '공지사항 생성',  icon: Megaphone  },
  { href: '/rider-site',         label: '라이더사이트',      icon: Globe      },
  { href: '/subscription',       label: '구독 · 자동결제',    icon: CreditCard },
]

const bottomNavItems = [
  { href: '/manual',   label: '사용자 메뉴얼', icon: BookOpen    },
  { href: '/inquiry',  label: '문의하기',       icon: MessageSquare },
]

interface Profile {
  username: string
  company_name: string
  business_number: string
  manager_name: string
  phone: string
  email: string
  logo_url: string
}

type PlatformConfig = (typeof PLATFORM_CONFIG)[keyof typeof PLATFORM_CONFIG]

const TOAST_SUBSCRIPTION_FIRST =
  '\uBA3C\uC800 \uAD6C\uB3C5\u00B7\uC790\uB3D9\uACB0\uC81C\uB97C \uB4F1\uB85D\uD574 \uC8FC\uC138\uC694.'

function AdminSidebarPanel({
  pathname,
  config,
  PlatformIcon,
  sidebarLogoUrl,
  onCloseMobile,
  onLogout,
  onOpenProfile,
  onOpenWithdraw,
  subscriptionNavBlocked,
}: {
  pathname: string
  config: PlatformConfig
  PlatformIcon: LucideIcon
  sidebarLogoUrl: string
  onCloseMobile: () => void
  onLogout: () => void
  onOpenProfile: () => void
  onOpenWithdraw: () => void
  subscriptionNavBlocked: boolean
}) {
  return (
    <aside className="w-64 min-h-screen bg-slate-900 border-r border-slate-700 flex flex-col">
      <div className="p-5 flex items-center gap-3 border-b border-slate-700">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className={`${sidebarLogoUrl ? '' : config.accent} rounded-xl shrink-0 overflow-hidden`}
            style={{ width: 40, height: 40 }}>
            {sidebarLogoUrl ? (
              <Image
                src={sidebarLogoUrl}
                alt="로고"
                width={40}
                height={40}
                className="w-full h-full object-contain"
                unoptimized
              />
            ) : (
              <div className={`${config.accent} w-full h-full flex items-center justify-center`}>
                <PlatformIcon className="h-6 w-6 text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-white font-bold text-sm leading-tight truncate">{config.label}</h1>
            <p className="text-slate-400 text-xs">{config.sub} 관리자</p>
          </div>
        </div>
        <button
          type="button"
          className="md:hidden text-slate-400 hover:text-white p-1"
          onClick={onCloseMobile}
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto flex flex-col">
        <div className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const blocked = subscriptionNavBlocked && item.href !== '/subscription'
            const cls = cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group w-full text-left',
              isActive ? config.activeNav : 'text-slate-400 hover:bg-slate-800 hover:text-white',
              blocked && 'opacity-45 cursor-not-allowed hover:bg-transparent hover:text-slate-400'
            )
            if (blocked) {
              return (
                <button
                  type="button"
                  key={item.href}
                  className={cls}
                  onClick={() => toast.error(TOAST_SUBSCRIPTION_FIRST)}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500')} />
                  <span className="truncate">{item.label}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                </button>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cls}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-white')} />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
              </Link>
            )
          })}
        </div>

        <div className="pt-3 mt-3 border-t border-slate-700/60 space-y-1">
          {bottomNavItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            const blocked = subscriptionNavBlocked && item.href !== '/subscription'
            const cls = cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all group w-full text-left',
              isActive ? config.activeNav : 'text-slate-400 hover:bg-slate-800 hover:text-white',
              blocked && 'opacity-45 cursor-not-allowed hover:bg-transparent hover:text-slate-400'
            )
            if (blocked) {
              return (
                <button
                  type="button"
                  key={item.href}
                  className={cls}
                  onClick={() => toast.error(TOAST_SUBSCRIPTION_FIRST)}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500')} />
                  <span className="truncate">{item.label}</span>
                  {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
                </button>
              )
            }
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cls}
              >
                <Icon className={cn('h-4 w-4 shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-white')} />
                <span className="truncate">{item.label}</span>
                {isActive && <ChevronRight className="h-3.5 w-3.5 ml-auto" />}
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="p-3 border-t border-slate-700 space-y-1">
        <Separator className="bg-slate-700 mb-2" />
        <Button
          type="button"
          variant="ghost"
          onClick={onLogout}
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800 gap-3"
        >
          <LogOut className="h-4 w-4" />
          로그아웃
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (subscriptionNavBlocked) {
              toast.error(TOAST_SUBSCRIPTION_FIRST)
              return
            }
            onOpenProfile()
          }}
          className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800 gap-3"
        >
          <Pencil className="h-4 w-4" />
          정보수정
        </Button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (subscriptionNavBlocked) {
              toast.error(TOAST_SUBSCRIPTION_FIRST)
              return
            }
            onOpenWithdraw()
          }}
          className="w-full justify-start text-rose-500 hover:text-rose-400 hover:bg-rose-900/20 gap-3"
        >
          <UserX className="h-4 w-4" />
          회원탈퇴
        </Button>
      </div>
    </aside>
  )
}

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { platform, logoUrl: cachedLogoUrl, isAdmin } = useUser()
  const { subscriptionLocked, merchantGatePending } = useSubscriptionAccess()
  const subscriptionNavBlocked = !isAdmin && (subscriptionLocked || merchantGatePending)
  const config = PLATFORM_CONFIG[platform ?? 'baemin']
  const PlatformIcon = config.icon

  const [mobileOpen, setMobileOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [profile, setProfile] = useState<Profile>({ username: '', company_name: '', business_number: '', manager_name: '', phone: '', email: '', logo_url: '' })
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showPwConfirm, setShowPwConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  // 로고 관련 state
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string>('')
  const [logoUploading, setLogoUploading] = useState(false)
  // useUser 캐시에서 로고 URL 즉시 사용 (별도 DB 요청 없음)
  const [sidebarLogoUrl, setSidebarLogoUrl] = useState<string>(cachedLogoUrl ?? '')

  const [withdrawOpen, setWithdrawOpen] = useState(false)
  const [withdrawing, setWithdrawing] = useState(false)
  const [withdrawMsg, setWithdrawMsg] = useState('')

  // cachedLogoUrl이 useUser 로딩 후 업데이트되면 반영
  useEffect(() => {
    if (cachedLogoUrl && !sidebarLogoUrl) {
      setSidebarLogoUrl(cachedLogoUrl)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cachedLogoUrl])

  useEffect(() => {
    if (profileOpen) {
      fetchProfile()
      setNewPassword('')
      setNewPasswordConfirm('')
      setSaveMsg('')
      setLogoFile(null)
      setLogoPreview('')
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
      logo_url: data.logo_url ?? '',
    })
  }

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setSaveMsg('로고 파일은 2MB 이하여야 합니다.')
      return
    }
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
    setSaveMsg('')
  }

  const handleLogoUpload = async (): Promise<string | null> => {
    if (!logoFile) return profile.logo_url || null
    setLogoUploading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLogoUploading(false); return null }

    const ext = logoFile.name.split('.').pop()
    const path = `${user.id}/logo.${ext}`

    // 기존 로고 삭제 (덮어쓰기)
    await supabase.storage.from('logos').remove([path])

    const { error } = await supabase.storage.from('logos').upload(path, logoFile, {
      cacheControl: '3600',
      upsert: true,
    })
    setLogoUploading(false)
    if (error) { setSaveMsg('로고 업로드 실패: ' + error.message); return null }

    const { data: { publicUrl } } = supabase.storage.from('logos').getPublicUrl(path)
    // 캐시 무효화용 timestamp
    return `${publicUrl}?t=${Date.now()}`
  }

  const handleLogoDelete = async () => {
    if (!confirm('등록된 로고를 삭제하시겠습니까?')) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // storage 파일 삭제 시도 (확장자 모름 → 여러 형식 시도)
    const exts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg']
    await Promise.all(exts.map(ext => supabase.storage.from('logos').remove([`${user.id}/logo.${ext}`])))

    await supabase.from('profiles').update({ logo_url: null }).eq('id', user.id)
    setProfile(p => ({ ...p, logo_url: '' }))
    setSidebarLogoUrl('')
    updateCachedLogoUrl(null)
    setLogoFile(null)
    setLogoPreview('')
    setSaveMsg('로고가 삭제되었습니다.')
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleSaveProfile = async () => {
    if (newPassword) {
      if (newPassword.length < 6) { setSaveMsg('비밀번호는 6자 이상이어야 합니다.'); return }
      if (newPassword !== newPasswordConfirm) { setSaveMsg('비밀번호가 일치하지 않습니다.'); return }
    }
    setSaving(true)
    setSaveMsg('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    // 로고 업로드 (파일 선택된 경우)
    const newLogoUrl = await handleLogoUpload()

    // 프로필 정보 저장 (logo_url 포함)
    const updatePayload: Record<string, unknown> = {
      company_name: profile.company_name,
      business_number: profile.business_number,
      manager_name: profile.manager_name,
      phone: profile.phone,
      email: profile.email,
    }
    if (newLogoUrl !== null) updatePayload.logo_url = newLogoUrl

    const { error } = await supabase.from('profiles').update(updatePayload).eq('id', user.id)
    if (error) { setSaving(false); setSaveMsg('저장 실패: ' + error.message); return }

    // 사이드바 로고 즉시 반영 + 전역 캐시 동기화
    if (newLogoUrl) {
      setSidebarLogoUrl(newLogoUrl)
      updateCachedLogoUrl(newLogoUrl)
    }

    if (newPassword) {
      const { error: pwError } = await supabase.auth.updateUser({ password: newPassword })
      if (pwError) { setSaving(false); setSaveMsg('비밀번호 변경 실패: ' + pwError.message); return }
    }

    setSaving(false)
    setSaveMsg('저장되었습니다.')
    setTimeout(() => { setSaveMsg(''); setProfileOpen(false) }, 1000)
  }

  const handleLogout = () => {
    // 캐시 및 브라우저 스토리지 즉시 초기화
    clearUserCache()
    clearSettlementsCache()
    try { localStorage.clear() } catch { /* ignore */ }
    try { sessionStorage.clear() } catch { /* ignore */ }

    // signOut은 백그라운드에서 실행 (응답 기다리지 않고 즉시 이동)
    supabase.auth.signOut({ scope: 'global' }).catch(() => {})

    // 로그인 페이지로 이동
    router.replace('/login')
  }

  const handleWithdraw = async () => {
    setWithdrawing(true)
    setWithdrawMsg('')
    try {
      // 클라이언트에서 최신 토큰을 직접 가져와 헤더로 전달
      // → 서버 쿠키가 만료된 경우에도 탈퇴 처리 가능
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token ?? ''

      const res = await fetch('/api/auth/withdraw', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWithdrawMsg('탈퇴 처리 실패: ' + (json?.error ?? res.statusText))
        setWithdrawing(false)
        return
      }
      // auth.users 삭제 완료 → 쿠키 정리 후 랜딩 페이지로 이동
      try {
        await fetch('/api/auth/signout', { method: 'POST', keepalive: true })
      } catch { /* 무시 */ }
      window.location.href = 'https://jungsan-time.com/'
    } catch {
      setWithdrawMsg('탈퇴 처리 중 오류가 발생했습니다.')
      setWithdrawing(false)
    }
  }

  // 모바일에서 경로 변경 시 드로어 닫기
  useEffect(() => { setMobileOpen(false) }, [pathname])

  const sidebarPanelProps = {
    pathname,
    config,
    PlatformIcon,
    sidebarLogoUrl,
    onCloseMobile: () => setMobileOpen(false),
    onLogout: handleLogout,
    onOpenProfile: () => setProfileOpen(true),
    onOpenWithdraw: () => {
      setWithdrawMsg('')
      setWithdrawOpen(true)
    },
    subscriptionNavBlocked,
  }


  return (
    <>
      {/* 모바일 상단 헤더 바 (md 이상에서 숨김) */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-slate-900 border-b border-slate-700 flex items-center px-4 gap-3">
        <button
          onClick={() => setMobileOpen(true)}
          className="text-slate-400 hover:text-white p-1"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className={`${config.accent} rounded-lg shrink-0 w-7 h-7 flex items-center justify-center`}>
          <PlatformIcon className="h-4 w-4 text-white" />
        </div>
        <h1 className="text-white font-semibold text-sm truncate">{config.label}</h1>
      </div>

      {/* 데스크탑 사이드바 (md 미만 숨김) */}
      <div className="hidden md:block">
        <AdminSidebarPanel {...sidebarPanelProps} />
      </div>

      {/* 모바일 드로어 오버레이 */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex"
          onClick={() => setMobileOpen(false)}
        >
          {/* 배경 딤 */}
          <div className="absolute inset-0 bg-black/60" />
          {/* 드로어 패널 */}
          <div
            className="relative z-10"
            onClick={e => e.stopPropagation()}
          >
            <AdminSidebarPanel {...sidebarPanelProps} />
          </div>
        </div>
      )}

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

          {/* 로고 등록/수정 섹션 */}
          <div className="border-t border-slate-700 pt-3">
            <p className="text-slate-400 text-xs mb-3">
              사이드바 로고 <span className="text-slate-500">(PNG/JPG/WebP · 최대 2MB)</span>
            </p>
            <div className="flex items-center gap-3">
              {/* 미리보기 */}
              <div className="w-14 h-14 rounded-xl border border-slate-600 bg-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                {(logoPreview || profile.logo_url) ? (
                  <Image
                    src={logoPreview || profile.logo_url}
                    alt="로고 미리보기"
                    width={56}
                    height={56}
                    className="w-full h-full object-contain"
                    unoptimized
                  />
                ) : (
                  <ImagePlus className="h-6 w-6 text-slate-600" />
                )}
              </div>
              <div className="flex flex-col gap-2 flex-1">
                <label className="cursor-pointer">
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-xs font-medium w-fit transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    {profile.logo_url || logoPreview ? '로고 변경' : '로고 등록'}
                  </div>
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp,image/gif,image/svg+xml"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                </label>
                {(profile.logo_url || logoPreview) && (
                  <button
                    type="button"
                    onClick={handleLogoDelete}
                    className="flex items-center gap-1.5 text-rose-400 hover:text-rose-300 text-xs w-fit"
                  >
                    <Trash2 className="h-3 w-3" />
                    로고 삭제
                  </button>
                )}
              </div>
            </div>
            {logoFile && (
              <p className="text-slate-500 text-xs mt-2">선택됨: {logoFile.name} — 저장 버튼을 누르면 업로드됩니다.</p>
            )}
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
            <Button onClick={handleSaveProfile} disabled={saving || logoUploading}
              className="flex-1 bg-blue-600 hover:bg-blue-700">
              {(saving || logoUploading)
                ? <><Loader2 className="h-4 w-4 animate-spin mr-1" />{logoUploading ? '로고 업로드 중' : '저장 중'}</>
                : '저장'}
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
