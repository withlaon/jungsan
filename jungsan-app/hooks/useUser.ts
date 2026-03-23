'use client'

import { useState, useEffect, useRef } from 'react'
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

async function fetchUserProfile(): Promise<UserCache> {
  if (_promise) return _promise

  _promise = (async () => {
    const supabase = createClient()
    const { data: { user: u } } = await supabase.auth.getUser()

    if (!u) {
      const result: UserCache = { user: null, isAdmin: false, platform: 'baemin', userId: null, username: null, logoUrl: null }
      _cache = result
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
    return result
  })()

  return _promise
}

/** 현재 캐시된 유저 정보 즉시 반환 (훅 없이 모듈에서 사용) */
export function getCachedUser(): UserCache | null {
  return _cache
}

/** 로고 URL을 캐시에 즉시 반영 (로고 업로드/삭제 후 호출) */
export function updateCachedLogoUrl(url: string | null) {
  if (_cache) _cache = { ..._cache, logoUrl: url }
}

// 로그아웃 시 캐시 초기화용 export
export function clearUserCache() {
  _cache = null
  _promise = null
}

export function useUser() {
  const [state, setState] = useState<UserCache>(
    _cache ?? { user: null, isAdmin: false, platform: 'baemin', userId: null, username: null, logoUrl: null }
  )
  const [loading, setLoading] = useState(!_cache)
  const initializedRef = useRef(false)

  useEffect(() => {
    // 이미 캐시가 있으면 즉시 반환
    if (_cache) {
      setState(_cache)
      setLoading(false)
      return
    }

    fetchUserProfile().then(result => {
      setState(result)
      setLoading(false)
    })

    const supabase = createClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!initializedRef.current) {
        initializedRef.current = true
        return
      }
      // 로그인/로그아웃 이벤트 시 캐시 갱신
      _cache = null
      _promise = null
      const result = await fetchUserProfile()
      setState(result)
    })

    initializedRef.current = true
    return () => subscription.unsubscribe()
  }, [])

  return { user: state.user, userId: state.userId, isAdmin: state.isAdmin, platform: state.platform, username: state.username, logoUrl: state.logoUrl, loading }
}
