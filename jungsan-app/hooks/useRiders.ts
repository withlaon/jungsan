'use client'

import { useState, useEffect, useCallback } from 'react'
import { Rider } from '@/types'

// 모듈 수준 캐시: 탭 간 이동 시 재사용 (페이지 새로고침 시 초기화)
let _cache: Rider[] | null = null
let _promise: Promise<Rider[]> | null = null
let _lastFetched = 0

const STALE_MS = 60_000 // 1분 이상 지나면 백그라운드 재검증

async function loadRiders(): Promise<Rider[]> {
  // 이미 진행 중인 요청이 있으면 공유
  if (_promise) return _promise

  _promise = (async () => {
    // proxy.ts가 /api/ 경로에서 토큰 갱신을 건너뛰므로
    // 클라이언트 세션 토큰을 Bearer 헤더로 직접 전달
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {}
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

    const res = await fetch('/api/admin/riders', { headers })
    const d = await res.json()
    const data = Array.isArray(d) ? d : []
    _cache = data
    _lastFetched = Date.now()
    return data
  })().finally(() => { _promise = null })

  return _promise
}

/** CRUD 완료 후 캐시를 무효화하고 최신 데이터를 가져옵니다 */
export async function revalidateRiders(): Promise<Rider[]> {
  _cache = null
  return loadRiders()
}

export function useRiders() {
  // 캐시가 있으면 즉시 초기값으로 사용 → loading = false 바로 시작
  const [riders, setRiders] = useState<Rider[]>(_cache ?? [])
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    if (_cache) {
      // 캐시 히트: 즉시 표시
      setRiders(_cache)
      setLoading(false)
      // 오래된 캐시면 백그라운드에서 갱신 (stale-while-revalidate)
      if (Date.now() - _lastFetched > STALE_MS) {
        loadRiders().then(data => setRiders(data))
      }
      return
    }

    // 캐시 미스 또는 이미 요청 중: 완료되면 반영
    setLoading(true)
    loadRiders().then(data => {
      setRiders(data)
      setLoading(false)
    })
  }, [])

  /** CRUD 후 목록 갱신용 */
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    const data = await revalidateRiders()
    setRiders(data)
    if (!silent) setLoading(false)
  }, [])

  return { riders, loading, refresh }
}
