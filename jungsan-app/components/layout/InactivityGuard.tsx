'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { toast } from 'sonner'

/**
 * 관리자 레이아웃에 삽입되는 비활성 자동 로그아웃 감시 컴포넌트
 * - 창/탭 닫힘 시 서버 세션 자동 무효화 (sendBeacon)
 * - 1시간 무활동 시 Supabase 세션 삭제 + 로그인 페이지 이동
 * - 5분 전 toast 경고
 * - 브라우저 재시작 후 클라이언트 세션이 없으면 서버 쿠키도 정리 후 로그인으로 이동
 */
export function InactivityGuard() {
  const router = useRouter()
  const supabase = createClient()

  // 창/탭을 닫을 때 서버 세션 무효화
  // pagehide: 탭 닫기, 브라우저 닫기, 새로고침, 뒤로가기 등 페이지 이탈 시 발생
  // sendBeacon: 비동기 전송 → 브라우저가 응답을 기다리지 않고 확실히 전송
  useEffect(() => {
    const handlePageHide = (e: PageTransitionEvent) => {
      // persisted=true 이면 bfcache(뒤로가기 캐시)로 저장되는 경우 → 로그아웃 안 함
      if (e.persisted) return
      navigator.sendBeacon('/api/auth/signout')
    }
    window.addEventListener('pagehide', handlePageHide)
    return () => window.removeEventListener('pagehide', handlePageHide)
  }, [])

  // 브라우저 종료 후 재접속 시: sessionStorage가 비어있으면(클라이언트 세션 없음)
  // 서버 쿠키도 정리하고 로그인 페이지로 강제 이동
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        supabase.auth.signOut().finally(() => {
          router.replace('/')
        })
      }
    })
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
    await supabase.auth.signOut()
    toast.info('장시간 미사용으로 자동 로그아웃되었습니다.')
    router.replace('/')
  }

  useInactivityLogout(handleLogout, handleWarn)

  return null
}
