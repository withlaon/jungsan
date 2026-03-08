'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@/hooks/useUser'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Copy, ExternalLink, CheckCircle, Info, Link2 } from 'lucide-react'
import { toast } from 'sonner'

export default function RiderSitePage() {
  const { user, loading: userLoading } = useUser()
  const [origin, setOrigin] = useState('')
  const [copiedPersonal, setCopiedPersonal] = useState(false)

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  // profiles ?뚯씠釉붿쓽 username 議고쉶
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

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url)
    setCopiedPersonal(true)
    setTimeout(() => setCopiedPersonal(false), 2000)
    toast.success('?쇱씠???ъ씠??二쇱냼媛 蹂듭궗?섏뿀?듬땲??')
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">?쇱씠???ъ씠??/h2>
        <p className="text-slate-400 text-sm mt-1">?쇱씠?붽? ?뺤궛 ?댁뿭??吏곸젒 議고쉶?섎뒗 ?꾩슜 ?섏씠吏</p>
      </div>

      {/* 媛쒖씤 ?꾩슜 URL (異붿쿇) */}
      <Card className="border-blue-600/60 bg-blue-900/15">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-blue-300 text-base flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              ???꾩슜 ?쇱씠???ъ씠??二쇱냼
            </CardTitle>
            <Badge className="bg-blue-700/60 text-blue-200 text-xs">沅뚯옣</Badge>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            ??二쇱냼濡??묒냽???쇱씠?붾뒗 <span className="text-blue-300 font-medium">??怨꾩젙???깅줉???쇱씠?붾쭔</span> 議고쉶?????덉뒿?덈떎.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {userLoading || !username ? (
            <div className="bg-slate-800 rounded-lg p-4 text-slate-500 text-sm text-center">
              {userLoading ? '遺덈윭?ㅻ뒗 以?..' : '濡쒓렇???뺣낫瑜??뺤씤?????놁뒿?덈떎.'}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
              <span className="text-white font-mono text-sm break-all">{personalUrl}</span>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={() => handleCopy(personalUrl)}
                  className={`h-8 text-xs transition-colors ${copiedPersonal ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {copiedPersonal
                    ? <><CheckCircle className="h-3.5 w-3.5 mr-1" />蹂듭궗??/>
                    : <><Copy className="h-3.5 w-3.5 mr-1" />蹂듭궗</>}
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => window.open(personalUrl, '_blank')}
                  className="h-8 text-xs border-slate-600 text-slate-300 hover:bg-slate-700">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />?닿린
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ?댁슜 ?덈궡 */}
      <Card className="border-slate-700 bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-400" />
            ?댁슜 ?덈궡
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              step: '1',
              title: '?꾩슜 二쇱냼 怨듭쑀',
              desc: '?????꾩슜 ?쇱씠???ъ씠??二쇱냼瑜?移댁뭅?ㅽ넚, 臾몄옄 ?깆쑝濡??쇱씠?붿뿉寃??꾨떖?섏꽭??',
              color: 'bg-blue-600',
            },
            {
              step: '2',
              title: '二쇰??깅줉踰덊샇 ?낅젰',
              desc: '?쇱씠?붽? ?ъ씠?몄뿉 ?묒냽 ??蹂몄씤??二쇰??깅줉踰덊샇瑜??낅젰?⑸땲??',
              color: 'bg-violet-600',
            },
            {
              step: '3',
              title: '?뺤궛 ?댁뿭 ?뺤씤',
              desc: '??怨꾩젙???깅줉???쇱씠?붿쓽 二쇰??깅줉踰덊샇? ?쇱튂?섎㈃ ?대떦 ?쇱씠?붿쓽 ?뺤궛 ?댁뿭???쒖떆?⑸땲??',
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
                <span className="font-bold">?꾩슜 二쇱냼</span>瑜??ъ슜?섎㈃ ?ㅻⅨ 愿由ъ옄 怨꾩젙???쇱씠?붿? ?쇰룞?섏? ?딆뒿?덈떎.
                ?쇱씠??愿由???뿉???쇱씠?붿쓽 <span className="font-bold">二쇰??깅줉踰덊샇</span>媛 ?뺥솗???깅줉?섏뼱 ?덉뼱??議고쉶?⑸땲??
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
          <CheckCircle className="h-3 w-3 mr-1" />?쒕퉬???댁쁺 以?        </Badge>
        <span className="text-slate-500 text-xs">?쇱씠???ъ씠?몃뒗 蹂꾨룄 濡쒓렇???놁씠 24?쒓컙 ?묒냽 媛?ν빀?덈떎.</span>
      </div>
    </div>
  )
}