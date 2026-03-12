'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useInactivityLogout } from '@/hooks/useInactivityLogout'
import { toast } from 'sonner'

/**
 * 관리자 레이아웃에 삽입되는 비활성 자동 로그아웃 감시 컴포넌트
 * - 1시간 무활동 시 Supabase 세션 삭제 + 로그인 페이지 이동
 * - 5분 전 toast 경고
 * - 클라이언트 세션이 없으면 서버 쿠키도 정리 후 로그인으로 이동
 *
 * NOTE: pagehide 기반 signout은 제거.
 * pagehide는 F5 새로고침 시에도 발생하여 쿠키가 지워지고 로그아웃되는 버그가 있었음.
 * 세션 쿠키는 브라우저 완전 종료(모든 창 닫기) 시 OS가 자동으로 삭제한다.
 */
export function InactivityGuard() {
  const router = useRouter()
  const supabase = createClient()

  // 세션이 없으면(브라우저 재시작 등) 쿠키도 정리하고 로그인 페이지로 이동
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
