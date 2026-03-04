'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User } from '@supabase/supabase-js'

export type Platform = 'baemin' | 'coupang'

export function useUser() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [platform, setPlatform] = useState<Platform>('baemin')
  const initializedRef = useRef(false)

  useEffect(() => {
    const supabase = createClient()

    const resolveProfile = async (u: User | null) => {
      if (!u) {
        setUser(null)
        setIsAdmin(false)
        setPlatform('baemin')
        return
      }
      setUser(u)
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, platform')
        .eq('id', u.id)
        .maybeSingle()
      setIsAdmin(profile?.username?.toLowerCase() === 'admin')
      setPlatform((profile?.platform as Platform) ?? 'baemin')
    }

    const load = async () => {
      const { data: { user: u } } = await supabase.auth.getUser()
      await resolveProfile(u)
      setLoading(false)
      initializedRef.current = true
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!initializedRef.current) return
      await resolveProfile(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, userId: user?.id ?? null, isAdmin, platform, loading }
}
