'use client'

import { useEffect, useRef, useCallback } from 'react'

/** 1 hour idle → logout */
const INACTIVITY_MS = 60 * 60 * 1000
const WARN_BEFORE_MS = 5 * 60 * 1000
const TICK_MS = 15 * 1000
/** Avoid resetting idle clock on every mousemove (reduces main-thread work & navigation jank) */
const BUMP_THROTTLE_MS = 1000

const ACTIVITY_EVENTS = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'scroll',
  'click',
  'wheel',
] as const

/**
 * No user activity for INACTIVITY_MS → onLogout().
 * Uses a throttled activity bump + interval tick (does not clearTimeout on every mousemove).
 */
export function useInactivityLogout(
  onLogout: () => void,
  onWarn?: () => void,
  enabled = true,
) {
  const lastActivityRef = useRef(Date.now())
  const warnedRef = useRef(false)
  const onLogoutRef = useRef(onLogout)
  const onWarnRef = useRef(onWarn)
  const lastBumpRef = useRef(0)

  useEffect(() => {
    onLogoutRef.current = onLogout
  }, [onLogout])
  useEffect(() => {
    onWarnRef.current = onWarn
  }, [onWarn])

  const bumpActivity = useCallback(() => {
    if (!enabled) return
    const now = Date.now()
    if (now - lastBumpRef.current < BUMP_THROTTLE_MS) return
    lastBumpRef.current = now
    lastActivityRef.current = now
    warnedRef.current = false
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    lastActivityRef.current = Date.now()
    lastBumpRef.current = Date.now()
    warnedRef.current = false

    const tick = () => {
      const idle = Date.now() - lastActivityRef.current
      if (idle >= INACTIVITY_MS) {
        onLogoutRef.current()
        return
      }
      if (onWarnRef.current && !warnedRef.current && idle >= INACTIVITY_MS - WARN_BEFORE_MS) {
        warnedRef.current = true
        onWarnRef.current()
      }
    }

    const interval = setInterval(tick, TICK_MS)

    ACTIVITY_EVENTS.forEach((evt) => {
      window.addEventListener(evt, bumpActivity, { passive: true, capture: true })
    })

    return () => {
      clearInterval(interval)
      ACTIVITY_EVENTS.forEach((evt) => {
        window.removeEventListener(evt, bumpActivity, { capture: true })
      })
    }
  }, [enabled, bumpActivity])
}
