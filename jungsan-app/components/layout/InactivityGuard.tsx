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
 */
export function InactivityGuard() {
  const router = useRouter()
  const supabase = createClient()

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
