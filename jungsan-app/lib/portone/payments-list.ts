/**
 * PortOne REST V2 — page-based payment list (GET /payments + requestBody query).
 * @see https://developers.portone.io/api/rest-v2/payment
 */

import { getPortOneApiSecret } from '@/lib/portone/api-secret'

const PORTONE_API_BASE = 'https://api.portone.io'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

function idsFromItemsArray(items: unknown): string[] {
  if (!Array.isArray(items)) return []
  const out: string[] = []
  for (const it of items) {
    if (isRecord(it) && typeof it.id === 'string' && it.id.length > 3) {
      out.push(it.id)
    }
  }
  return out
}

/**
 * Recent payment ids for this store, optionally narrowed by billingKey (if API accepts it).
 */
export async function listRecentPaymentIds(params: {
  billingKey?: string
  daysBack?: number
  pageSize?: number
}): Promise<string[]> {
  const secret = getPortOneApiSecret().trim()
  const storeId = process.env.NEXT_PUBLIC_PORTONE_STORE_ID?.trim() ?? ''
  if (!secret || !storeId) return []

  const days = params.daysBack ?? 120
  const size = Math.min(Math.max(params.pageSize ?? 100, 1), 500)
  const until = new Date()
  const from = new Date(until.getTime() - days * 24 * 60 * 60 * 1000)

  const filter: Record<string, unknown> = {
    storeId,
    from: from.toISOString(),
    until: until.toISOString(),
  }
  if (params.billingKey?.trim()) {
    filter.billingKey = params.billingKey.trim()
  }

  const fetchOnce = async (filterPayload: Record<string, unknown>): Promise<string[]> => {
    const body = { page: { number: 0, size }, filter: filterPayload }
    const url = `${PORTONE_API_BASE}/payments?requestBody=${encodeURIComponent(JSON.stringify(body))}`
    const res = await fetch(url, {
      headers: { Authorization: `PortOne ${secret}` },
      cache: 'no-store',
    })
    const raw: unknown = await res.json().catch(() => ({}))
    if (!res.ok) {
      console.warn('[portone] list payments failed', res.status, raw)
      return []
    }
    if (isRecord(raw)) {
      const items = raw.items ?? (isRecord(raw.data) ? raw.data.items : undefined)
      if (Array.isArray(items)) return idsFromItemsArray(items)
    }
    return []
  }

  let ids = await fetchOnce(filter)
  if (ids.length === 0 && params.billingKey?.trim()) {
    ids = await fetchOnce({
      storeId,
      from: from.toISOString(),
      until: until.toISOString(),
    })
  }

  return ids
}
