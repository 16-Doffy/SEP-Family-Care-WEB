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
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Heart, Mail, Lock, Eye, EyeOff, Sparkles } from 'lucide-react'

/** Schema Zod kiểm tra đầu vào form đăng nhập */
const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

type FormData = z.infer<typeof schema>

const demoAccounts = [
  { role: 'Phụ huynh', email: 'parent@demo.com', color: 'bg-blue-100 text-blue-700' },
  { role: 'Con', email: 'minh@demo.com', color: 'bg-emerald-100 text-emerald-700' },
]

export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: res } = await api.post('/auth/login', data)
      setAuth(res.user, res.accessToken, res.refreshToken)
      toast.success(`Chào mừng trở lại, ${res.user.displayName}!`)
      router.push(res.user.role === 'SUPER_ADMIN' ? '/admin' : '/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Đăng nhập thất bại'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  /** Điền nhanh tài khoản demo vào form (chỉ trong môi trường dev/demo) */
  const fillDemo = (email: string) => {
    setValue('email', email)
    setValue('password', 'demo1234')
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

      {/* Tài khoản demo */}
      <div className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
          <Sparkles className="w-4 h-4" />
          Dùng thử nhanh với tài khoản demo
        </div>
        <div className="grid grid-cols-2 gap-2">
          {demoAccounts.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => fillDemo(acc.email)}
              className="text-left rounded-xl bg-white border border-blue-100 hover:border-blue-300 hover:shadow-sm p-3 transition-all"
            >
              <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${acc.color}`}>
                {acc.role}
              </span>
              <p className="text-xs text-slate-600 mt-1.5 truncate">{acc.email}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Mật khẩu: <span className="font-mono text-slate-700">demo1234</span></p>
      </div>

      <p className="text-center text-sm text-slate-600">
        Chưa có tài khoản?{' '}
        <Link href="/register" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline">
          Đăng ký miễn phí
        </Link>
      </p>
    </div>
  )
}
