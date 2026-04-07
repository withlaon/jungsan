/**
 * 포트원 V2 REST API 인증용 비밀키.
 * 관리자 콘솔 → 결제 연동 → 연동 관리 → 식별 코드·API Keys → API Secret(V2)
 *
 * 브라우저에서 https://api.portone.io/... 를 직접 열면 Authorization 헤더가 없어
 * {"type":"UNAUTHORIZED"} 가 나오는 것이 정상입니다. 서버에서만 호출해야 합니다.
 */

export function getPortOneApiSecret(): string {
  const candidates = [
    process.env.PORTONE_API_SECRET,
    process.env.PORTONE_V2_API_SECRET,
    process.env.PORTONE_API_V2_SECRET,
  ]
  for (const raw of candidates) {
    const v = raw?.trim()
    if (v) return v
  }
  return ''
}

export function requirePortOneApiSecret(): string {
  const s = getPortOneApiSecret()
  if (!s) {
    throw new Error(
      'PORTONE_API_SECRET(포트원 V2 API Secret)가 서버에 설정되지 않았습니다. ' +
        '관리자 콘솔 연동 정보에서 복사해 .env / Vercel 환경변수에 넣어 주세요.',
    )
  }
  return s
}
