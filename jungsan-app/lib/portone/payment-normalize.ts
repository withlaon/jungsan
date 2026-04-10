/**
 * Normalize PortOne REST V2 payment JSON (wrapper shapes, PAID casing).
 */

import type { PortOnePaymentResponse } from '@/lib/portone/server'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null
}

export function isPaidPortOneStatus(status: string | undefined | null): boolean {
  if (!status) return false
  return String(status).toUpperCase() === 'PAID'
}

/**
 * Unwrap { payment: ... } / { data: { payment } } from GET /payments/:id etc.
 */
export function normalizePortOnePaymentPayload(raw: unknown): PortOnePaymentResponse | null {
  if (!isRecord(raw)) return null

  const inner =
    isRecord(raw.payment) && raw.payment
      ? raw.payment
      : isRecord(raw.data) && isRecord(raw.data.payment)
        ? raw.data.payment
        : raw

  if (!isRecord(inner)) return null

  const id = inner.id
  if (typeof id !== 'string' || !id) return null

  const amountRaw = inner.amount
  let total = 0
  let currency = 'KRW'
  if (typeof amountRaw === 'number' && Number.isFinite(amountRaw)) {
    total = amountRaw
  } else if (isRecord(amountRaw)) {
    const t = amountRaw.total
    if (typeof t === 'number' && Number.isFinite(t)) total = t
    else if (typeof t === 'string' && t.trim() !== '') {
      const n = Number(t)
      if (Number.isFinite(n)) total = n
    }
    if (typeof amountRaw.currency === 'string') currency = amountRaw.currency
  }

  const status =
    typeof inner.status === 'string'
      ? inner.status
      : typeof inner.paymentStatus === 'string'
        ? inner.paymentStatus
        : ''

  const customer = isRecord(inner.customer) ? inner.customer : undefined
  const method = isRecord(inner.method) ? inner.method : undefined

  let fullName: string | undefined
  if (customer) {
    if (typeof customer.fullName === 'string') fullName = customer.fullName
    else if (isRecord(customer.name) && typeof customer.name.full === 'string') {
      fullName = customer.name.full
    }
  }

  return {
    id,
    transactionType: typeof inner.transactionType === 'string' ? inner.transactionType : 'PAYMENT',
    status,
    txId:
      typeof inner.transactionId === 'string'
        ? inner.transactionId
        : typeof inner.txId === 'string'
          ? inner.txId
          : undefined,
    amount: { total, currency },
    orderName: typeof inner.orderName === 'string' ? inner.orderName : '',
    customer: customer
      ? {
          fullName,
          email: typeof customer.email === 'string' ? customer.email : undefined,
          phoneNumber: typeof customer.phoneNumber === 'string' ? customer.phoneNumber : undefined,
        }
      : undefined,
    paidAt: typeof inner.paidAt === 'string' ? inner.paidAt : undefined,
    failedAt: typeof inner.failedAt === 'string' ? inner.failedAt : undefined,
    cancelledAt: typeof inner.cancelledAt === 'string' ? inner.cancelledAt : undefined,
    method: method && typeof method.type === 'string' ? { type: method.type } : undefined,
  }
}

/** Pay-with-billing-key: treat paidAt without failedAt as success if status string is odd */
export function billingChargeIndicatesPaid(payment: {
  status: string
  paidAt?: string
  failedAt?: string
}): boolean {
  if (isPaidPortOneStatus(payment.status)) return true
  if (Boolean(payment.paidAt) && !payment.failedAt) return true
  return false
}
