'use client'

import { Loader2 } from 'lucide-react'
import { Sidebar } from '@/components/layout/Sidebar'
import { InactivityGuard } from '@/components/layout/InactivityGuard'
import {
  SubscriptionAccessProvider,
  useSubscriptionAccess,
} from '@/components/layout/SubscriptionAccessProvider'

function AdminMain({ children }: { children: React.ReactNode }) {
  const { merchantGatePending } = useSubscriptionAccess()
  if (merchantGatePending) {
    return (
      <main className="flex-1 overflow-auto pt-14 md:pt-0 flex items-center justify-center min-h-[50vh]">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <Loader2 className="h-10 w-10 animate-spin" />
          <p className="text-sm">
            {'\uAD6C\uB3C5 \uC0C1\uD0DC\uB97C \uD655\uC778 \uC911...'}
          </p>
        </div>
      </main>
    )
  }
  return (
    <main className="flex-1 overflow-auto pt-14 md:pt-0">
      {children}
    </main>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SubscriptionAccessProvider>
      <div className="flex min-h-screen bg-slate-950">
        <InactivityGuard />
        <Sidebar />
        <AdminMain>{children}</AdminMain>
      </div>
    </SubscriptionAccessProvider>
  )
}
