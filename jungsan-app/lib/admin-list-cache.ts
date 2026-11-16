import { createClient } from '@/lib/supabase/client'

const cache = new Map<string, unknown>()

export function readAdminList<T>(key: string): T | null {
  return cache.has(key) ? cache.get(key) as T : null
}

export function writeAdminList<T>(key: string, data: T) {
  cache.set(key, data)
}

export async function prefetchAdminLists(userId: string) {
  if (cache.has('promotions') && cache.has('fees') && cache.has('insurance')) return
  const supabase = createClient()
  const [promos, fees, insurance] = await Promise.all([
    supabase.from('promotions').select('*, riders(*)').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('management_fees').select('*, riders(*)').eq('user_id', userId).order('created_at', { ascending: false }),
    supabase.from('insurance_fees').select('*, riders(*)').eq('user_id', userId).order('created_at', { ascending: false }),
  ])
  if (promos.data) cache.set('promotions', promos.data)
  if (fees.data) cache.set('fees', fees.data)
  if (insurance.data) cache.set('insurance', insurance.data)
}
