import { redirect } from 'next/navigation'

export default function SiteAdminLayout({ children }: { children: React.ReactNode }) {
  redirect('/login?force=1')
}
