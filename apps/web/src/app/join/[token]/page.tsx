'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { api, getApiErrorMessage } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Loader2, Home, Users, CheckCircle2, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

interface InvitationInfo {
  id: string
  token: string
  status: string
  family?: { id: string; name: string; description?: string | null; avatarUrl?: string | null }
  role?: string
  invitedBy?: { fullName?: string; email?: string }
  expiresAt?: string
}

type PageState = 'loading' | 'ready' | 'claiming' | 'success' | 'error'

const ROLE_LABEL: Record<string, string> = {
  FAMILY_MANAGER: 'Quản lý gia đình',
  DEPUTY_MEMBER: 'Phó thành viên',
  FAMILY_MEMBER: 'Thành viên',
}

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const router = useRouter()
  const { user } = useAuth()

  const [state, setState] = useState<PageState>('loading')
  const [invitation, setInvitation] = useState<InvitationInfo | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    if (!token) return
    api.get(`/invitations/${token}`)
      .then((r) => { setInvitation(r.data); setState('ready') })
      .catch((e) => {
        const msg = getApiErrorMessage(e, 'Lời mời không hợp lệ hoặc đã hết hạn')
        setErrorMsg(msg)
        setState('error')
      })
  }, [token])

  const claim = async () => {
    setState('claiming')
    try {
      await api.post(`/invitations/${token}/claim`)
      setState('success')
      toast.success('Đã gửi yêu cầu tham gia! Chờ quản lý gia đình phê duyệt.')
      setTimeout(() => router.push('/dashboard'), 2500)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Không thể gửi yêu cầu'))
      setState('ready')
    }
  }

  const redirectBase = `/join/${token}`

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-white to-pink-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Icon */}
        <div className="flex justify-center">
          <div className="w-20 h-20 rounded-2xl bg-white shadow-md flex items-center justify-center text-4xl">
            🏠
          </div>
        </div>

        {state === 'loading' && (
          <div className="text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin mx-auto text-rose-400" />
            <p className="text-slate-500 text-sm">Đang tải lời mời...</p>
          </div>
        )}

        {state === 'error' && (
          <div className="text-center space-y-3">
            <XCircle className="w-10 h-10 text-red-400 mx-auto" />
            <h1 className="text-xl font-bold text-slate-800">Lời mời không hợp lệ</h1>
            <p className="text-sm text-slate-500">{errorMsg}</p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/dashboard')}>
              Về trang chủ
            </Button>
          </div>
        )}

        {state === 'success' && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold text-slate-800">Đã gửi yêu cầu!</h1>
            <p className="text-sm text-slate-500">Chờ quản lý gia đình phê duyệt. Đang chuyển hướng...</p>
          </div>
        )}

        {(state === 'ready' || state === 'claiming') && invitation && (
          <>
            <div className="text-center space-y-1">
              <h1 className="text-2xl font-bold text-slate-800">Lời mời tham gia gia đình</h1>
              <p className="text-rose-500 font-semibold text-lg">{invitation.family?.name ?? '—'}</p>
              {(invitation.role) && (
                <span className="inline-block px-3 py-1 rounded-full bg-rose-100 text-rose-700 text-sm font-medium">
                  Vai trò: {ROLE_LABEL[invitation.role] ?? invitation.role}
                </span>
              )}
              {invitation.invitedBy && (
                <p className="text-xs text-slate-400 pt-1">
                  Được mời bởi: {invitation.invitedBy.fullName ?? invitation.invitedBy.email}
                </p>
              )}
            </div>

            {!user ? (
              /* Chưa đăng nhập */
              <div className="space-y-3">
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2 text-sm text-amber-700">
                  <span>ℹ️</span>
                  <span>Bạn cần có tài khoản để tham gia gia đình này.</span>
                </div>
                <Link href={`/register?invite=${token}`} className="block">
                  <Button className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white text-base font-semibold rounded-xl shadow-sm">
                    <Users className="w-4 h-4 mr-2" />
                    Đăng ký tài khoản mới
                  </Button>
                </Link>
                <Link href={`/login?redirect=${encodeURIComponent(redirectBase)}`} className="block">
                  <Button variant="outline" className="w-full h-12 text-base font-semibold rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50">
                    Đăng nhập tài khoản có sẵn
                  </Button>
                </Link>
              </div>
            ) : (
              /* Đã đăng nhập */
              <div className="space-y-3">
                <p className="text-sm text-slate-500 text-center">
                  Đăng nhập với <span className="font-medium text-slate-700">{user.email}</span>
                </p>
                <Button
                  className="w-full h-12 bg-rose-500 hover:bg-rose-600 text-white text-base font-semibold rounded-xl"
                  onClick={claim}
                  disabled={state === 'claiming'}
                >
                  {state === 'claiming' ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Home className="w-4 h-4 mr-2" />}
                  {state === 'claiming' ? 'Đang gửi yêu cầu...' : 'Tham gia gia đình'}
                </Button>
                <Button variant="ghost" className="w-full text-slate-400 text-sm" onClick={() => router.push('/dashboard')}>
                  Bỏ qua
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
