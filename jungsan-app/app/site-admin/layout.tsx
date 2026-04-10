'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Shield, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InactivityGuard } from '@/components/layout/InactivityGuard'

export default function SiteAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.replace('/?redirect=/site-admin')
        return
      }
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).maybeSingle()
      if (!profile || profile.username?.toLowerCase() !== 'admin') {
        router.replace('/')
        return
      }
      setIsAdmin(true)
      setChecking(false)
    }
    check()
  }, [router])

  if (checking) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p>권한 확인 중...</p>
        </div>
      </div>
    )
  }

  const handleLogout = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.replace('/')
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <InactivityGuard />
      <header className="border-b border-slate-800 bg-slate-900/50 px-6 py-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Shield className="h-6 w-6 text-amber-400" />
          <div>
            <h1 className="text-xl font-bold text-white">라이더 정산 시스템 전체관리자</h1>
            <p className="text-slate-400 text-xs mt-0.5">회원목록 및 회원정보 관리</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={handleLogout}
          className="border-slate-600 text-slate-300 hover:bg-slate-700 hover:text-white"
        >
          <LogOut className="h-4 w-4 mr-2" />
          로그아웃
        </Button>
      </header>
      <main className="p-6">{children}</main>
    </div>
  )
}
