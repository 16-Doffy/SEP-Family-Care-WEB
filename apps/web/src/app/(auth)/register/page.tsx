/**
 * Trang đăng ký tài khoản mới cho Family Care.
 * Hỗ trợ 2 luồng: đăng ký thông thường (tạo gia đình mới, 2 bước)
 * hoặc đăng ký qua link mời (tham gia gia đình có sẵn, 1 bước).
 */
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
import {
  Loader2, ChevronRight, ChevronLeft, Users, Heart,
  User, Mail, Lock, Home, Eye, EyeOff, Check,
} from 'lucide-react'

// Quy tắc mật khẩu khớp với chính sách của API team:
// tối thiểu 8 ký tự, gồm chữ hoa, chữ thường, số và ký tự đặc biệt.
// Kiểm tra ngay ở bước 1 để báo lỗi tại chỗ nhập, không để lọt sang bước 2.
const step1Schema = z.object({
  displayName: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu cần ít nhất 1 chữ hoa')
    .regex(/[a-z]/, 'Mật khẩu cần ít nhất 1 chữ thường')
    .regex(/[0-9]/, 'Mật khẩu cần ít nhất 1 chữ số')
    .regex(/[^A-Za-z0-9]/, 'Mật khẩu cần ít nhất 1 ký tự đặc biệt'),
})

const step2Schema = z.object({
  familyName: z.string().min(2, 'Tên gia đình phải có ít nhất 2 ký tự'),
})

type Step1 = z.infer<typeof step1Schema>
type Step2 = z.infer<typeof step2Schema>

function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const inviteCode = searchParams.get('invite')
  const { setAuth } = useAuth()
  const [step, setStep] = useState(1)
  const [step1Data, setStep1Data] = useState<Step1 | null>(null)
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) })
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema) })

  const onStep1 = async (data: Step1) => {
    if (inviteCode) {
      // Luồng tham gia qua lời mời: đăng ký tài khoản rồi chấp nhận lời mời theo token.
      setLoading(true)
      try {
        const { data: res } = await api.post('/auth/register', {
          email: data.email,
          password: data.password,
          fullName: data.displayName,
        })
        setAuth(mapTeamUser(res.user), res.accessToken, res.refreshToken)
        await api.post(`/invitations/${inviteCode}/claim`)
        toast.success('Chào mừng đến với gia đình! 🎉')
        router.push('/dashboard')
      } catch (err: unknown) {
        toast.error(getApiErrorMessage(err, 'Đăng ký thất bại'))
      } finally {
        setLoading(false)
      }
    } else {
      setStep1Data(data)
      setStep(2)
    }
  }

  const onStep2 = async (data: Step2) => {
    if (!step1Data) return
    setLoading(true)
    try {
      // 1) Đăng ký tài khoản (mặc định vai trò FAMILY_MANAGER).
      const { data: res } = await api.post('/auth/register', {
        email: step1Data.email,
        password: step1Data.password,
        fullName: step1Data.displayName,
      })
      setAuth(mapTeamUser(res.user), res.accessToken, res.refreshToken)
      // 2) Tạo gia đình — người tạo trở thành MANAGER.
      await api.post('/families', { name: data.familyName })
      toast.success('Đã tạo gia đình! Bước tiếp theo: chọn gói sử dụng 🎉')
      // Onboarding bước 2 → chuyển qua chọn gói trước khi vào app chính
      router.push('/onboarding')
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Đăng ký thất bại'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Logo nhỏ — chỉ trên mobile */}
      <div className="lg:hidden flex items-center gap-2 justify-center">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-md">
          <Heart className="w-5 h-5 fill-white text-white" />
        </div>
        <span className="font-bold text-lg">Family Care</span>
      </div>

      {/* Header */}
      <div className="space-y-2">
        {inviteCode ? (
          <>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              <Users className="w-3.5 h-3.5" /> Lời mời gia đình
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Tham gia gia đình 🎉</h2>
            <p className="text-slate-500">Bạn được mời tham gia. Hoàn thành thông tin để bắt đầu.</p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Tạo tài khoản mới</h2>
            <p className="text-slate-500">Bắt đầu hành trình gắn kết gia đình của bạn ngay hôm nay.</p>
          </>
        )}
      </div>

      {/* Stepper cho flow 2 bước (ẩn nếu có invite code) */}
      {!inviteCode && (
        <div className="flex items-center gap-3">
          <StepBadge index={1} label="Cá nhân" active={step === 1} done={step > 1} />
          <div className={`flex-1 h-0.5 rounded-full transition-colors ${step > 1 ? 'bg-blue-500' : 'bg-slate-200'}`} />
          <StepBadge index={2} label="Gia đình" active={step === 2} done={false} />
        </div>
      )}

      {step === 1 ? (
        <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-5">
          <FieldWithIcon icon={User} label="Họ và tên">
            <Input placeholder="Nguyễn Văn An" className="pl-10 h-11" {...form1.register('displayName')} />
            {form1.formState.errors.displayName && (
              <p className="text-sm text-red-500 mt-1.5">{form1.formState.errors.displayName.message}</p>
            )}
          </FieldWithIcon>

          <FieldWithIcon icon={Mail} label="Email">
            <Input type="email" placeholder="email@example.com" className="pl-10 h-11" {...form1.register('email')} />
            {form1.formState.errors.email && (
              <p className="text-sm text-red-500 mt-1.5">{form1.formState.errors.email.message}</p>
            )}
          </FieldWithIcon>

          <FieldWithIcon icon={Lock} label="Mật khẩu">
            <Input
              type={showPassword ? 'text' : 'password'}
              placeholder="≥8 ký tự, có hoa, thường, số, ký tự đặc biệt"
              className="pl-10 pr-10 h-11"
              {...form1.register('password')}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            {form1.formState.errors.password && (
              <p className="text-sm text-red-500 mt-1.5">{form1.formState.errors.password.message}</p>
            )}
          </FieldWithIcon>

          <Button
            type="submit"
            className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20"
            disabled={loading}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            {inviteCode ? (
              'Tham gia gia đình'
            ) : (
              <span className="flex items-center justify-center gap-1">
                Tiếp theo <ChevronRight className="w-4 h-4" />
              </span>
            )}
          </Button>
        </form>
      ) : (
        <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-5">
          <FieldWithIcon icon={Home} label="Tên gia đình">
            <Input placeholder="Gia Đình Nguyễn" className="pl-10 h-11" {...form2.register('familyName')} />
            {form2.formState.errors.familyName && (
              <p className="text-sm text-red-500 mt-1.5">{form2.formState.errors.familyName.message}</p>
            )}
            <p className="text-xs text-slate-500 mt-1.5">Ví dụ: &quot;Gia Đình Trần&quot;, &quot;Nhà Nguyễn Hữu&quot;</p>
          </FieldWithIcon>

          {/* Tóm tắt nhanh thông tin bước 1 */}
          {step1Data && (
            <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 mb-1">Thông tin của bạn</p>
              <p className="font-medium text-slate-800">{step1Data.displayName}</p>
              <p className="text-slate-600 text-xs">{step1Data.email}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1 h-11">
              <ChevronLeft className="w-4 h-4 mr-1" /> Quay lại
            </Button>
            <Button
              type="submit"
              className="flex-1 h-11 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-md shadow-blue-500/20"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Tạo gia đình
            </Button>
          </div>
        </form>
      )}

      <p className="text-center text-sm text-slate-600">
        Đã có tài khoản?{' '}
        <Link href="/login" className="text-blue-600 hover:text-blue-700 font-semibold hover:underline">
          Đăng nhập
        </Link>
      </p>
    </div>
  )
}

/** Một bước trong stepper — hiển thị số thứ tự hoặc dấu check khi đã hoàn thành */
function StepBadge({ index, label, active, done }: { index: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
          done
            ? 'bg-emerald-500 text-white'
            : active
              ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30'
              : 'bg-slate-100 text-slate-400'
        }`}
      >
        {done ? <Check className="w-4 h-4" /> : index}
      </div>
      <span className={`text-sm font-medium ${active || done ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
    </div>
  )
}

/**
 * Field wrapper có icon prefix bên trái.
 * Children có thể là Input + bất kỳ adornment nào (ví dụ nút show password)
 * vì wrapper có `position: relative`.
 */
function FieldWithIcon({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-2">
      <Label className="text-slate-700">{label}</Label>
      <div className="relative">
        <Icon className="absolute left-3 top-[22px] -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none z-10" />
        {children}
      </div>
    </div>
  )
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="text-center text-slate-500 py-12">
          <Loader2 className="w-6 h-6 animate-spin mx-auto" />
        </div>
      }
    >
      <RegisterForm />
    </Suspense>
  )
}
