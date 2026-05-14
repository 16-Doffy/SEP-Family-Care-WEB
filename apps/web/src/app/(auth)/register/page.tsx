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
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, ChevronRight, ChevronLeft, Users } from 'lucide-react'

/** Schema Zod cho bước 1: thông tin cá nhân của người dùng */
const step1Schema = z.object({
  displayName: z.string().min(2, 'Tên phải có ít nhất 2 ký tự'),
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu ít nhất 6 ký tự'),
})

/** Schema Zod cho bước 2: đặt tên gia đình mới (chỉ dùng khi không có invite code) */
const step2Schema = z.object({
  familyName: z.string().min(2, 'Tên gia đình phải có ít nhất 2 ký tự'),
})

type Step1 = z.infer<typeof step1Schema>
type Step2 = z.infer<typeof step2Schema>

/**
 * Form đăng ký thực tế. Được bọc trong Suspense vì sử dụng `useSearchParams`
 * (hook này yêu cầu Suspense boundary trong Next.js App Router).
 */
function RegisterForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  // Lấy invite code từ query string (?invite=...) nếu có
  const inviteCode = searchParams.get('invite')
  const { setAuth } = useAuth()
  const [step, setStep] = useState(1)
  // Lưu dữ liệu bước 1 để gộp vào request ở bước 2
  const [step1Data, setStep1Data] = useState<Step1 | null>(null)
  const [loading, setLoading] = useState(false)

  const form1 = useForm<Step1>({ resolver: zodResolver(step1Schema) })
  const form2 = useForm<Step2>({ resolver: zodResolver(step2Schema) })

  /**
   * Xử lý hoàn thành bước 1.
   * Nếu có invite code: đăng ký ngay 1 bước và tham gia gia đình.
   * Nếu không: chuyển sang bước 2 để nhập tên gia đình.
   * @param data - Thông tin cá nhân từ form bước 1
   */
  const onStep1 = async (data: Step1) => {
    if (inviteCode) {
      // Flow invite: đăng ký 1 bước, tham gia gia đình có sẵn
      setLoading(true)
      try {
        const { data: res } = await api.post('/auth/register', { ...data, inviteCode })
        setAuth({ ...res.user, familyMember: res.user.familyMember }, res.accessToken, res.refreshToken)
        toast.success('Chào mừng đến với gia đình! 🎉')
        router.push('/dashboard')
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Đăng ký thất bại'
        toast.error(msg)
      } finally {
        setLoading(false)
      }
    } else {
      // Flow thường: qua bước 2 để nhập tên gia đình
      setStep1Data(data)
      setStep(2)
    }
  }

  /**
   * Xử lý hoàn thành bước 2.
   * Gộp dữ liệu từ bước 1 và bước 2, gửi lên API tạo tài khoản + gia đình mới.
   * Role mặc định là PARENT vì người tạo gia đình luôn là phụ huynh.
   * @param data - Tên gia đình từ form bước 2
   */
  const onStep2 = async (data: Step2) => {
    if (!step1Data) return
    setLoading(true)
    try {
      const { data: res } = await api.post('/auth/register', {
        ...step1Data,
        familyName: data.familyName,
        role: 'PARENT',
      })
      setAuth({ ...res.user, familyMember: res.user.familyMember }, res.accessToken, res.refreshToken)
      toast.success('Chào mừng đến với Family Care! 🎉')
      router.push('/dashboard')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Đăng ký thất bại'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="w-full max-w-md shadow-xl">
      <CardHeader className="text-center">
        <div className="w-12 h-12 bg-blue-600 rounded-xl mx-auto mb-3 flex items-center justify-center">
          <span className="text-white font-bold text-xl">FC</span>
        </div>
        <CardTitle className="text-2xl">Tạo tài khoản</CardTitle>
        <CardDescription>
          {inviteCode ? (
            <span className="flex items-center justify-center gap-1 text-blue-600 font-medium">
              <Users className="w-4 h-4" />
              Bạn đang được mời tham gia gia đình
            </span>
          ) : (
            `Bước ${step}/2 – ${step === 1 ? 'Thông tin cá nhân' : 'Thông tin gia đình'}`
          )}
        </CardDescription>
        {!inviteCode && (
          <div className="flex gap-2 mt-2">
            <div className="h-1.5 flex-1 rounded-full bg-blue-500" />
            <div className={`h-1.5 flex-1 rounded-full ${step === 2 ? 'bg-blue-500' : 'bg-gray-200'}`} />
          </div>
        )}
      </CardHeader>
      <CardContent>
        {step === 1 ? (
          <form onSubmit={form1.handleSubmit(onStep1)} className="space-y-4">
            <div className="space-y-2">
              <Label>Họ và tên</Label>
              <Input placeholder="Nguyễn Văn An" {...form1.register('displayName')} />
              {form1.formState.errors.displayName && <p className="text-sm text-red-500">{form1.formState.errors.displayName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="email@example.com" {...form1.register('email')} />
              {form1.formState.errors.email && <p className="text-sm text-red-500">{form1.formState.errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Mật khẩu</Label>
              <Input type="password" placeholder="Tối thiểu 6 ký tự" {...form1.register('password')} />
              {form1.formState.errors.password && <p className="text-sm text-red-500">{form1.formState.errors.password.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {inviteCode ? 'Tham gia gia đình' : <span className="flex items-center justify-center gap-1">Tiếp theo <ChevronRight className="w-4 h-4" /></span>}
            </Button>
          </form>
        ) : (
          <form onSubmit={form2.handleSubmit(onStep2)} className="space-y-4">
            <div className="space-y-2">
              <Label>Tên gia đình</Label>
              <Input placeholder="Gia Đình Nguyễn" {...form2.register('familyName')} />
              {form2.formState.errors.familyName && <p className="text-sm text-red-500">{form2.formState.errors.familyName.message}</p>}
              <p className="text-xs text-muted-foreground">Ví dụ: "Gia Đình Trần", "Nhà Nguyễn Hữu"</p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)} className="flex-1">
                <ChevronLeft className="w-4 h-4 mr-1" /> Quay lại
              </Button>
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Tạo gia đình 🏠
              </Button>
            </div>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-4">
          Đã có tài khoản?{' '}
          <Link href="/login" className="text-blue-600 hover:underline font-medium">Đăng nhập</Link>
        </p>
      </CardContent>
    </Card>
  )
}

/**
 * Trang đăng ký — bọc RegisterForm trong Suspense để xử lý
 * việc đọc search params phía client một cách an toàn theo App Router.
 */
export default function RegisterPage() {
  return (
    <Suspense fallback={<Card className="w-full max-w-md shadow-xl"><CardContent className="p-8 text-center text-muted-foreground">Đang tải...</CardContent></Card>}>
      <RegisterForm />
    </Suspense>
  )
}
