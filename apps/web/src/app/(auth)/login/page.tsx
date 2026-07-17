'use client'
import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
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
import { Loader2, Heart, Mail, Lock, Eye, EyeOff, Shield, ArrowRight } from 'lucide-react'

const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

type FormData = z.infer<typeof schema>

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirect')
  const { setAuth } = useAuth()
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: res } = await api.post('/auth/login', data)
      const user = mapTeamUser(res.user)
      setAuth(user, res.accessToken, res.refreshToken)
      toast.success(`Chào mừng trở lại, ${user.displayName}!`)
      router.push(redirectTo ?? (user.role === 'SYSTEM_ADMIN' ? '/admin' : '/dashboard'))
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Đăng nhập thất bại'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white/20 backdrop-blur-2xl border border-white/30 shadow-[0_8px_30px_rgb(0,0,0,0.12)] rounded-3xl p-8 sm:p-10 space-y-8 relative z-10">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white shadow-sm drop-shadow-md">
          <Shield className="w-3.5 h-3.5" />
          CỔNG QUẢN TRỊ
        </div>
        <h2 className="text-3xl font-extrabold tracking-tight text-white drop-shadow-lg">Chào mừng trở lại 👋</h2>
        <p className="text-white/90 font-medium text-sm drop-shadow-md">Đăng nhập để tiếp tục quản lý gia đình của bạn.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="email" className="text-white/90 font-medium drop-shadow-md">Email</Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
            <Input 
              id="email" 
              type="email" 
              autoComplete="email" 
              placeholder="admin@familycare.vn" 
              className="pl-10 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[transition:background-color_5000s_ease-in-out_0s]" 
              {...register('email')} 
            />
          </div>
          {errors.email && <p className="text-sm text-red-300 drop-shadow-md">{errors.email.message}</p>}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password" className="text-white/90 font-medium drop-shadow-md">Mật khẩu</Label>
            <span className="text-xs text-white/80 hover:text-white cursor-pointer transition-colors drop-shadow-md">Quên mật khẩu?</span>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/60 pointer-events-none" />
            <Input
              id="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="••••••••••••"
              className="pl-10 pr-10 h-12 bg-white/10 border-white/20 text-white placeholder:text-white/50 focus-visible:ring-white/30 [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:[-webkit-text-fill-color:white] [&:-webkit-autofill]:[transition:background-color_5000s_ease-in-out_0s]"
              {...register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/60 hover:text-white/90 transition-colors"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {errors.password && <p className="text-sm text-red-300 drop-shadow-md">{errors.password.message}</p>}
        </div>

        <div className="flex items-center gap-2">
          <input type="checkbox" id="remember" className="rounded border-white/30 bg-white/10 text-purple-500 focus:ring-purple-400" />
          <label htmlFor="remember" className="text-sm text-white/90 font-medium drop-shadow-md">Ghi nhớ đăng nhập</label>
        </div>

        <Button
          type="submit"
          className="w-full h-12 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 text-white shadow-lg border-0"
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Đăng nhập
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </form>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
