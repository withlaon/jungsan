'use client'

import { useState, useEffect, useCallback } from 'react'
import { Rider } from '@/types'

// 모듈 수준 캐시 — 탭 간 이동 시 재사용 (페이지 새로고침 시 초기화)
let _cache: Rider[] | null = null
let _promise: Promise<Rider[]> | null = null
let _lastFetched = 0

// 구독 패턴: 모든 useRiders 인스턴스가 데이터 변경을 즉시 수신
const _listeners = new Set<(data: Rider[]) => void>()

const STALE_MS = 60_000 // 1분 이상 지나면 백그라운드 재검증

function broadcast(data: Rider[]) {
  _listeners.forEach(fn => fn(data))
}

async function loadRiders(force = false): Promise<Rider[]> {
  // force 모드: 기존 캐시·진행 중 요청 무시하고 강제 재요청
  if (force) {
    _cache = null
    _promise = null
  }

  if (_promise) return _promise

  _promise = (async () => {
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    const headers: Record<string, string> = {}
    if (session?.access_token) headers['Authorization'] = `Bearer ${session.access_token}`

    // force 시 브라우저 캐시 완전 우회 (타임스탬프 파라미터 + no-store)
    const url = force ? `/api/admin/riders?t=${Date.now()}` : '/api/admin/riders'
    const res = await fetch(url, { headers, ...(force ? { cache: 'no-store' } : {}) })
    const d = await res.json()
    const data = Array.isArray(d) ? d : []
    _cache = data
    _lastFetched = Date.now()
    broadcast(data)
    return data
  })().finally(() => { _promise = null })

  return _promise
}

/** CRUD 완료 후 캐시를 무효화하고 서버에서 최신 데이터를 강제로 가져옵니다 */
export async function revalidateRiders(): Promise<Rider[]> {
  return loadRiders(true)
}

/**
 * CRUD 성공 직후 서버 왕복 없이 즉시 로컬 상태에 반영합니다.
 * API 응답으로 받은 라이더 데이터를 낙관적으로 업데이트한 뒤
 * 백그라운드에서 서버 확인 refresh를 별도로 호출하세요.
 */
export function applyOptimisticRider(rider: Rider, action: 'add' | 'update' | 'remove') {
  let newCache: Rider[]
  if (action === 'add') {
    newCache = [...(_cache ?? []), rider].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
  } else if (action === 'update') {
    newCache = (_cache ?? []).map(r => r.id === rider.id ? rider : r)
  } else {
    newCache = (_cache ?? []).filter(r => r.id !== rider.id)
  }
  _cache = newCache
  _lastFetched = Date.now()
  broadcast(newCache)
}

export function useRiders() {
  // 캐시가 있으면 즉시 초기값으로 사용 → loading = false 바로 시작
  const [riders, setRiders] = useState<Rider[]>(_cache ?? [])
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    // 이 컴포넌트 인스턴스를 구독자로 등록
    _listeners.add(setRiders)

    if (_cache) {
      setRiders(_cache)
      setLoading(false)
      // 오래된 캐시면 백그라운드에서 갱신 (stale-while-revalidate)
      if (Date.now() - _lastFetched > STALE_MS) {
        loadRiders().then(() => setLoading(false))
      }
    } else {
      setLoading(true)
      loadRiders().then(() => setLoading(false))
    }

    return () => {
      _listeners.delete(setRiders)
    }
  }, [])

  /** CRUD 후 목록 강제 갱신 (silent=true: 로딩 인디케이터 없음) */
  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    await revalidateRiders()
    if (!silent) setLoading(false)
  }, [])

  return { riders, loading, refresh }
}
