'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Users, Pencil, Loader2, RefreshCw, Eye } from 'lucide-react'
import { toast } from 'sonner'

interface MemberProfile {
  id: string
  username: string | null
  company_name: string | null
  business_number: string | null
  manager_name: string | null
  phone: string | null
  email: string | null
}

export default function SiteAdminPage() {
  const [members, setMembers] = useState<MemberProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [detailOpen, setDetailOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [editing, setEditing] = useState<MemberProfile | null>(null)
  const [form, setForm] = useState({
    username: '',
    company_name: '',
    business_number: '',
    manager_name: '',
    phone: '',
    email: '',
  })
  const [saving, setSaving] = useState(false)

  const fetchMembers = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/profiles')
      const data = await res.json()
      if (!res.ok) {
        toast.error('회원 목록 조회 실패: ' + (data?.error ?? res.statusText))
        setMembers([])
      } else {
        setMembers((Array.isArray(data) ? data : []) as MemberProfile[])
      }
    } catch (e) {
      toast.error('회원 목록 조회 실패')
      setMembers([])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchMembers()
  }, [])

  const openDetail = (m: MemberProfile) => {
    setEditing(m)
    setDetailOpen(true)
  }

  const openEdit = (m: MemberProfile) => {
    setEditing(m)
    setForm({
      username: m.username ?? '',
      company_name: m.company_name ?? '',
      business_number: m.business_number ?? '',
      manager_name: m.manager_name ?? '',
      phone: m.phone ?? '',
      email: m.email ?? '',
    })
    setDetailOpen(false)
    setEditOpen(true)
  }

  const handleSave = async () => {
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/profiles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          username: form.username,
          company_name: form.company_name,
          business_number: form.business_number,
          manager_name: form.manager_name,
          phone: form.phone,
          email: form.email,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error('저장 실패: ' + (data?.error ?? res.statusText))
        return
      }
      toast.success('저장되었습니다.')
      setEditOpen(false)
      setEditing(null)
      fetchMembers()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">회원목록</h2>
          <p className="text-slate-400 text-sm mt-1">라이더 정산 시스템에 가입한 전체 회원의 목록 및 정보를 확인할 수 있습니다</p>
        </div>
        <Button variant="outline" onClick={fetchMembers} disabled={loading} className="border-slate-600 text-slate-300">
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          새로고침
        </Button>
      </div>

      <Card className="border-slate-700 bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Users className="h-5 w-5" />
            회원정보 ({members.length}명)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 flex justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
          ) : members.length === 0 ? (
            <div className="py-12 text-center text-slate-500">등록된 회원이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">아이디</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">회사명</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">사업자번호</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">담당자</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">연락처</th>
                    <th className="text-left py-3 px-4 text-slate-400 font-medium">이메일</th>
                    <th className="w-20 py-3 px-4"></th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => (
                    <tr key={m.id} className="border-b border-slate-800 hover:bg-slate-800/30 cursor-pointer" onClick={() => openDetail(m)}>
                      <td className="py-3 px-4 text-white font-medium">{m.username ?? '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{m.company_name ?? '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{m.business_number ?? '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{m.manager_name ?? '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{m.phone ?? '-'}</td>
                      <td className="py-3 px-4 text-slate-300">{m.email ?? '-'}</td>
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="sm" onClick={() => openDetail(m)} className="text-slate-400 hover:text-white hover:bg-slate-700" title="상세보기">
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openEdit(m)} className="text-slate-400 hover:text-white hover:bg-slate-700" title="수정">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 회원정보 상세 다이얼로그 */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>회원정보 상세</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">아이디</p>
                  <p className="text-white font-medium">{editing.username ?? '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">회사명</p>
                  <p className="text-white">{editing.company_name ?? '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">사업자등록번호</p>
                  <p className="text-white">{editing.business_number ?? '-'}</p>
                </div>
                <div>
                  <p className="text-slate-500 text-xs mb-0.5">담당자</p>
                  <p className="text-white">{editing.manager_name ?? '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs mb-0.5">연락처</p>
                  <p className="text-white">{editing.phone ?? '-'}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-slate-500 text-xs mb-0.5">이메일</p>
                  <p className="text-white">{editing.email ?? '-'}</p>
                </div>
              </div>
              <DialogFooter className="border-t border-slate-700 pt-4">
                <Button variant="outline" onClick={() => setDetailOpen(false)} className="border-slate-600 text-slate-300">
                  닫기
                </Button>
                <Button onClick={() => editing && openEdit(editing)} className="bg-blue-600 hover:bg-blue-700">
                  <Pencil className="h-4 w-4 mr-2" />
                  수정
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 수정 다이얼로그 */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>회원 정보 수정</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-slate-300">아이디</Label>
              <Input
                value={form.username}
                onChange={(e) => setForm((p) => ({ ...p, username: e.target.value }))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">회사명</Label>
              <Input
                value={form.company_name}
                onChange={(e) => setForm((p) => ({ ...p, company_name: e.target.value }))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">사업자등록번호</Label>
              <Input
                value={form.business_number}
                onChange={(e) => setForm((p) => ({ ...p, business_number: e.target.value }))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">담당자</Label>
              <Input
                value={form.manager_name}
                onChange={(e) => setForm((p) => ({ ...p, manager_name: e.target.value }))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">연락처</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-slate-300">이메일</Label>
              <Input
                type="email"
                value={form.email}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className="bg-slate-800 border-slate-600"
              />
            </div>
          </div>
          <DialogFooter className="border-t border-slate-700 pt-4">
            <Button variant="outline" onClick={() => setEditOpen(false)} className="border-slate-600 text-slate-300">
              취소
            </Button>
            <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : '저장'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
