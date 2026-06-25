import { redirect } from 'next/navigation'

export default function SiteAdminPage() {
  redirect('/login?force=1')
}
