'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { CreditCard, CheckCircle, XCircle, AlertCircle, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import {
  requestPayment,
  generateOrderId,
  PORTONE_STORE_ID,
  PORTONE_CHANNEL_KEY,
} from '@/lib/portone/client'

const ENV_CONFIGURED =
  PORTONE_STORE_ID && !PORTONE_STORE_ID.includes('xxxxxxxx') &&
  PORTONE_CHANNEL_KEY && !PORTONE_CHANNEL_KEY.includes('xxxxxxxx')

type PaymentStatus = 'idle' | 'loading' | 'success' | 'error'

export default function PaymentTestPage() {
  const [amount, setAmount] = useState('1000')
  const [orderName, setOrderName] = useState('NHN KCP 테스트 결제')
  const [customerName, setCustomerName] = useState('홍길동')
  const [customerEmail, setCustomerEmail] = useState('test@example.com')
  const [status, setStatus] = useState<PaymentStatus>('idle')
  const [result, setResult] = useState<{ paymentId?: string; error?: string } | null>(null)
  const [verified, setVerified] = useState<boolean | null>(null)

  const handlePayment = async () => {
    const numAmount = parseInt(amount, 10)
    if (isNaN(numAmount) || numAmount < 100) {
      toast.error('결제 금액은 100원 이상이어야 합니다.')
      return
    }

    setStatus('loading')
    setResult(null)
    setVerified(null)

    const orderId = generateOrderId('test')
    const payResult = await requestPayment({
      orderId,
      orderName,
      totalAmount: numAmount,
      customerName,
      customerEmail,
    })

    if (!payResult.success) {
      setStatus('error')
      setResult({ error: payResult.error?.message ?? '결제 실패' })
      toast.error(payResult.error?.message ?? '결제에 실패했습니다.')
      return
    }

    setStatus('success')
    setResult({ paymentId: payResult.paymentId })
    toast.success('결제가 완료되었습니다. 서버 검증 중...')

    // 서버 검증
    try {
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          paymentId: payResult.paymentId,
          expectedAmount: numAmount,
        }),
      })
      const verifyData = await verifyRes.json()
      if (verifyData.success) {
        setVerified(true)
        toast.success('서버 결제 검증 완료!')
      } else {
        setVerified(false)
        toast.error(`서버 검증 실패: ${verifyData.error}`)
      }
    } catch {
      setVerified(false)
      toast.error('서버 검증 요청 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-blue-400" />
          NHN KCP 테스트 결제
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          포트원 V2 NHN KCP 테스트 채널 연동을 확인합니다.
        </p>
      </div>

      {/* 환경설정 상태 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-slate-300">연동 설정 상태</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">상점 아이디 (Store ID)</span>
            {PORTONE_STORE_ID && !PORTONE_STORE_ID.includes('xxxxxxxx') ? (
              <Badge variant="outline" className="border-green-500 text-green-400 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> 설정됨
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-500 text-red-400 text-xs">
                <XCircle className="h-3 w-3 mr-1" /> 미설정
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">채널 키 (NHN KCP 테스트)</span>
            {PORTONE_CHANNEL_KEY && !PORTONE_CHANNEL_KEY.includes('xxxxxxxx') ? (
              <Badge variant="outline" className="border-green-500 text-green-400 text-xs">
                <CheckCircle className="h-3 w-3 mr-1" /> 설정됨
              </Badge>
            ) : (
              <Badge variant="outline" className="border-red-500 text-red-400 text-xs">
                <XCircle className="h-3 w-3 mr-1" /> 미설정
              </Badge>
            )}
          </div>

          {!ENV_CONFIGURED && (
            <div className="mt-3 p-3 bg-amber-950/30 border border-amber-700/50 rounded-md">
              <p className="text-amber-400 text-xs font-medium flex items-center gap-1.5 mb-1.5">
                <AlertCircle className="h-3.5 w-3.5" />
                설정 필요
              </p>
              <ol className="text-amber-300/80 text-xs space-y-1 list-decimal list-inside">
                <li>
                  <a
                    href="https://admin.portone.io"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-200 inline-flex items-center gap-0.5"
                  >
                    포트원 관리자콘솔 <ExternalLink className="h-3 w-3" />
                  </a>
                  에 로그인
                </li>
                <li>
                  [연동 관리] → [채널 관리] → [테스트 채널 추가] → <strong>NHN KCP</strong> 선택
                </li>
                <li>생성된 채널 키를 <code className="bg-amber-900/50 px-1 rounded">.env.local</code>의 <code className="bg-amber-900/50 px-1 rounded">NEXT_PUBLIC_PORTONE_CHANNEL_KEY</code>에 입력</li>
                <li>
                  [연동 관리] → [식별코드 및 API Keys]에서 상점 아이디를 <code className="bg-amber-900/50 px-1 rounded">NEXT_PUBLIC_PORTONE_STORE_ID</code>에 입력
                </li>
                <li>개발 서버 재시작</li>
              </ol>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 결제 테스트 폼 */}
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-white">결제 정보</CardTitle>
          <CardDescription className="text-slate-400">
            테스트 결제는 자동으로 취소됩니다. 실제 출금이 발생하지 않습니다.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">결제 금액 (원)</Label>
              <Input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
                min="100"
                step="100"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">주문명</Label>
              <Input
                value={orderName}
                onChange={(e) => setOrderName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">구매자 이름</Label>
              <Input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">구매자 이메일</Label>
              <Input
                type="email"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                className="bg-slate-800 border-slate-600 text-white"
              />
            </div>
          </div>

          <Button
            onClick={handlePayment}
            disabled={status === 'loading' || !ENV_CONFIGURED}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {status === 'loading' ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                결제 처리 중...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <CreditCard className="h-4 w-4" />
                NHN KCP 테스트 결제 요청
              </span>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* 결제 결과 */}
      {result && (
        <Card className={`border ${status === 'success' ? 'bg-green-950/20 border-green-700/50' : 'bg-red-950/20 border-red-700/50'}`}>
          <CardContent className="pt-4 space-y-2">
            <div className="flex items-center gap-2">
              {status === 'success' ? (
                <CheckCircle className="h-5 w-5 text-green-400" />
              ) : (
                <XCircle className="h-5 w-5 text-red-400" />
              )}
              <span className={`font-medium ${status === 'success' ? 'text-green-300' : 'text-red-300'}`}>
                {status === 'success' ? '결제 완료' : '결제 실패'}
              </span>
            </div>
            {result.paymentId && (
              <p className="text-slate-400 text-sm">
                결제 ID: <code className="text-slate-200 bg-slate-800 px-1.5 py-0.5 rounded text-xs">{result.paymentId}</code>
              </p>
            )}
            {result.error && (
              <p className="text-red-400 text-sm">{result.error}</p>
            )}
            {verified !== null && (
              <div className={`flex items-center gap-2 text-sm mt-1 ${verified ? 'text-green-400' : 'text-red-400'}`}>
                {verified ? (
                  <><CheckCircle className="h-4 w-4" /> 서버 검증 완료</>
                ) : (
                  <><XCircle className="h-4 w-4" /> 서버 검증 실패</>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 참고 정보 */}
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="pt-4">
          <p className="text-slate-500 text-xs leading-relaxed">
            <strong className="text-slate-400">테스트 유의사항:</strong> KB국민카드, NH농협카드, 카카오뱅크(국민 계열)는 테스트 환경에서 결제가 제한될 수 있습니다.
            테스트 결제는 30분~1시간 간격 또는 당일 자정에 자동 취소됩니다.
            포트원 관리자콘솔의 결제 건은 '결제완료' 상태로 남으며, 취소 시도 시 '기 취소 거래' 오류가 발생할 수 있습니다.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
