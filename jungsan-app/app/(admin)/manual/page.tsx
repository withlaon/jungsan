'use client'

import { useRef, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useUser } from '@/hooks/useUser'
import { createClient } from '@/lib/supabase/client'
import {
  BookOpen, Download, BarChart3, Users, Wallet, Gift, Settings,
  Upload, FileText, Globe, ChevronRight, Info, AlertTriangle,
  CheckCircle, Megaphone, MessageSquare, LogOut, ImagePlus, Loader2,
} from 'lucide-react'

export default function ManualPage() {
  const printRef = useRef<HTMLDivElement>(null)
  const { platform, userId } = useUser()
  const isBaemin = platform === 'baemin'
  const [pdfLoading, setPdfLoading] = useState(false)
  const [incomeTaxRate, setIncomeTaxRate] = useState<number>(0.033)

  useEffect(() => {
    const fetchRate = async () => {
      const supabase = createClient()
      if (userId) {
        const { data: userSettings } = await supabase
          .from('fee_settings')
          .select('income_tax_rate')
          .eq('user_id', userId)
          .order('effective_from', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (userSettings) { setIncomeTaxRate(Number(userSettings.income_tax_rate)); return }
      }
      const { data } = await supabase
        .from('fee_settings')
        .select('income_tax_rate')
        .is('user_id', null)
        .order('effective_from', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (data) setIncomeTaxRate(Number(data.income_tax_rate))
    }
    fetchRate()
  }, [userId])

  const taxRateLabel = `${(incomeTaxRate * 100).toFixed(1)}%`

  const platformLabel = isBaemin ? '諛곕떖??誘쇱”' : '荑좏뙜?댁툩'
  const platformColor = isBaemin ? 'text-emerald-400' : 'text-yellow-400'
  const platformBg   = isBaemin ? 'bg-emerald-900/30 border-emerald-700/40' : 'bg-yellow-900/30 border-yellow-700/40'

  const handleDownloadPDF = async () => {
    if (!printRef.current || pdfLoading) return
    setPdfLoading(true)

    // PDF???ы븿?섏? ?딆쓣 ?붿냼瑜??꾩떆濡??④?
    const noPrintEls = printRef.current.querySelectorAll<HTMLElement>('.no-print')
    noPrintEls.forEach(el => { el.style.display = 'none' })

    // ??? html2canvas 誘몄????됱긽 ?⑥닔(lab, oklch, lch) ?ъ쟾 蹂?????
    // canvas fillStyle???댁슜?섎㈃ 釉뚮씪?곗?媛 ?먮룞?쇰줈 ?덉쟾??sRGB 媛믪쑝濡?蹂?섑빐 以??
    const fixedStyles: Array<{ el: HTMLElement; prop: string; prev: string }> = []

    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = 1; tempCanvas.height = 1
    const ctx2d = tempCanvas.getContext('2d')

    const toSafeColor = (color: string): string | null => {
      // lab(), oklch(), lch() ?ы븿??媛믩쭔 蹂??
      if (!color || !/\blab\(|\boklch\(|\blch\(/.test(color)) return null
      if (!ctx2d) return null
      try {
        ctx2d.fillStyle = color
        return ctx2d.fillStyle // 釉뚮씪?곗?媛 rgb() / #rrggbb ?뺥깭濡?蹂?섑빐 諛섑솚
      } catch {
        return null
      }
    }

    const CSS_PROPS: [string, string][] = [
      ['color',              'color'],
      ['background-color',   'backgroundColor'],
      ['border-top-color',   'borderTopColor'],
      ['border-right-color', 'borderRightColor'],
      ['border-bottom-color','borderBottomColor'],
      ['border-left-color',  'borderLeftColor'],
    ]

    const allEls = [printRef.current, ...printRef.current.querySelectorAll<HTMLElement>('*')]
    allEls.forEach(el => {
      const computed = window.getComputedStyle(el)
      CSS_PROPS.forEach(([cssProp, jsProp]) => {
        const val = computed[jsProp as keyof CSSStyleDeclaration] as string
        const safe = toSafeColor(val)
        if (safe) {
          fixedStyles.push({ el, prop: cssProp, prev: el.style.getPropertyValue(cssProp) })
          el.style.setProperty(cssProp, safe, 'important')
        }
      })
    })
    // ??????????????????????????????????????????????????????????????

    try {
      const html2pdf = (await import('html2pdf.js')).default
      const filename = `?쇱씠?붿젙?곗떆?ㅽ뀥_?ъ슜?먮찓?댁뼹_${platformLabel}.pdf`

      await html2pdf()
        .set({
          margin: [12, 10, 12, 10],
          filename,
          image: { type: 'jpeg', quality: 0.97 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#0f172a',
            logging: false,
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .from(printRef.current)
        .save()
    } catch (err) {
      console.error('PDF ?앹꽦 ?ㅽ뙣:', err)
      alert('PDF ?앹꽦???ㅽ뙣?덉뒿?덈떎. ?ㅼ떆 ?쒕룄?댁＜?몄슂.')
    } finally {
      // 蹂?섑뻽???ㅽ???蹂듭썝
      fixedStyles.forEach(({ el, prop, prev }) => {
        if (prev) el.style.setProperty(prop, prev)
        else el.style.removeProperty(prop)
      })
      noPrintEls.forEach(el => { el.style.display = '' })
      setPdfLoading(false)
    }
  }

  /* ? 怨듯넻 ?ㅽ????ы띁 ? */
  const tip   = (text: React.ReactNode) => (
    <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3 text-xs flex items-start gap-2">
      <Info className="h-3.5 w-3.5 text-blue-400 shrink-0 mt-0.5" />
      <span className="text-blue-300">{text}</span>
    </div>
  )
  const warn  = (text: React.ReactNode) => (
    <div className="bg-amber-900/20 border border-amber-700/40 rounded-lg p-3 text-xs flex items-start gap-2">
      <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />
      <span className="text-amber-300">{text}</span>
    </div>
  )
  const good  = (text: React.ReactNode) => (
    <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-lg p-3 text-xs flex items-start gap-2">
      <CheckCircle className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
      <span className="text-emerald-300">{text}</span>
    </div>
  )

  type Section = {
    id: string; title: string; icon: React.ComponentType<{ className?: string }>
    badge?: string; badgeColor?: string; content: React.ReactNode
  }

  const sections: Section[] = [
    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       1. ?쒖뒪??媛쒖슂
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'overview', title: '?쒖뒪??媛쒖슂', icon: BookOpen,
      content: (
        <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
          <p>
            <strong className="text-white">?쇱씠???뺤궛 ?쒖뒪??/strong>? {isBaemin ? '諛곕떖??誘쇱”' : '荑좏뙜?댁툩'}
            {' '}?쇱씠?붿쓽 二쇨컙 ?뺤궛???먮룞?뷀븯???듯빀 愿由??뚮옯?쇱엯?덈떎.
            ?묒? ?뚯씪???낅줈?쒗븯硫?蹂댄뿕猷뙿룰?由щ퉬쨌?꾨줈紐⑥뀡쨌?뚮뱷?몃? ?먮룞 怨꾩궛?섍퀬 ?쇱씠?붾퀎 ?뺤궛?쒕? 諛쒗뻾?⑸땲??
          </p>

          {/* ?뚮옯??諛곗? */}
          <div className={`border rounded-lg p-3 ${platformBg}`}>
            <p className={`text-xs font-medium ${platformColor}`}>?꾩옱 怨꾩젙 ?뚮옯?? {platformLabel}</p>
          </div>

          <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-4">
            <p className="text-blue-300 font-medium mb-2 flex items-center gap-2">
              <Info className="h-4 w-4" /> 二쇱슂 湲곕뒫
            </p>
            <ul className="space-y-1.5 text-slate-300">
              {[
                '?쇱씠???깅줉 諛?愿由?(媛쒕퀎/?묒? ?쇨큵?깅줉, ?ㅼ쨷 ?좏깮 ?쇨큵泥섎━)',
                '二쇨컙 ?뺤궛 ?뚯씪 ?낅줈??諛??먮룞 怨꾩궛 (蹂듭닔 ?뚯씪 ?⑹궛 吏??',
                '?꾨줈紐⑥뀡(吏?ы봽濡쒕え?? 쨌 愿由щ퉬 쨌 蹂댄뿕猷??먮룞 諛섏쁺',
                '?좎?湲됯툑 ?깅줉쨌怨듭젣쨌?뚯닔 泥섎━',
                '?쇱씠?붾퀎 媛쒖씤 ?뺤궛??留곹겕 諛쒗뻾 (怨꾩젙蹂??꾩슜 URL)',
                '怨듭??ы빆 ?대?吏 ?앹꽦 쨌 ???쨌 愿由?,
                '?꾩껜愿由ъ옄?먭쾶 臾몄쓽?섍린 (?ㅼ떆媛??듬?)',
                '二쇨컙 吏???쒖씠????쒕낫??,
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2">
                  <ChevronRight className="h-3.5 w-3.5 mt-0.5 text-blue-400 shrink-0" />{t}
                </li>
              ))}
            </ul>
          </div>

          {warn(
            <><strong>沅뚯옣 ?ъ슜 ?쒖꽌:</strong> ?쇱씠???깅줉 ??愿由щ퉬쨌?꾨줈紐⑥뀡 ?ㅼ젙 ??蹂댄뿕猷??ㅼ젙 ???뺤궛?뚯씪 ?깅줉 ???뺤궛 ?뺤젙 ???쇱씠?붿궗?댄듃?먯꽌 ?뺤궛??怨듭쑀</>
          )}

          <div className="bg-slate-800 rounded-lg p-4 space-y-2">
            <p className="text-white font-medium text-sm">蹂댁븞 諛??몄뀡 ?뺤콉</p>
            <ul className="space-y-1 text-xs text-slate-400">
              <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" />釉뚮씪?곗?쨌??쓣 ?レ쑝硫?<strong className="text-white">?먮룞 濡쒓렇?꾩썐</strong>?⑸땲?? ?ъ젒????濡쒓렇?몄씠 ?꾩슂?⑸땲??</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" /><strong className="text-white">1?쒓컙 ?댁긽 誘몄궗??/strong> ???먮룞 濡쒓렇?꾩썐?⑸땲?? (5遺???寃쎄퀬 ?뚮┝)</li>
              <li className="flex items-start gap-2"><ChevronRight className="h-3 w-3 mt-0.5 text-slate-500 shrink-0" />媛?怨꾩젙???곗씠?곕뒗 ?꾩쟾???낅┰?곸쑝濡?愿由щ맗?덈떎.</li>
            </ul>
          </div>
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       2. ?뺣낫?섏젙 & 濡쒓퀬 ?깅줉
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'profile', title: '?뺣낫?섏젙 & 濡쒓퀬 ?깅줉', icon: ImagePlus,
      badge: '怨꾩젙 ?ㅼ젙', badgeColor: 'bg-slate-600',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>?ъ씠?쒕컮 ?섎떒 <strong className="text-white">濡쒓렇?꾩썐</strong> 踰꾪듉 ?꾨옒??<strong className="text-white">?뺣낫?섏젙</strong> 踰꾪듉???대┃?섎㈃ 怨꾩젙 ?뺣낫? 濡쒓퀬瑜?愿由ы븷 ???덉뒿?덈떎.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">??湲곕낯 ?뺣낫 ?섏젙</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>?뚯궗紐? ?ъ뾽?먮벑濡앸쾲?? ?대떦?먮챸, ?곕씫泥? ?대찓???섏젙 媛??/li>
              <li>鍮꾨?踰덊샇 蹂寃?????鍮꾨?踰덊샇瑜???踰??낅젰 ?????/li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">??濡쒓퀬 ?깅줉</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2 text-xs">
              <li>?뺣낫?섏젙 ?ㅼ씠?쇰줈洹몄뿉??濡쒓퀬 ?대?吏 ?뚯씪 ?좏깮 (PNG, JPG 沅뚯옣)</li>
              <li>誘몃━蹂닿린 ?뺤씤 ?????/li>
              <li>?깅줉??濡쒓퀬??<strong className="text-white">?ъ씠?쒕컮 ?곷떒 ?꾩씠肄?/strong>???泥댄빀?덈떎.</li>
            </ol>
          </div>

          {tip('?뚯궗 濡쒓퀬瑜??깅줉?섎㈃ ?ъ씠?쒕컮? ?쇱씠???뺤궛?쒖뿉 釉뚮옖?⑹씠 ?곸슜?⑸땲??')}
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       3. 二쇨컙?뺤궛?꾪솴 ??쒕낫??
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'dashboard', title: '二쇨컙?뺤궛?꾪솴 ??쒕낫??, icon: BarChart3,
      badge: '?꾪솴 ?뺤씤', badgeColor: 'bg-violet-700',
      content: (
        <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
          <p>?뺤궛???뺤젙??二쇨컙??吏???쒖씠?듦낵 ??ぉ蹂??섏튂瑜??쒕늿???뺤씤?⑸땲??</p>
          <ul className="space-y-2 ml-2">
            <li className="flex items-start gap-2">
              <Badge className="mt-0.5 bg-slate-700 text-slate-300 text-xs shrink-0">二쇱감 ?좏깮</Badge>
              <span>?곗륫 ?곷떒 ?쒕∼?ㅼ슫?먯꽌 議고쉶 二쇨컙???좏깮?⑸땲??</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge className="mt-0.5 bg-emerald-800 text-emerald-300 text-xs shrink-0">吏???쒖씠??/Badge>
              <span>吏?ш?由щ퉬 ??怨좎슜쨌?곗옱蹂댄뿕(?ъ뾽二? ???꾨줈紐⑥뀡鍮?+ 肄쒓?由щ퉬 + 蹂댄뿕愿由щ퉬濡?怨꾩궛?⑸땲??</span>
            </li>
            <li className="flex items-start gap-2">
              <Badge className="mt-0.5 bg-blue-800 text-blue-300 text-xs shrink-0">留됰?洹몃옒??/Badge>
              <span>理쒓렐 12二쇨컙??吏???쒖씠??異붿씠瑜??쒓컖?곸쑝濡??뺤씤?????덉뒿?덈떎.</span>
            </li>
          </ul>
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       4. ?쇱씠??愿由?
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'riders', title: '?쇱씠??愿由?, icon: Users,
      badge: '?꾩닔 ?ㅼ젙', badgeColor: 'bg-blue-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p><strong className="text-white">?뺤궛 ?쒖옉 ?꾩뿉 諛섎뱶???쇱씠?붾? 癒쇱? ?깅줉</strong>?댁빞 ?⑸땲??</p>

          <div className="space-y-2">
            <p className="text-white font-medium">???쇱씠??媛쒕퀎 ?깅줉</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>?곗륫 ?곷떒 <strong className="text-white">+ ?쇱씠??異붽?</strong> 踰꾪듉 ?대┃</li>
              <li>?쇱씠?붾챸(?꾩닔), ?꾩씠??濡쒓렇?몄슜, 以묐났遺덇?), ?곕씫泥??낅젰</li>
              <li><strong className="text-white">???/strong> ?대┃ ??紐⑸줉??利됱떆 ?쒖떆</li>
            </ol>
            {warn('?꾩씠???쇱씠??ID)??以묐났 ?ъ슜 遺덇?. ?숈씪 ?꾩씠???낅젰 ???ㅻ쪟 硫붿떆吏媛 ?쒖떆?⑸땲??')}
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">???묒? ?쇨큵 ?깅줉</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>?곗륫 ?곷떒 <strong className="text-white">?묒? ?낅줈??/strong> 踰꾪듉 ?대┃</li>
              <li>?묒떇 ?ㅼ슫濡쒕뱶 ???대쫫쨌?꾩씠?붋룹뿰?쎌쿂 ?쒖꽌濡??묒꽦</li>
              <li>?묒꽦???뚯씪 ?좏깮 ???먮룞 ?쇨큵 ?깅줉</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">???쇱씠??寃??/p>
            <p className="text-xs ml-2">?곷떒 寃?됱갹???대쫫쨌?꾩씠?붾? ?낅젰?섎㈃ 利됱떆 ?꾪꽣留곷맗?덈떎. ?덈줈 ?깅줉???쇱씠?붾룄 利됱떆 寃??媛?ν빀?덈떎.</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">???ㅼ쨷 ?좏깮 ?쇨큵 泥섎━</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>紐⑸줉 ?곷떒 泥댄겕諛뺤뒪濡??꾩껜 ?좏깮 ?먮뒗 媛쒕퀎 泥댄겕諛뺤뒪濡??좏깮</li>
              <li>?좏깮 ??<strong className="text-white">?쇨큵 鍮꾪솢??/strong> / <strong className="text-rose-400">?쇨큵 ??젣</strong> 踰꾪듉 ?ъ슜</li>
            </ul>
            {warn('?꾩쟾 ??젣 ???대떦 ?쇱씠?붿쓽 ?뺤궛쨌?좎?湲됯툑쨌?꾨줈紐⑥뀡쨌愿由щ퉬 ?곗씠?곌? 紐⑤몢 ??젣?⑸땲??')}
          </div>

          <div className="space-y-1">
            <p className="text-white font-medium">???곹깭 遺꾨쪟</p>
            <div className="flex gap-3 ml-2 text-xs">
              <span className="flex items-center gap-1.5"><Badge className="bg-emerald-800 text-emerald-300 text-xs">?쒖꽦</Badge> ?뺤궛 ???/span>
              <span className="flex items-center gap-1.5"><Badge className="bg-slate-700 text-slate-400 text-xs">鍮꾪솢??/Badge> ?뺤궛 ?쒖쇅 (?곗씠??蹂댁〈)</span>
            </div>
          </div>
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       5. ?좎?湲됯툑 愿由?
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'advance-payments', title: '?좎?湲됯툑 愿由?, icon: Wallet,
      badge: '?좏깮 ?ㅼ젙', badgeColor: 'bg-orange-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>?쇱씠?붿뿉寃?誘몃━ 吏湲됲븳 湲덉븸???깅줉?섎㈃ ?뺤궛 ???먮룞?쇰줈 怨듭젣?⑸땲??</p>

          <div className="space-y-2">
            <p className="text-white font-medium">?깅줉</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>?곗륫 ?곷떒 <strong className="text-white">?좎?湲됯툑 ?깅줉</strong> 踰꾪듉 ?대┃</li>
              <li>?쇱씠??寃?????좏깮, 湲덉븸쨌吏湲?二쇨컙쨌硫붾え ?낅젰</li>
              <li>?????誘멸났???꾪솴???쒖떆</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">?뚯닔 ?깅줉</p>
            <p className="text-xs ml-2">?쇱씠?붽? ?좎?湲됯툑???먯껜 諛섑솚??寃쎌슦 <strong className="text-white">?뚯닔 ?깅줉</strong> 踰꾪듉?쇰줈 湲곕줉?⑸땲?? ?뺤궛?쒖뿉 硫붾え? ?④퍡 ?뚯닔 湲덉븸???쒖떆?⑸땲??</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">?곹깭 諛???젣</p>
            <div className="flex gap-3 ml-2 text-xs mb-2">
              <span className="flex items-center gap-1.5"><Badge className="bg-orange-800 text-orange-300 text-xs">誘멸났??/Badge> ?뺤궛 ???먮룞 李④컧 ???/span>
              <span className="flex items-center gap-1.5"><Badge className="bg-emerald-800 text-emerald-300 text-xs">怨듭젣?꾨즺</Badge> ?대? 諛섏쁺????ぉ</span>
            </div>
            {tip('怨듭젣 ?꾨즺????ぉ????젣 踰꾪듉?쇰줈 ??젣?????덉뒿?덈떎. ??젣?대룄 ?대? ?뺤젙???뺤궛?먮뒗 ?곹뼢???놁뒿?덈떎.')}
          </div>
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       6. ?꾨줈紐⑥뀡 ?ㅼ젙
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'promotions', title: '?꾨줈紐⑥뀡 ?ㅼ젙 (吏?ы봽濡쒕え??', icon: Gift,
      badge: '?좏깮 ?ㅼ젙', badgeColor: 'bg-rose-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>諛곕떖嫄댁닔 湲곕컲 ?몄꽱?곕툕(吏?ы봽濡쒕え??瑜??ㅼ젙?섎㈃ ?뺤궛 ???먮룞 ?곸슜?⑸땲?? ?뺤궛?쒖뿉??<strong className="text-white">吏?ы봽濡쒕え??/strong>?쇰줈 ?쒓린?⑸땲??</p>

          <div className="space-y-2">
            <p className="text-white font-medium">?꾨줈紐⑥뀡 醫낅쪟</p>
            <ul className="space-y-2 ml-2 text-xs">
              {[
                ['怨좎젙湲덉븸', '?ㅼ젙 議곌굔 異⑹” ???쇱젙 湲덉븸 吏湲?, '?? 100嫄??댁긽?대㈃ 50,000??吏湲?],
                ['援ш컙蹂?湲덉븸', '諛곕떖嫄댁닔 援ш컙???곕씪 ?ㅻⅨ 湲덉븸 ?곸슜', '?? 50~99嫄? 20,000?? 100嫄닳넁: 50,000??],
                ['嫄대떦 湲덉븸', '湲곗? 嫄댁닔 珥덇낵遺꾩뿉 ?④? ?곸슜', '?? 50嫄?珥덇낵 ??嫄대떦 500??],
              ].map(([t, d, ex]) => (
                <li key={t}>
                  <span className="text-white font-medium">{t}:</span> {d}
                  <br /><span className="text-slate-500">{ex}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">?곸슜 踰붿쐞 & 湲곌컙</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li><strong className="text-white">?꾩껜/媛쒕퀎 ?곸슜:</strong> 紐⑤뱺 ?쇱씠???먮뒗 吏???쇱씠?붿뿉寃??곸슜</li>
              <li><strong className="text-white">湲곌컙:</strong> ?꾩껜 湲곌컙 / ?뱀젙 二쇨컙 / 留덇컧?쇨퉴吏</li>
            </ul>
          </div>

          {tip('湲곗〈 ?꾨줈紐⑥뀡???대┃?섎㈃ ?곸꽭蹂닿린, ?쇱씠??異붽?, ?댁슜 ?섏젙??媛?ν빀?덈떎.')}

          {isBaemin && (
            <div className={`border rounded-lg p-3 ${platformBg}`}>
              <p className={`text-xs font-medium ${platformColor} mb-1`}>諛곕떖??誘쇱” ?뺤궛 怨듭떇?먯꽌????븷</p>
              <p className="text-xs text-slate-300">?멸툑?좉퀬湲덉븸 = 湲곕낯?뺤궛湲덉븸 + <strong className="text-white">吏?ы봽濡쒕え??/strong><br />理쒖쥌?뺤궛湲덉븸?먮룄 吏?ы봽濡쒕え?섏씠 媛?곕맗?덈떎.</p>
            </div>
          )}
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       7. 愿由щ퉬 ?ㅼ젙
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'settings', title: '愿由щ퉬 ?ㅼ젙', icon: Settings,
      badge: '?좏깮 ?ㅼ젙', badgeColor: 'bg-slate-600',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>肄쒓?由щ퉬, ?쇰컲愿由щ퉬, ?쒓컙?쒕낫?섎즺瑜??ㅼ젙?⑸땲?? ?뺤궛 怨꾩궛 ???먮룞?쇰줈 李④컧?⑸땲??</p>

          <div className="space-y-2">
            <p className="text-white font-medium">愿由щ퉬 醫낅쪟</p>
            <ul className="space-y-2 ml-2 text-xs">
              <li><span className="text-white font-medium">肄쒓?由щ퉬:</span> 嫄대떦 ?④? 횞 諛곕떖嫄댁닔<br /><span className="text-slate-500">?? 200??횞 150嫄?= 30,000??李④컧</span></li>
              <li><span className="text-white font-medium">?쇰컲愿由щ퉬:</span> 怨좎젙 湲덉븸 李④컧<br /><span className="text-slate-500">?? ??5,000???뺤븸 李④컧</span></li>
              {isBaemin && (
                <li><span className="text-white font-medium">?쒓컙?쒕낫?섎즺:</span> ?쇱씠?붾퀎 ?ㅼ젙 湲덉븸??理쒖쥌?뺤궛湲덉븸?먯꽌 李④컧<br /><span className="text-slate-500">諛곕떖??誘쇱” ?꾩슜 ??ぉ</span></li>
              )}
            </ul>
          </div>

          {tip('湲곗〈 愿由щ퉬 ??ぉ???대┃?섎㈃ ?쇱씠??異붽? 諛??댁슜 ?섏젙??媛?ν빀?덈떎.')}
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       8. ?뺤궛?뚯씪 ?깅줉
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'upload', title: '?뺤궛?뚯씪 ?깅줉', icon: Upload,
      badge: '?듭떖 湲곕뒫', badgeColor: 'bg-emerald-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>諛곕떖 ?뚮옯?쇱뿉??諛쏆? ?묒? ?뺤궛 ?뚯씪???낅줈?쒗븯???뺤궛湲덉븸???먮룞 怨꾩궛?⑸땲??</p>

          <div className="space-y-2">
            <p className="text-white font-medium">???뺤궛 二쇨컙 ?ㅼ젙</p>
            <p className="text-xs ml-2">?뺤궛??二쇨컙???쒖옉?쇨낵 醫낅즺?쇱쓣 ?ㅼ젙?⑸땲??</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">???묒? ?뚯씪 ?낅줈??/p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>?뚯씪 ?좏깮 ?곸뿭???묒? ?뚯씪(.xlsx, .xls)???쒕옒洹명븯嫄곕굹 ?대┃?섏뿬 ?좏깮</li>
              <li><strong className="text-white">2媛??댁긽???뚯씪</strong>???숈떆 ?낅줈?쒗븯硫??숈씪 ?쇱씠???곗씠?곕? <strong className="text-white">?먮룞 ?⑹궛</strong></li>
              <li>?뚯떛 ?꾨즺 ??<span className="text-emerald-400">???깃났</span> ?쒖떆 ?뺤씤</li>
            </ul>
            {warn('?뚯떛 ?ㅽ뙣 ???뚯씪 ?뺤떇???뺤씤?섏꽭?? 諛곕떖 ?뚮옯???쒖? ?묒? ?뺤떇留?吏?먮맗?덈떎.')}
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">???쇱씠???곌껐</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>?뚯씪???쇱씠???대쫫쨌?꾩씠?붿? ?깅줉???쇱씠?붾? ?먮룞 留ㅽ븨</li>
              <li>誘몃ℓ???쇱씠?붾뒗 ?쒕∼?ㅼ슫?먯꽌 吏곸젒 ?좏깮?섍굅??<strong className="text-white">?곌껐 ?덊븿</strong> 泥섎━</li>
              <li><strong className="text-white">?뺤궛 怨꾩궛?섍린</strong> 踰꾪듉 ?대┃</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">???뺤궛 寃곌낵 ?뺤씤 諛??뺤젙</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>?쇱씠?붾퀎 諛곕떖嫄댁닔쨌湲곕낯?뺤궛湲덉븸쨌蹂댄뿕猷뙿룹??ы봽濡쒕え?샕룰?由щ퉬쨌?뚮뱷?맞룹턀醫낆젙?곌툑???뺤씤</li>
              <li><strong className="text-white">?꾩떆???</strong> ?섏쨷???섏젙 媛?ν븳 ?곹깭濡????/li>
              <li><strong className="text-white">?뺤궛 ?뺤젙:</strong> ?뺤젙 ?꾨즺 (?좎?湲됯툑 ?먮룞 怨듭젣 泥섎━)</li>
            </ul>
          </div>

          {/* ?뚮옯?쇰퀎 怨꾩궛??*/}
          <div className={`border rounded-lg p-4 space-y-2 ${isBaemin ? 'bg-emerald-900/20 border-emerald-700/40' : 'bg-yellow-900/20 border-yellow-700/40'}`}>
            <p className={`text-xs font-semibold ${platformColor}`}>?뱪 {platformLabel} ?뺤궛 怨꾩궛 怨듭떇</p>
            {isBaemin ? (
              <div className="space-y-1 text-xs text-slate-300 font-mono">
                <p>湲곕낯?뺤궛湲덉븸 = 諛곕떖猷?+ 異붽?吏湲?諛곕?異붽?吏湲?</p>
                <p>?멸툑?좉퀬湲덉븸 = 湲곕낯?뺤궛湲덉븸 + 吏?ы봽濡쒕え??/p>
                <p>?뚮뱷??= ?멸툑?좉퀬湲덉븸 횞 {taxRateLabel} <span className="text-amber-300">(?먮떒???덉긽)</span></p>
                <p className="border-t border-slate-700 pt-1 mt-1">
                  理쒖쥌?뺤궛湲덉븸 = 湲곕낯?뺤궛湲덉븸<br />
                  <span className="ml-14">???쒓컙?쒕낫?섎즺<br /></span>
                  <span className="ml-14">??怨좎슜蹂댄뿕(洹쇰줈??<br /></span>
                  <span className="ml-14">???곗옱蹂댄뿕(洹쇰줈??<br /></span>
                  <span className="ml-14">+ 吏?ы봽濡쒕え??br /></span>
                  <span className="ml-14">??肄쒓?由щ퉬<br /></span>
                  <span className="ml-14">???뚮뱷??br /></span>
                  <span className="ml-14">???좎?湲됯툑 怨듭젣<br /></span>
                  <span className="ml-14">+ ?좎?湲됯툑 ?뚯닔</span>
                </p>
              </div>
            ) : (
              <div className="space-y-1 text-xs text-slate-300 font-mono">
                <p>湲곕낯?뺤궛湲덉븸 = 諛곕떖猷?+ 異붽?吏湲?/p>
                <p>?멸툑?좉퀬湲덉븸 = 湲곕낯?뺤궛湲덉븸</p>
                <p>?뚮뱷??= ?멸툑?좉퀬湲덉븸 횞 {taxRateLabel}</p>
                <p className="border-t border-slate-700 pt-1 mt-1">
                  理쒖쥌?뺤궛湲덉븸 = 湲곕낯?뺤궛湲덉븸<br />
                  <span className="ml-14">??怨좎슜蹂댄뿕(洹쇰줈??<br /></span>
                  <span className="ml-14">???곗옱蹂댄뿕(洹쇰줈??<br /></span>
                  <span className="ml-14">+ 吏?ы봽濡쒕え??br /></span>
                  <span className="ml-14">??肄쒓?由щ퉬<br /></span>
                  <span className="ml-14">???뚮뱷??br /></span>
                  <span className="ml-14">???좎?湲됯툑 怨듭젣<br /></span>
                  <span className="ml-14">+ ?좎?湲됯툑 ?뚯닔</span>
                </p>
              </div>
            )}
          </div>
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       9. ?뺤궛寃곌낵蹂닿린
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'result', title: '?뺤궛寃곌낵蹂닿린', icon: FileText,
      badge: '?듭떖 湲곕뒫', badgeColor: 'bg-emerald-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>?뺤젙 ?먮뒗 ?꾩떆??λ맂 ?뺤궛 寃곌낵瑜?議고쉶?섍퀬 愿由ы빀?덈떎.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">?뺤궛 紐⑸줉 & ?곸꽭</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>醫뚯륫 紐⑸줉?먯꽌 二쇨컙 ?좏깮 ???곗륫???쇱씠?붾퀎 ?곸꽭 ?쒖떆</li>
              <li className="flex items-center gap-2"><Badge className="bg-emerald-700 text-white text-xs">?뺤젙</Badge> 理쒖쥌 ?뺤젙???뺤궛</li>
              <li className="flex items-center gap-2"><Badge className="bg-amber-700 text-white text-xs">?꾩떆???/Badge> ?꾩쭅 ?뺤젙?섏? ?딆? ?뺤궛</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">?쇱씠?붾퀎 ?뺤궛??誘몃━蹂닿린</p>
            <p className="text-xs ml-2">?쇱씠?????대┃ ???뺤궛???앹뾽 (諛곕떖嫄댁닔, 湲곕낯?뺤궛湲덉븸, 吏?ы봽濡쒕え?? 怨듭젣 ??ぉ, 理쒖쥌?뺤궛湲덉븸)</p>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">?뺤궛 ??젣</p>
            {warn('??젣 ???곸꽭 ?곗씠?곗? ?④퍡 ?꾩쟾 ??젣?⑸땲?? ?곌껐???좎?湲됯툑??怨듭젣 泥섎━???먮룞 珥덇린??誘멸났???⑸땲??')}
          </div>
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       10. 怨듭??ы빆 ?앹꽦
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'notice', title: '怨듭??ы빆 ?앹꽦', icon: Megaphone,
      badge: '遺媛 湲곕뒫', badgeColor: 'bg-purple-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>?쒗뵆由우쓣 ?좏깮?섍퀬 ?댁슜???낅젰?섎㈃ 怨듭??ы빆 ?대?吏瑜??먮룞 ?앹꽦?⑸땲?? ?쇱씠?붿뿉寃?怨듭쑀??怨듭?臾몄쓣 ?먯돺寃?留뚮뱾 ???덉뒿?덈떎.</p>

          <div className="space-y-2">
            <p className="text-white font-medium">??怨듭??ы빆 ?묒꽦</p>
            <ol className="space-y-1.5 list-decimal list-inside ml-2 text-xs">
              <li>4媛吏 諛곌꼍 ?쒗뵆由?以??좏깮</li>
              <li>?뚯궗紐끒룸궇吏?湲곕낯 ?뺣낫) ?낅젰</li>
              <li>誘몃━蹂닿린 ?대?吏??<strong className="text-white">?쒕ぉ ?곸뿭 ?먮뒗 ?댁슜 ?곸뿭??吏곸젒 ?대┃</strong>?섏뿬 ?띿뒪???낅젰</li>
              <li>?섎떒 ?ㅽ????⑤꼸?먯꽌 湲???ш린쨌?됱긽쨌援듦린쨌?뺣젹쨌?꾩튂(?몃줈) 議곗젙</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">???ㅼ슫濡쒕뱶 & ???/p>
            <ul className="space-y-1 ml-2 text-xs">
              <li><strong className="text-white">?ㅼ슫濡쒕뱶 & ???/strong> 踰꾪듉 ?대┃ ???대?吏(.png) ?ㅼ슫濡쒕뱶 + 怨듭??ы빆 紐⑸줉???먮룞 ???/li>
              <li>??λ맂 怨듭????섎떒 紐⑸줉?먯꽌 誘몃━蹂닿린쨌?섏젙쨌??젣 媛??/li>
            </ul>
          </div>

          {tip('誘몃━蹂닿린 ?대?吏?먯꽌 ?쒕ぉ쨌?댁슜 ?곸뿭???대┃?섎㈃ 吏곸젒 ??댄븨?????덉뒿?덈떎. 蹂꾨룄 ?낅젰移몄씠 ?놁뼱???⑸땲??')}
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       11. ?쇱씠?붿궗?댄듃
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'rider-site', title: '?쇱씠?붿궗?댄듃', icon: Globe,
      badge: '?쇱씠??怨듭쑀', badgeColor: 'bg-teal-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>?쇱씠?붽? ?먯떊???뺤궛?쒕? ?뺤씤?????덈뒗 媛쒖씤 留곹겕瑜?愿由ы빀?덈떎. 媛?怨꾩젙???쇱씠???ъ씠??URL? <strong className="text-white">?낅┰??/strong>?쇰줈 ?댁쁺?⑸땲??</p>

          <div className="space-y-2">
            <p className="text-white font-medium">?뺤궛??留곹겕 諛쒗뻾</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>?쇱씠??紐⑸줉?먯꽌 怨듭쑀???쇱씠???좏깮</li>
              <li><strong className="text-white">留곹겕 ?앹꽦</strong> 踰꾪듉 ?대┃ ??媛쒖씤 怨좎쑀 URL ?앹꽦</li>
              <li>?앹꽦??留곹겕瑜?蹂듭궗?섏뿬 ?쇱씠?붿뿉寃??꾨떖 (移댁뭅?ㅽ넚, 臾몄옄 ??</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">?쇱씠???뺤궛???붾㈃ 援ъ꽦</p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>理쒖떊 ?뺤궛??留??꾩뿉 ?쒖떆</li>
              <li>湲곕낯?뺤궛湲덉븸(諛곕떖猷?+ {isBaemin ? '諛곕?異붽?吏湲? : '異붽?吏湲?}), 吏?ы봽濡쒕え??/li>
              <li>?좎?湲됯툑 怨듭젣 ?댁뿭 (硫붾え ?ы븿) ???대떦?먯뿉寃뚮쭔 ?쒖떆</li>
              <li>?뚯닔 ?깅줉 ?댁뿭 (硫붾え ?ы븿) ???대떦?먯뿉寃뚮쭔 ?쒖떆</li>
              <li>理쒖쥌?뺤궛湲덉븸</li>
            </ul>
          </div>

          {good('?쇱씠??留곹겕???좏겙 湲곕컲?쇰줈 ?덉쟾?섍쾶 蹂댄샇?섎ŉ, ?ㅻⅨ ?쇱씠?붿쓽 ?뺣낫??蹂????놁뒿?덈떎.')}
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       12. 臾몄쓽?섍린
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'inquiry', title: '臾몄쓽?섍린', icon: MessageSquare,
      badge: '怨좉컼 吏??, badgeColor: 'bg-blue-700',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <p>?쒖뒪???댁슜 以?沅곴툑???ы빆?대굹 遺덊렪???먯쓣 ?꾩껜愿由ъ옄?먭쾶 臾몄쓽?????덉뒿?덈떎. ?듬?? ?ㅼ떆媛꾩쑝濡??섏떊?⑸땲??</p>

          <div className="space-y-2">
            <p className="text-white font-medium">臾몄쓽 ?묒꽦</p>
            <ol className="space-y-1 list-decimal list-inside ml-2 text-xs">
              <li>?곗륫 ?곷떒 <strong className="text-white">??臾몄쓽</strong> 踰꾪듉 ?대┃</li>
              <li>?쒕ぉ怨??댁슜 ?낅젰 ??<strong className="text-white">?깅줉</strong> ?대┃</li>
              <li>紐⑸줉??臾몄쓽媛 異붽??섎ŉ <Badge className="bg-amber-800 text-amber-300 text-xs">?듬??湲?/Badge> ?곹깭濡??쒖떆</li>
            </ol>
          </div>

          <div className="space-y-2">
            <p className="text-white font-medium">?듬? ?뺤씤 & ?щЦ??/p>
            <ul className="space-y-1 ml-2 text-xs">
              <li>?꾩껜愿由ъ옄媛 ?듬??섎㈃ ?곹깭媛 <Badge className="bg-emerald-800 text-emerald-300 text-xs">?듬??꾨즺</Badge>濡?蹂寃쎈릺硫?<strong className="text-white">?ㅼ떆媛??뚮┝</strong></li>
              <li>臾몄쓽瑜??대┃?섎㈃ 梨꾪똿 ?뺥깭??????ㅻ젅???뺤씤 媛??/li>
              <li>?섎떒 ?낅젰李쎌뿉 異붽? 吏덈Ц???낅젰?섎㈃ <strong className="text-white">?щЦ??/strong>濡??깅줉??/li>
              <li>Enter ?ㅻ줈 ?꾩넚, Shift+Enter濡?以꾨컮轅?/li>
            </ul>
          </div>

          {tip('?듬? ?섏떊 ??蹂꾨룄 ?뚮┝? ?놁쑝誘濡? 二쇨린?곸쑝濡?臾몄쓽?섍린 ??쓣 ?뺤씤??二쇱꽭??')}
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       13. ?먮룞 濡쒓렇?꾩썐
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'security', title: '?먮룞 濡쒓렇?꾩썐 & 蹂댁븞', icon: LogOut,
      badge: '蹂댁븞', badgeColor: 'bg-red-800',
      content: (
        <div className="space-y-4 text-slate-300 text-sm leading-relaxed">
          <div className="space-y-3">
            {[
              ['釉뚮씪?곗?/???リ린', '李쎌쓣 ?ル뒗 利됱떆 ?쒕쾭 ?몄뀡??臾댄슚?붾맗?덈떎. ?ъ젒????濡쒓렇?몄씠 ?꾩슂?⑸땲??'],
              ['1?쒓컙 臾댄솢??, '留덉슦?ㅒ룻궎蹂대뱶 ?낅젰??1?쒓컙 ?놁쑝硫??먮룞 濡쒓렇?꾩썐?⑸땲?? 5遺????붾㈃??寃쎄퀬 ?뚮┝???쒖떆?⑸땲??'],
              ['?섎룞 濡쒓렇?꾩썐', '?ъ씠?쒕컮 ?섎떒 濡쒓렇?꾩썐 踰꾪듉???대┃?섎㈃ 利됱떆 濡쒓렇?꾩썐?⑸땲??'],
            ].map(([t, d]) => (
              <div key={t as string} className="border border-slate-700 rounded-lg p-3 space-y-1">
                <p className="text-white font-medium text-sm">{t as string}</p>
                <p className="text-xs text-slate-400">{d as string}</p>
              </div>
            ))}
          </div>

          {warn('以묒슂???묒뾽(?뺤궛 怨꾩궛, ?꾩떆????? ??諛섎뱶??????щ?瑜??뺤씤?섏꽭?? ?먮룞 濡쒓렇?꾩썐 ??誘몄????곗씠?곕뒗 ?좎떎?????덉뒿?덈떎.')}
        </div>
      ),
    },

    /* ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧
       14. ?먯＜ 臾삳뒗 吏덈Ц
    ?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧?먥븧 */
    {
      id: 'faq', title: '?먯＜ 臾삳뒗 吏덈Ц', icon: AlertTriangle,
      content: (
        <div className="space-y-3 text-slate-300 text-sm leading-relaxed">
          {[
            {
              q: '?뚯씪 ?낅줈?????쇱씠??留ㅽ븨?????섏뼱 ?덉뼱??',
              a: '?뚯씪???쇱씠???대쫫쨌?꾩씠?붽? ?깅줉???쇱씠???뺣낫? ?뺥솗???쇱튂?댁빞 ?먮룞 留ㅽ븨?⑸땲?? ?쇱씠??愿由???뿉???꾩씠?붾? ?깅줉?섎㈃ ?뺥솗?꾧? ?믪븘吏묐땲??',
            },
            {
              q: '?뺤궛 怨꾩궛 ??寃곌낵媛 蹂댁씠吏 ?딆븘??',
              a: '?쇱씠???곌껐 ?④퀎?먯꽌 紐⑤뱺 ?쇱씠?붾? "?곌껐 ?덊븿"?쇰줈 ?ㅼ젙?섎㈃ 寃곌낵媛 ?놁뒿?덈떎. 理쒖냼 1紐??댁긽 ?곌껐?댁＜?몄슂.',
            },
            {
              q: '?좎?湲됯툑???먮룞?쇰줈 李④컧?섏? ?딆븘??',
              a: '?뺤궛 ?뺤젙 ??"誘멸났?? ?곹깭???좎?湲됯툑留??먮룞 李④컧?⑸땲?? ?대? 怨듭젣 ?꾨즺????ぉ? ?ㅼ떆 李④컧?섏? ?딆뒿?덈떎.',
            },
            {
              q: '媛숈? ?쇱씠?붽? ?щ윭 ?뚯씪???덉뼱??',
              a: '?뚯씪???숈떆???낅줈?쒗븯硫??숈씪 ?쇱씠???곗씠?곕? ?먮룞 ?⑹궛?⑸땲?? ?⑹궛??諛곕떖嫄댁닔 湲곗??쇰줈 ?꾨줈紐⑥뀡???곸슜?⑸땲??',
            },
            {
              q: '?쇱씠?붾? ??젣?덈뒗???뺤궛 ?곗씠?곕룄 ??젣?섎굹??',
              a: '?꾩쟾 ??젣 ???뺤궛 ?곸꽭쨌?좎?湲됯툑쨌?꾨줈紐⑥뀡쨌愿由щ퉬 ?ㅼ젙??紐⑤몢 ??젣?⑸땲?? ?⑥닚 鍮꾪솢?깊솕???곗씠?곌? 蹂댁〈?⑸땲??',
            },
            {
              q: '?뺤궛 寃곌낵瑜???젣?덈뒗???좎?湲됯툑???',
              a: '?뺤궛 寃곌낵 ??젣 ???대떦 ?뺤궛?먯꽌 怨듭젣???좎?湲됯툑??怨듭젣 ?곹깭媛 "誘멸났??濡??먮룞 珥덇린?붾맗?덈떎.',
            },
            ...(isBaemin ? [{
              q: '?뚮뱷?멸? ?덉긽怨??ㅻⅤ寃?怨꾩궛?섏뼱??',
              a: `諛곕떖??誘쇱” ?뺤궛?먯꽌 ?뚮뱷?몃뒗 ?멸툑?좉퀬湲덉븸(湲곕낯?뺤궛湲덉븸+吏?ы봽濡쒕え?? 횞 ${taxRateLabel}瑜??먮떒???덉긽(?щ┝)?섏뿬 怨꾩궛?⑸땲??`,
            }] : []),
            {
              q: '釉뚮씪?곗?瑜??レ븯?ㅺ? ?ㅼ떆 ?대㈃ 濡쒓렇?몄씠 ?꾩슂?쒓???',
              a: '?? 蹂댁븞???꾪빐 釉뚮씪?곗?쨌??쓣 ?レ쑝硫??먮룞 濡쒓렇?꾩썐?⑸땲?? ?ъ젒?????꾩씠?붋룸퉬諛踰덊샇瑜??ㅼ떆 ?낅젰?댁빞 ?⑸땲??',
            },
          ].map(({ q, a }, i) => (
            <div key={i} className="border border-slate-700 rounded-lg p-4 space-y-2">
              <p className="text-white font-medium flex items-start gap-2">
                <span className="text-blue-400 shrink-0">Q.</span>{q}
              </p>
              <p className="text-slate-300 flex items-start gap-2 text-xs">
                <span className="text-emerald-400 shrink-0">A.</span>{a}
              </p>
            </div>
          ))}
        </div>
      ),
    },
  ]

  return (
    <>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .no-print { display: none !important; }
          .print-content { padding: 20px !important; }
          * { color-adjust: exact; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      <div className="p-4 md:p-6 space-y-6 print-content" ref={printRef}>
        {/* ?ㅻ뜑 */}
        <div className="flex items-start justify-between no-print">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-blue-400" />
              ?ъ슜??硫붾돱??
            </h2>
            <p className="text-slate-400 text-sm mt-1">
              {platformLabel} ?쇱씠???뺤궛 ?쒖뒪??쨌 愿由ъ옄 ?ъ슜 媛?대뱶
              <span className="ml-2 text-slate-600 text-xs">v2.0</span>
            </p>
          </div>
          <Button onClick={handleDownloadPDF} disabled={pdfLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            {pdfLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {pdfLoading ? 'PDF ?앹꽦 以?..' : 'PDF ???}
          </Button>
        </div>

        {/* 紐⑹감 */}
        <Card className="border-slate-700 bg-slate-900/50 no-print">
          <CardHeader className="pb-3">
            <CardTitle className="text-white text-sm font-medium">紐⑹감</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
              {sections.map((s, i) => {
                const Icon = s.icon
                return (
                  <a key={s.id} href={`#${s.id}`}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors text-sm">
                    <Icon className="h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <span className="text-xs text-slate-500 shrink-0">{i + 1}.</span>
                    <span className="truncate">{s.title}</span>
                  </a>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* ?뱀뀡蹂??댁슜 */}
        <div className="space-y-4">
          {sections.map((s, i) => {
            const Icon = s.icon
            return (
              <Card key={s.id} id={s.id} className="border-slate-700 bg-slate-900">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white text-base flex items-center gap-3">
                    <div className="bg-slate-800 rounded-lg p-1.5">
                      <Icon className="h-4 w-4 text-blue-400" />
                    </div>
                    <span className="text-slate-500 text-sm font-normal">{i + 1}.</span>
                    {s.title}
                    {s.badge && (
                      <Badge className={`${s.badgeColor} text-white text-xs ml-auto`}>{s.badge}</Badge>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>{s.content}</CardContent>
              </Card>
            )
          })}
        </div>

        {/* ?섎떒 PDF 踰꾪듉 */}
        <div className="flex justify-center pt-2 no-print">
          <Button onClick={handleDownloadPDF} disabled={pdfLoading} size="lg"
            className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2">
            {pdfLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Download className="h-5 w-5" />}
            {pdfLoading ? 'PDF ?앹꽦 以?..' : 'PDF濡???ν븯湲?}
          </Button>
        </div>
      </div>
    </>
  )
}