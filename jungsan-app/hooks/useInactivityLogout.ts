'use client'

import { useEffect, useRef, useCallback } from 'react'

const INACTIVITY_MS = 60 * 60 * 1000      // 1시간
const WARN_BEFORE_MS = 5 * 60 * 1000       // 로그아웃 5분 전 경고

const ACTIVITY_EVENTS = [
  'mousemove', 'mousedown', 'keydown',
  'touchstart', 'touchmove', 'scroll', 'click',
]

/**
 * 브라우저 비활성 상태 1시간 지속 시 onLogout 콜백 실행
 * onWarn: 로그아웃 5분 전 경고 콜백 (선택)
 */
export function useInactivityLogout(
  onLogout: () => void,
  onWarn?: () => void,
  enabled = true,
) {
  const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const warnedRef      = useRef(false)
  const onLogoutRef    = useRef(onLogout)
  const onWarnRef      = useRef(onWarn)

  // 최신 콜백 참조 유지
  useEffect(() => { onLogoutRef.current = onLogout }, [onLogout])
  useEffect(() => { onWarnRef.current = onWarn },     [onWarn])

  const resetTimers = useCallback(() => {
    if (!enabled) return

    if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
    if (warnTimerRef.current)   clearTimeout(warnTimerRef.current)

    warnedRef.current = false

    // 경고 타이머 (로그아웃 5분 전)
    warnTimerRef.current = setTimeout(() => {
      if (!warnedRef.current) {
        warnedRef.current = true
        onWarnRef.current?.()
      }
    }, INACTIVITY_MS - WARN_BEFORE_MS)

    // 로그아웃 타이머 (1시간)
    logoutTimerRef.current = setTimeout(() => {
      onLogoutRef.current()
    }, INACTIVITY_MS)
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    resetTimers()

    ACTIVITY_EVENTS.forEach(evt =>
      window.addEventListener(evt, resetTimers, { passive: true })
    )

    return () => {
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current)
      if (warnTimerRef.current)   clearTimeout(warnTimerRef.current)
      ACTIVITY_EVENTS.forEach(evt =>
        window.removeEventListener(evt, resetTimers)
      )
    }
  }, [enabled, resetTimers])
}
