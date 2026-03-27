'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { clearUserCache } from '@/hooks/useUser'
import { clearSettlementsCache } from '@/hooks/useSettlements'
import { toast } from 'sonner'

/**
 * 관리자 레이아웃에 삽입되는 비활성 자동 로그아웃 감시 컴포넌트
 * - 1시간 무활동 시 Supabase 세션 삭제 + 로그인 페이지 이동
 * - 5분 전 toast 경고
 * - 탭 포커스 복귀 시 세션 유효성 자동 재검증
 * - 세션이 없으면 로그인 페이지로 즉시 이동
 */
export function InactivityGuard() {
  const router = useRouter()
  const supabase = createClient()
  const redirectingRef = useRef(false)

  const doLogout = async (reason: string) => {
    if (redirectingRef.current) return
    redirectingRef.current = true
    clearUserCache()
    clearSettlementsCache()
    try { localStorage.clear() } catch { /* ignore */ }
    try { sessionStorage.clear() } catch { /* ignore */ }
    await supabase.auth.signOut().catch(() => {})
    toast.info(reason, { id: 'auto-logout', duration: 4000 })
    router.replace('/login')
  }

  // 마운트 시 세션 확인 (브라우저 재시작·쿠키 만료 등)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        doLogout('로그인이 필요합니다.')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 탭 포커스 복귀 시 세션 재검증 (장시간 자리비움 대응)
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      if (redirectingRef.current) return

      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        doLogout('세션이 만료되어 자동 로그아웃되었습니다.')
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleWarn = () => {
    toast.warning('5분 후 자동 로그아웃됩니다. 계속 사용하려면 화면을 클릭하세요.', {
      duration: 10000,
      id: 'inactivity-warn',
    })
  }

  const handleLogout = async () => {
    toast.dismiss('inactivity-warn')
    await doLogout('장시간 미사용으로 자동 로그아웃되었습니다.')
  }

  useInactivityLogout(handleLogout, handleWarn)

  return null
}
