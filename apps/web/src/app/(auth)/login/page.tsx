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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2 } from 'lucide-react'

/** Schema Zod kiểm tra đầu vào form đăng nhập */
const schema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(1, 'Vui lòng nhập mật khẩu'),
})

/** Kiểu dữ liệu form được suy ra từ schema Zod */
type FormData = z.infer<typeof schema>

/**
 * Trang đăng nhập.
 * Sau khi xác thực thành công, lưu thông tin người dùng và token vào context,
 * sau đó chuyển hướng đến trang dashboard.
 */
export default function LoginPage() {
  const router = useRouter()
  const { setAuth } = useAuth()
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  /**
   * Xử lý submit form đăng nhập.
   * Gọi API `/auth/login`, lưu auth state và chuyển đến `/dashboard`.
   * @param data - Dữ liệu form đã được validate (email, password)
   */
  const onSubmit = async (data: FormData) => {
    setLoading(true)
    try {
      const { data: res } = await api.post('/auth/login', data)
      // Lưu user, accessToken và refreshToken vào AuthContext và localStorage
      setAuth(res.user, res.accessToken, res.refreshToken)
      toast.success(`Chào mừng trở lại, ${res.user.displayName}!`)
      router.push('/dashboard')
    } catch (err: unknown) {
      // Lấy thông báo lỗi từ response API, nếu không có thì dùng thông báo mặc định
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Đăng nhập thất bại'
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
        <CardTitle className="text-2xl">Đăng nhập</CardTitle>
        <CardDescription>Chào mừng trở lại Family Care</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" placeholder="parent@demo.com" {...register('email')} />
            {errors.email && <p className="text-sm text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Mật khẩu</Label>
            <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
            {errors.password && <p className="text-sm text-red-500">{errors.password.message}</p>}
          </div>

          <div className="bg-blue-50 rounded-lg p-3 text-sm text-blue-700">
            <p className="font-medium mb-1">Tài khoản demo:</p>
            <p>Parent: parent@demo.com</p>
            <p>Child: minh@demo.com</p>
            <p className="text-blue-500">Mật khẩu: demo1234</p>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Đăng nhập
          </Button>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Chưa có tài khoản?{' '}
          <Link href="/register" className="text-blue-600 hover:underline font-medium">
            Đăng ký miễn phí
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
