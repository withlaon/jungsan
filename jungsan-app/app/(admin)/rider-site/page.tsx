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

  // profiles ?Œì´ë¸”ì˜ username ì¡°íšŒ
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
    toast.success('?¼ì´???¬ì´??ì£¼ì†Œê°€ ë³µì‚¬?˜ì—ˆ?µë‹ˆ??')
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold text-white">?¼ì´???¬ì´??/h2>
        <p className="text-slate-400 text-sm mt-1">?¼ì´?”ê? ?•ì‚° ?´ì—­??ì§ì ‘ ì¡°íšŒ?˜ëŠ” ?„ìš© ?˜ì´ì§€</p>
      </div>

      {/* ê°œì¸ ?„ìš© URL (ì¶”ì²œ) */}
      <Card className="border-blue-600/60 bg-blue-900/15">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-blue-300 text-base flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              ???„ìš© ?¼ì´???¬ì´??ì£¼ì†Œ
            </CardTitle>
            <Badge className="bg-blue-700/60 text-blue-200 text-xs">ê¶Œì¥</Badge>
          </div>
          <p className="text-slate-400 text-xs mt-1">
            ??ì£¼ì†Œë¡??‘ì†???¼ì´?”ëŠ” <span className="text-blue-300 font-medium">??ê³„ì •???±ë¡???¼ì´?”ë§Œ</span> ì¡°íšŒ?????ˆìŠµ?ˆë‹¤.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {userLoading || !username ? (
            <div className="bg-slate-800 rounded-lg p-4 text-slate-500 text-sm text-center">
              {userLoading ? 'ë¶ˆëŸ¬?¤ëŠ” ì¤?..' : 'ë¡œê·¸???•ë³´ë¥??•ì¸?????†ìŠµ?ˆë‹¤.'}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-lg p-4 flex items-center justify-between gap-3">
              <span className="text-white font-mono text-sm break-all">{personalUrl}</span>
              <div className="flex gap-2 shrink-0">
                <Button size="sm" onClick={() => handleCopy(personalUrl)}
                  className={`h-8 text-xs transition-colors ${copiedPersonal ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-blue-600 hover:bg-blue-700'}`}>
                  {copiedPersonal
                    ? <><CheckCircle className="h-3.5 w-3.5 mr-1" />ë³µì‚¬??/>
                    : <><Copy className="h-3.5 w-3.5 mr-1" />ë³µì‚¬</>}
                </Button>
                <Button size="sm" variant="outline"
                  onClick={() => window.open(personalUrl, '_blank')}
                  className="h-8 text-xs border-slate-600 text-slate-300 hover:bg-slate-700">
                  <ExternalLink className="h-3.5 w-3.5 mr-1" />?´ê¸°
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ?´ìš© ?ˆë‚´ */}
      <Card className="border-slate-700 bg-slate-900">
        <CardHeader className="pb-3">
          <CardTitle className="text-white text-base flex items-center gap-2">
            <Info className="h-4 w-4 text-slate-400" />
            ?´ìš© ?ˆë‚´
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            {
              step: '1',
              title: '?„ìš© ì£¼ì†Œ ê³µìœ ',
              desc: '?????„ìš© ?¼ì´???¬ì´??ì£¼ì†Œë¥?ì¹´ì¹´?¤í†¡, ë¬¸ì ?±ìœ¼ë¡??¼ì´?”ì—ê²??„ë‹¬?˜ì„¸??',
              color: 'bg-blue-600',
            },
            {
              step: '2',
              title: 'ì£¼ë??±ë¡ë²ˆí˜¸ ?…ë ¥',
              desc: '?¼ì´?”ê? ?¬ì´?¸ì— ?‘ì† ??ë³¸ì¸??ì£¼ë??±ë¡ë²ˆí˜¸ë¥??…ë ¥?©ë‹ˆ??',
              color: 'bg-violet-600',
            },
            {
              step: '3',
              title: '?•ì‚° ?´ì—­ ?•ì¸',
              desc: '??ê³„ì •???±ë¡???¼ì´?”ì˜ ì£¼ë??±ë¡ë²ˆí˜¸?€ ?¼ì¹˜?˜ë©´ ?´ë‹¹ ?¼ì´?”ì˜ ?•ì‚° ?´ì—­???œì‹œ?©ë‹ˆ??',
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
                <span className="font-bold">?„ìš© ì£¼ì†Œ</span>ë¥??¬ìš©?˜ë©´ ?¤ë¥¸ ê´€ë¦¬ì ê³„ì •???¼ì´?”ì? ?¼ë™?˜ì? ?ŠìŠµ?ˆë‹¤.
                ?¼ì´??ê´€ë¦???—???¼ì´?”ì˜ <span className="font-bold">ì£¼ë??±ë¡ë²ˆí˜¸</span>ê°€ ?•í™•???±ë¡?˜ì–´ ?ˆì–´??ì¡°íšŒ?©ë‹ˆ??
              </span>
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-2">
        <Badge className="bg-emerald-900/40 text-emerald-300 border border-emerald-700/50">
          <CheckCircle className="h-3 w-3 mr-1" />?œë¹„???´ì˜ ì¤?        </Badge>
        <span className="text-slate-500 text-xs">?¼ì´???¬ì´?¸ëŠ” ë³„ë„ ë¡œê·¸???†ì´ 24?œê°„ ?‘ì† ê°€?¥í•©?ˆë‹¤.</span>
      </div>
    </div>
  )
}
