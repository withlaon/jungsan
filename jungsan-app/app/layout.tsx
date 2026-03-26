import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import { Toaster } from '@/components/ui/sonner'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: '라이더 정산 시스템',
  description: '라이더 주간 정산 관리 시스템',
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
