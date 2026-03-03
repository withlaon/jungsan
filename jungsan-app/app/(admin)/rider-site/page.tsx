'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe, Copy, ExternalLink, Smartphone, CheckCircle, Info } from 'lucide-react'
import { toast } from 'sonner'

export default function RiderSitePage() {
  const [siteUrl, setSiteUrl] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSiteUrl(`${window.location.origin}/rider`)
  }, [])

  const handleCopy = () => {
    navigator.clipboard.writeText(siteUrl)
    setCopied(true)
    toast.success('라이더 사이트 주소가 복사되었습니다.')
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">라이더 사이트</h2>
        <p className="text-slate-400 text-sm mt-1">라이더가 정산 내역을 직접 조회하는 전용 페이지</p>
      </div>

      {/* 사이트 URL 카드 */}
      <Card className="border-blue-700/50 bg-blue-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-blue-300 text-base flex items-center gap-2">
            <Globe className="h-5 w-5" />
            라이더 전용 정산 조회 사이트
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* URL 표시 */}
          <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
            <span className="text-white font-mono text-sm break-all">{siteUrl || 'http://localhost:3000/rider'}</span>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={handleCopy}
                className={`h-8 text-xs transition-colors ${copied ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                {copied
                  ? <><CheckCircle className="h-3.5 w-3.5 mr-1" />복사됨</>
                  : <><Copy className="h-3.5 w-3.5 mr-1" />복사</>}
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => window.open(siteUrl, '_blank')}
                className="h-8 text-xs border-slate-600 text-slate-300 hover:bg-slate-700">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />열기
              </Button>
            </div>
          </div>

          {/* QR 또는 접속 안내 */}
          <div className="grid grid-cols-1 gap-3">
            <div className="bg-slate-800/60 rounded-lg p-3 flex items-start gap-3">
              <Smartphone className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-white text-sm font-medium">접속 방법</p>
                <p className="text-slate-400 text-xs mt-1">
                  위 주소를 라이더에게 공유하면, 라이더가 본인의 <span className="text-blue-300 font-medium">주민등록번호</span>를 입력하여 자신의 정산 내역을 확인할 수 있습니다.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 이용 안내 */}
      <Card className="border-slate-700 bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-400" />
            이용 안내
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              step: '1',
              title: '주소 공유',
              desc: '위 라이더 사이트 주소를 카카오톡, 문자 등으로 라이더에게 전달하세요.',
              color: 'bg-blue-600',
            },
            {
              step: '2',
              title: '주민등록번호 입력',
              desc: '라이더가 사이트에 접속 후 본인의 주민등록번호를 입력합니다.',
              color: 'bg-violet-600',
            },
            {
              step: '3',
              title: '정산 내역 확인',
              desc: '라이더 관리에 등록된 주민등록번호와 일치하면 해당 라이더의 정산 내역이 표시됩니다.',
              color: 'bg-emerald-600',
            },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <span className={`${item.color} text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                {item.step}
              </span>
              <div>
                <p className="text-white text-sm font-medium">{item.title}</p>
                <p className="text-slate-400 text-xs mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}

          <div className="mt-2 bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
            <p className="text-amber-300 text-xs flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              라이더 관리 탭에서 라이더의 <span className="font-bold mx-0.5">주민등록번호</span>가 정확히 등록되어 있어야 조회됩니다. 주민등록번호 미등록 라이더는 접속할 수 없습니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* 상태 배지 */}
      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
          <CheckCircle className="h-3 w-3 mr-1" />서비스 운영 중
        </Badge>
        <span className="text-slate-500 text-xs">라이더 사이트는 별도 로그인 없이 24시간 접속 가능합니다.</span>
      </div>
    </div>
  )
}
