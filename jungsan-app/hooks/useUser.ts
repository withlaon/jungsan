'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export type Platform = 'baemin' | 'coupang'

interface UserCache {
  user: User | null
  isAdmin: boolean
  platform: Platform
  userId: string | null
  username: string | null
  logoUrl: string | null
}

// 모듈 수준 캐시: 페이지 간 탭 전환 시 재사용 (페이지 새로고침 시 초기화)
let _cache: UserCache | null = null
let _promise: Promise<UserCache> | null = null

// 구독 패턴: 모든 useUser 인스턴스가 데이터 변경을 즉시 수신
const _listeners = new Set<(data: UserCache) => void>()

function broadcastUser(data: UserCache) {
  // 동일 userId라면 _cache를 업데이트만 하고 setState 호출을 생략해
  // 불필요한 리렌더와 useCallback 재생성을 방지한다
  if (
    _cache &&
    _cache.userId === data.userId &&
    _cache.isAdmin === data.isAdmin &&
    _cache.platform === data.platform &&
    _cache.username === data.username &&
    _cache.logoUrl === data.logoUrl
  ) {
    return
  }
  _listeners.forEach(fn => fn(data))
}

async function fetchUserProfile(): Promise<UserCache> {
  if (_promise) return _promise

  _promise = (async () => {
    try {
      const supabase = createClient()
      const { data: { user: u } } = await supabase.auth.getUser()

      if (!u) {
        const result: UserCache = {
          user: null, isAdmin: false, platform: 'baemin',
          userId: null, username: null, logoUrl: null,
        }
        _cache = result
        broadcastUser(result)
        return result
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('username, platform, logo_url')
        .eq('id', u.id)
        .maybeSingle()

      const result: UserCache = {
        user: u,
        userId: u.id,
        isAdmin: profile?.username?.toLowerCase() === 'admin',
        platform: (profile?.platform as Platform) ?? 'baemin',
        username: profile?.username ?? null,
        logoUrl: profile?.logo_url ?? null,
      }
      _cache = result
      broadcastUser(result)
      return result
    } catch {
      // 네트워크 오류 등 예외 상황에서도 loading이 멈추지 않도록 처리
      const fallback: UserCache = {
        user: null, isAdmin: false, platform: 'baemin',
        userId: null, username: null, logoUrl: null,
      }
      _cache = fallback
      broadcastUser(fallback)
      return fallback
    }
  })()

  return _promise
}

// ─── 모듈 수준 auth 구독 싱글톤 ───────────────────────────────────────────
// 여러 useUser() 인스턴스가 각각 onAuthStateChange를 등록하면
// INITIAL_SESSION이 중복 발화되어 캐시 초기화 + 재요청 레이스컨디션 발생.
// 싱글톤으로 구독을 1개만 유지해 이 문제를 원천 차단한다.
let _authUnsubscribe: (() => void) | null = null

function ensureAuthSubscription() {
  if (_authUnsubscribe) return

  const supabase = createClient()
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
    // INITIAL_SESSION: 페이지 로드 시 쿠키에서 세션 복원 → fetchUserProfile()이 이미 처리 중
    // TOKEN_REFRESHED: 토큰 자동 갱신 → 사용자 정보는 그대로이므로 재요청 불필요
    if (event === 'INITIAL_SESSION' || event === 'TOKEN_REFRESHED') return

    // SIGNED_IN / SIGNED_OUT / USER_UPDATED 등 실제 인증 이벤트만 처리
    _cache = null
    _promise = null
    await fetchUserProfile()  // broadcastUser가 내부에서 호출됨
  })

  _authUnsubscribe = () => subscription.unsubscribe()
}

/** 현재 캐시된 유저 정보 즉시 반환 (훅 없이 모듈에서 사용) */
export function getCachedUser(): UserCache | null {
  return _cache
}

/** 로고 URL을 캐시에 즉시 반영 (로고 업로드/삭제 후 호출) */
export function updateCachedLogoUrl(url: string | null) {
  if (_cache) {
    _cache = { ..._cache, logoUrl: url }
    broadcastUser(_cache)
  }
}

/** 로그아웃 시 캐시 및 구독 초기화 */
export function clearUserCache() {
  _cache = null
  _promise = null
  if (_authUnsubscribe) {
    _authUnsubscribe()
    _authUnsubscribe = null
  }
}

export function useUser() {
  const [state, setState] = useState<UserCache>(
    _cache ?? { user: null, isAdmin: false, platform: 'baemin', userId: null, username: null, logoUrl: null }
  )
  const [loading, setLoading] = useState(!_cache)

  useEffect(() => {
    // 리스너 등록 (브로드캐스트 수신)
    _listeners.add(setState)

    if (_cache) {
      setState(_cache)
      setLoading(false)
    } else {
      // 에러 발생 시에도 반드시 loading 해제 (freeze 방지)
      fetchUserProfile()
        .then(() => setLoading(false))
        .catch(() => setLoading(false))
    }

    // 모듈 수준 싱글톤 구독 (중복 등록 방지)
    ensureAuthSubscription()

    return () => {
      _listeners.delete(setState)
    }
  }, [])

  return {
    user: state.user,
    userId: state.userId,
    isAdmin: state.isAdmin,
    platform: state.platform,
    username: state.username,
    logoUrl: state.logoUrl,
    loading,
  }
}
