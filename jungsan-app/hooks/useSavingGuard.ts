'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { toast } from 'sonner'

const DEFAULT_TIMEOUT_MS = 15_000
const MSG_TIMEOUT = '저장 시간이 초과되었습니다. 네트워크 상태를 확인 후 다시 시도해 주세요.'

/**
 * setSaving(false) 누락을 방지하는 자동 타임아웃 saving 상태 훅.
 * setSaving(true) 호출 후 timeoutMs 이내에 setSaving(false)가 없으면
 * 자동으로 false로 전환하고 에러 토스트를 표시합니다.
 */
export function useSavingGuard(timeoutMs = DEFAULT_TIMEOUT_MS): [boolean, (v: boolean) => void] {
  const [saving, setSavingRaw] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const setSaving = useCallback(
    (v: boolean) => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (v) {
        timerRef.current = setTimeout(() => {
          setSavingRaw(false)
          timerRef.current = null
          toast.error(MSG_TIMEOUT)
        }, timeoutMs)
      }
      setSavingRaw(v)
    },
    [timeoutMs],
  )

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    },
    [],
  )

  return [saving, setSaving]
}
