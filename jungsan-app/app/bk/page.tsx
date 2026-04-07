'use client'

/**
 * KCP 등 PG 리디렉션용 짧은 복귀 URL (`/bk`).
 * 긴 경로(`/subscription?...`)가 returnUrl 전문 길이를 넘기는 경우를 줄입니다.
 */

import { Suspense, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

function BillingReturnBridge() {
  const router = useRouter()
  const sp = useSearchParams()

  useEffect(() => {
    const p = new URLSearchParams(sp.toString())
    if (!p.has('billing_issue')) p.set('billing_issue', '1')
    const q = p.toString()
    router.replace(`/subscription?${q}`)
  }, [router, sp])

  return (
    <div className="flex min-h-[40vh] items-center justify-center bg-slate-950 text-slate-400 text-sm">
      결제 창에서 돌아오는 중입니다…
    </div>
  )
}

export default function BillingKeyReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center bg-slate-950 text-slate-400 text-sm">
          로딩 중…
        </div>
      }
    >
      <BillingReturnBridge />
    </Suspense>
  )
}
