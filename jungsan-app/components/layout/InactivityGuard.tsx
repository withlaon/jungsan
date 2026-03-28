'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearUserCache } from '@/hooks/useUser'
import { clearSettlementsCache } from '@/hooks/useSettlements'
import { toast } from 'sonner'

/**
 * 관리자 레이아웃에 삽입되는 세션 감시 컴포넌트
 * - 탭 포커스 복귀 시 세션 유효성 자동 재검증 + 토큰 갱신
 * - 세션이 없으면 로그인 페이지로 즉시 이동
 * - 자동 로그아웃 타이머 없음: 창 닫기/컴퓨터 끄기 시 세션 쿠키 삭제로 자동 로그아웃
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
    await supabase.auth.signOut().catch(() => {})
    toast.info(reason, { id: 'session-expired', duration: 4000 })
    router.replace('/login')
  }

  // 마운트 시 세션 확인 (브라우저 재시작·쿠키 만료 등)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) {
        doLogout('로그인이 필요합니다.')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 탭 포커스 복귀 시 세션 재검증 및 토큰 갱신
  // getUser()는 서버에 요청해 토큰 유효성 확인 및 만료 시 갱신 처리
  useEffect(() => {
    const handleVisibility = async () => {
      if (document.visibilityState !== 'visible') return
      if (redirectingRef.current) return

      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        doLogout('세션이 만료되어 자동 로그아웃되었습니다.')
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
