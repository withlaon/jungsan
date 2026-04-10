import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Show trial reminder popup when remaining days is in [1, this], while trial active */
export const TRIAL_REMINDER_DAYS_BEFORE_END = 7

export type SubscriptionGateRow = {
  status: string
  trial_ends_at: string
  billing_key: string | null
  failed_count: number | null
  access_until: string | null
}

type AdminDb = SupabaseClient

const ERR_GATE =
  '\uAD6C\uB3C5 \uC815\uBCF4\uB97C \uD655\uC778\uD560 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4. \uC7A0\uC2DC \uD6C4 \uB2E4\uC2DC \uC2DC\uB3C4\uD574 \uC8FC\uC138\uC694.'
const ERR_REQUIRED =
  '\uBB34\uB8CC \uCCB4\uD5D8 \uAE30\uAC04\uC774 \uC885\uB8CC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAD6C\uB3C5\u00B7\uC790\uB3D9\uACB0\uC81C\uB97C \uB4F1\uB85D\uD55C \uD6C4 \uC774\uC6A9\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.'

function graceAccessActive(
  status: string,
  accessUntilIso: string | null | undefined,
  now: Date
): boolean {
  if (status !== 'cancelled' || !accessUntilIso) return false
  const t = new Date(accessUntilIso).getTime()
  return Number.isFinite(t) && now.getTime() <= t
}

export function merchantHasAppAccessFromRow(sub: SubscriptionGateRow, now = new Date()): boolean {
  const trialEndsAt = new Date(sub.trial_ends_at)
  const isTrialActive = now.getTime() <= trialEndsAt.getTime()
  if (isTrialActive) return true

  if (graceAccessActive(sub.status, sub.access_until, now)) return true
  if (sub.status === 'active') return true

  const hasCard = Boolean(sub.billing_key)
  if (hasCard) {
    if (sub.status === 'past_due' && (sub.failed_count ?? 0) >= 3) return false
    return true
  }
  return false
}

export function trialReminderRemainingDays(
  sub: SubscriptionGateRow,
  now = new Date()
): number | null {
  const trialEndsAt = new Date(sub.trial_ends_at)
  if (now.getTime() > trialEndsAt.getTime()) return null
  const days = Math.ceil((trialEndsAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days >= 1 && days <= TRIAL_REMINDER_DAYS_BEFORE_END) return days
  return null
}

export function merchantHasAppAccessFromBillingApiPayload(j: {
  is_trial_active: boolean
  grace_access_active?: boolean
  status: string
  has_card: boolean
  failed_count?: number
}): boolean {
  if (j.is_trial_active) return true
  if (j.grace_access_active) return true
  if (j.status === 'active') return true
  if (j.has_card) {
    if (j.status === 'past_due' && (j.failed_count ?? 0) >= 3) return false
    return true
  }
  return false
}

export function trialReminderDaysFromBillingApiPayload(j: {
  is_trial_active: boolean
  trial_remaining_days: number
}): number | null {
  if (!j.is_trial_active) return null
  const d = j.trial_remaining_days
  if (d >= 1 && d <= TRIAL_REMINDER_DAYS_BEFORE_END) return d
  return null
}

export async function ensureSubscriptionRowForUser(
  admin: AdminDb,
  userId: string
): Promise<SubscriptionGateRow | null> {
  const { data: existing } = await admin
    .from('subscriptions')
    .select('status, trial_ends_at, billing_key, failed_count, access_until')
    .eq('user_id', userId)
    .maybeSingle()

  if (existing) {
    return existing as SubscriptionGateRow
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('created_at')
    .eq('id', userId)
    .maybeSingle()

  const profileCreatedAt = profile?.created_at ? new Date(profile.created_at as string) : new Date()
  const trialEndsAt = new Date(profileCreatedAt)
  trialEndsAt.setDate(trialEndsAt.getDate() + 30)

  const { error: insertError } = await admin.from('subscriptions').insert({
    user_id: userId,
    trial_ends_at: trialEndsAt.toISOString(),
  })

  if (insertError?.code === '23505') {
    const { data: again } = await admin
      .from('subscriptions')
      .select('status, trial_ends_at, billing_key, failed_count, access_until')
      .eq('user_id', userId)
      .maybeSingle()
    return (again as SubscriptionGateRow) ?? null
  }

  if (insertError) {
    console.error('[subscription-gate] insert:', insertError.message)
    return null
  }

  const { data: created } = await admin
    .from('subscriptions')
    .select('status, trial_ends_at, billing_key, failed_count, access_until')
    .eq('user_id', userId)
    .maybeSingle()

  return (created as SubscriptionGateRow) ?? null
}

export async function merchantSubscriptionAccessDenied(
  admin: AdminDb,
  userId: string,
  profileUsername: string | null | undefined
): Promise<NextResponse | null> {
  if (profileUsername?.toLowerCase() === 'admin') return null

  const row = await ensureSubscriptionRowForUser(admin, userId)
  if (!row) {
    return NextResponse.json(
      { error: ERR_GATE, code: 'SUBSCRIPTION_GATE_ERROR' },
      { status: 503 }
    )
  }

  if (merchantHasAppAccessFromRow(row, new Date())) return null

  return NextResponse.json(
    { error: ERR_REQUIRED, code: 'SUBSCRIPTION_REQUIRED' },
    { status: 403 }
  )
}
