import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '정산타임',
  description:
    '배달 라이더 전용 정산 시스템입니다. 배달 건별 내역과 주간 정산을 한곳에서 기록·관리할 수 있습니다.',
  verification: {
    google: 'oDFX7OQ4liPpHpxOYZAzdlayNIDbL53xA1MVLOlpJz4',
    other: {
      'naver-site-verification': '14acba13d1a425e0e37482e9d4064d2285fa69ee',
    },
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={geist.className}>
        {children}
        <Toaster richColors position="top-right" duration={2000} />
      </body>
    </html>
  )
}
