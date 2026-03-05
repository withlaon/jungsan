'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/useUser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Globe, Copy, ExternalLink, Smartphone, CheckCircle, Info, Link2 } from 'lucide-react'
import { toast } from 'sonner'

export default function RiderSitePage() {
  const { user, loading: userLoading } = useUser()
  const [origin, setOrigin] = useState('')
  const [copiedPersonal, setCopiedPersonal] = useState(false)
  const [copiedGeneral, setCopiedGeneral] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // profiles 테이블의 username 조회
  const [username, setUsername] = useState<string | null>(null)
  useEffect(() => {
    if (!user) return
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.username) setUsername(data.username)
        })
    })
  }, [user])

  const personalUrl = username ? `${origin}/rider/site/${username}` : ''
  const generalUrl = `${origin}/rider`

  const handleCopy = (url: string, type: 'personal' | 'general') => {
    navigator.clipboard.writeText(url)
    if (type === 'personal') {
      setCopiedPersonal(true)
      setTimeout(() => setCopiedPersonal(false), 2000)
    } else {
      setCopiedGeneral(true)
      setTimeout(() => setCopiedGeneral(false), 2000)
    }
    toast.success('라이더 사이트 주소가 복사되었습니다.')
  }

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">라이더 사이트</h2>
        <p className="text-slate-400 text-sm mt-1">라이더가 정산 내역을 직접 조회하는 전용 페이지</p>
      </div>

      {/* 개인 전용 URL (추천) */}
      <Card className="border-blue-600/60 bg-blue-900/15">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-blue-300 text-base flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              내 전용 라이더 사이트 주소
            </CardTitle>
            <Badge className="bg-blue-700/60 text-blue-200 text-xs">권장</Badge>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            이 주소로 접속한 라이더는 <span className="text-blue-300 font-medium">내 계정에 등록된 라이더만</span> 조회할 수 있습니다.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {userLoading || !username ? (
            <div className="bg-slate-800 rounded-lg p-4 text-slate-500 text-sm text-center">
              {userLoading ? '불러오는 중...' : '로그인 정보를 확인할 수 없습니다.'}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
              <span className="text-white font-mono text-sm break-all">{personalUrl}</span>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={() => handleCopy(personalUrl, 'personal')}
                  className={`h-8 text-xs transition-colors ${copiedPersonal ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {copiedPersonal
                    ? <><CheckCircle className="h-3.5 w-3.5 mr-1" />복사됨</>
                    : <><Copy className="h-3.5 w-3.5 mr-1" />복사</>}
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => window.open(personalUrl, '_blank')}
                  className="h-8 text-xs border-slate-600 text-slate-300 hover:bg-slate-700">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />열기
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 공용 URL */}
      <Card className="border-slate-700 bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-slate-300 text-base flex items-center gap-2">
            <Globe className="h-5 w-5 text-slate-400" />
            공용 라이더 사이트 주소
          </CardTitle>
          <p className="text-slate-500 text-xs mt-1">모든 계정의 라이더가 조회 가능한 공용 주소 (SSN 기반 전체 검색)</p>
        </CardHeader>
        <CardContent>
          <div className="bg-slate-800/60 rounded-lg p-4 flex items-center justify-between gap-3">
            <span className="text-slate-400 font-mono text-sm break-all">{generalUrl || 'https://jungsan-iol8.vercel.app/rider'}</span>
            <div className="flex gap-2 shrink-0">
              <Button size="sm" onClick={() => handleCopy(generalUrl, 'general')}
                className={`h-8 text-xs transition-colors ${copiedGeneral ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-500'}`}>
                {copiedGeneral
                  ? <><CheckCircle className="h-3.5 w-3.5 mr-1" />복사됨</>
                  : <><Copy className="h-3.5 w-3.5 mr-1" />복사</>}
              </Button>
              <Button size="sm" variant="outline"
                onClick={() => window.open(generalUrl, '_blank')}
                className="h-8 text-xs border-slate-700 text-slate-400 hover:bg-slate-700">
                <ExternalLink className="h-3.5 w-3.5 mr-1" />열기
              </Button>
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
              title: '전용 주소 공유',
              desc: '위 내 전용 라이더 사이트 주소를 카카오톡, 문자 등으로 라이더에게 전달하세요.',
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
              desc: '내 계정에 등록된 라이더의 주민등록번호와 일치하면 해당 라이더의 정산 내역이 표시됩니다.',
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

          <div className="mt-2 bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
            <p className="text-blue-300 text-xs flex items-start gap-1.5">
              <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                <span className="font-bold">전용 주소</span>를 사용하면 다른 관리자 계정의 라이더와 혼동되지 않습니다.
                라이더 관리 탭에서 라이더의 <span className="font-bold">주민등록번호</span>가 정확히 등록되어 있어야 조회됩니다.
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
          <CheckCircle className="h-3 w-3 mr-1" />서비스 운영 중
        </Badge>
        <span className="text-slate-500 text-xs">라이더 사이트는 별도 로그인 없이 24시간 접속 가능합니다.</span>
      </div>
    </div>
  )
}
