'use client'

/**
 * 구독 결제 관리 페이지로 리다이렉트
 * (이 경로는 북마크 호환성을 위해 유지)
 */
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PaymentTestRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/subscription')
  }, [router])
  return null
}
