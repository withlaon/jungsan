'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { clearUserCache } from '@/hooks/useUser'
import { clearSettlementsCache, revalidateSettlements } from '@/hooks/useSettlements'
import { revalidateRiders } from '@/hooks/useRiders'
import { revalidatePayments } from '@/hooks/useAdvancePayments'
import { toast } from 'sonner'

// 이 시간 이상 자리비운 경우 탭 복귀 시 모든 데이터 강제 갱신
const REFETCH_AFTER_MS = 5 * 60 * 1000

/**
 * 관리자 레이아웃에 삽입되는 세션 감시 컴포넌트
 * - 탭 포커스 복귀 시 세션 유효성 자동 재검증 + 토큰 갱신
 * - 5분 이상 자리비운 후 복귀 시 모든 데이터 캐시 강제 갱신
 * - 세션이 없으면 로그인 페이지로 즉시 이동
 * - 자동 로그아웃 타이머 없음: 창 닫기/컴퓨터 끄기 시 세션 쿠키 삭제로 자동 로그아웃
 */
export function InactivityGuard() {
  const router = useRouter()
  const supabase = createClient()
  const redirectingRef = useRef(false)
  const hiddenAtRef = useRef<number>(0)

  const doLogout = async (reason: string) => {
    if (redirectingRef.current) return
    redirectingRef.current = true
    clearUserCache()
    clearSettlementsCache()
    await supabase.auth.signOut().catch(() => {})
    toast.info(reason, { id: 'session-expired', duration: 4000 })
    router.replace('/login')
  }

  // 마운트 시 세션 확인 — getSession()은 로컬 쿠키를 읽어 네트워크 없이 즉시 반환
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        doLogout('로그인이 필요합니다.')
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const handleVisibility = async () => {
      // 탭이 숨겨질 때 시각 기록
      if (document.visibilityState === 'hidden') {
        hiddenAtRef.current = Date.now()
        return
      }
      if (document.visibilityState !== 'visible') return
      if (redirectingRef.current) return

      // getSession()으로 로컬 쿠키 즉시 확인 (네트워크 없음, 락 없음)
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        doLogout('세션이 만료되어 자동 로그아웃되었습니다.')
        return
      }

      // 토큰이 만료됐거나 1분 이내 만료 예정인 경우 서버에서 갱신
      const expiresAt = session.expires_at ? session.expires_at * 1000 : 0
      if (expiresAt > 0 && expiresAt <= Date.now() + 60_000) {
        const { error } = await supabase.auth.refreshSession()
        if (error) {
          doLogout('세션이 만료되어 자동 로그아웃되었습니다.')
          return
        }
      }

      // 5분 이상 자리비운 경우: 갱신된 토큰으로 모든 데이터 강제 재로드
      const awayMs = hiddenAtRef.current ? Date.now() - hiddenAtRef.current : 0
      if (awayMs >= REFETCH_AFTER_MS) {
        revalidateRiders().catch(() => {})
        revalidateSettlements().catch(() => {})
        revalidatePayments().catch(() => {})
      }
    }

    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return null
}
