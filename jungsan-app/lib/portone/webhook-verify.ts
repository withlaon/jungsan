/**
 * 포트원 V2 결제 웹훅 — Standard Webhooks 서명 검증
 * @see https://github.com/standard-webhooks/standard-webhooks
 *
 * 콘솔에서 발급한 시크릿(whsec_ 접두사)은 PORTONE_WEBHOOK_SECRET 환경변수에만 넣으세요.
 */

import crypto from 'crypto'

const TOLERANCE_SEC = 5 * 60

export function getPortOneWebhookSecret(): string {
  return (
    process.env.PORTONE_WEBHOOK_SECRET?.trim() ||
    process.env.PORTONE_V2_WEBHOOK_SECRET?.trim() ||
    ''
  )
}

/**
 * @returns 검증 성공 true, 시크릿 미설정 시 true(하위 호환), 헤더/서명 불일치 시 false
 */
export function verifyPortOneWebhookPayload(
  rawBody: string,
  webhookId: string | null,
  webhookTimestamp: string | null,
  webhookSignature: string | null,
  secret: string,
): boolean {
  if (!secret) return true

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return false
  }

  const ts = parseInt(webhookTimestamp, 10)
  const now = Math.floor(Date.now() / 1000)
  if (Number.isNaN(ts) || now - ts > TOLERANCE_SEC || ts > now + TOLERANCE_SEC) {
    return false
  }

  let key: Buffer
  if (secret.startsWith('whsec_')) {
    key = Buffer.from(secret.slice('whsec_'.length), 'base64')
  } else {
    key = Buffer.from(secret, 'utf8')
  }

  const signedContent = `${webhookId}.${ts}.${rawBody}`
  const expectedB64 = crypto.createHmac('sha256', key).update(signedContent, 'utf8').digest('base64')

  const chunks = webhookSignature.trim().split(/\s+/)
  for (const part of chunks) {
    const [version, sig] = part.split(',', 2)
    if (version !== 'v1' || !sig) continue
    try {
      const a = Buffer.from(sig, 'utf8')
      const b = Buffer.from(expectedB64, 'utf8')
      if (a.length === b.length && crypto.timingSafeEqual(a, b)) {
        return true
      }
    } catch {
      /* length mismatch */
    }
  }
  return false
}
