/**
 * Trang đăng nhập của ứng dụng Family Care.
 * Xác thực người dùng bằng email/mật khẩu và lưu token vào AuthContext.
 */
'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { api, getApiErrorMessage } from '@/lib/api'
import { mapTeamUser } from '@/store/auth.store'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Heart, Mail, Lock, Eye, EyeOff } from 'lucide-react'

/** Schema Zod kiểm tra đầu vào form đăng nhập */
const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      // Envelope đã được bóc ở api.ts → res = { user, accessToken, refreshToken }
      const { data: res } = await api.post('/auth/login', data)
      const user = mapTeamUser(res.user)
      setAuth(user, res.accessToken, res.refreshToken)
      toast.success(`Chào mừng trở lại, ${user.displayName}!`)
      router.push(user.role === 'SYSTEM_ADMIN' ? '/admin' : '/dashboard')
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Đăng nhập thất bại'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Logo nhỏ chỉ hiện trên mobile (desktop có panel trái rồi) */}
      <div className="lg:hidden flex items-center gap-2 justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
          <Heart className="w-5 h-5 fill-white text-white" />
        </div>
        <span className="font-bold text-lg">Family Care</span>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-3xl font-bold tracking-tight text-slate-900">Chào mừng trở lại 👋</h2>
        <p className="text-slate-500">Đăng nhập để tiếp tục chăm sóc gia đình của bạn.</p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-slate-700">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="ban@example.com"
              className="pl-10 h-11"
              {...register('email')}
            />
          </div>
          {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-slate-700">Mật khẩu</Label>
            <span className="text-xs text-slate-400">Quên mật khẩu?</span>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pl-10 pr-10 h-11"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
        </div>

        <Button
          type="submit"
          className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Đăng nhập
        </Button>
      </form>

      <p className="text-center text-sm text-slate-600">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline">
          Đăng ký miễn phí
        </Link>
      </p>
    </div>
  )
}
