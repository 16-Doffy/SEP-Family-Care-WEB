import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Wallet, CheckSquare, Bell, MapPin, Shield, Zap, Star, Check, ArrowRight, Users, Lock } from 'lucide-react'

const features = [
  { icon: Wallet, title: 'Ví gia đình thông minh', desc: 'Quản lý tài chính gia đình, chuyển allowance cho con, theo dõi chi tiêu minh bạch.', color: 'bg-blue-100 text-blue-600' },
  { icon: CheckSquare, title: 'Nhiệm vụ & Phần thưởng', desc: 'Giao việc cho con, gắn phần thưởng bằng tiền thật. Khuyến khích thói quen tốt.', color: 'bg-green-100 text-green-600' },
  { icon: Bell, title: 'Thông báo realtime', desc: 'Nhận thông báo tức thì khi có nhiệm vụ mới, phê duyệt, chuyển tiền qua WebSocket.', color: 'bg-yellow-100 text-yellow-600' },
  { icon: MapPin, title: 'Theo dõi vị trí', desc: 'Biết con đang ở đâu, tạo vùng an toàn, nhận cảnh báo khi con ra khỏi vùng.', color: 'bg-purple-100 text-purple-600' },
  { icon: Shield, title: 'SOS khẩn cấp', desc: 'Nút SOS tức thì trên app và đồng hồ thông minh. Thông báo ngay đến toàn gia đình.', color: 'bg-red-100 text-red-600' },
  { icon: Zap, title: 'AI Assistant', desc: 'Hỏi AI về chi tiêu, thống kê nhiệm vụ, nhắc lịch và gợi ý tiết kiệm thông minh.', color: 'bg-orange-100 text-orange-600' },
]

const plans = [
  {
    name: 'Free',
    price: '0đ',
    period: '/tháng',
    features: ['5 thành viên', 'Ví gia đình', '10 nhiệm vụ/tháng', 'Chat nhóm'],
    cta: 'Bắt đầu miễn phí',
    highlighted: false,
  },
  {
    name: 'Basic',
    price: '99.000đ',
    period: '/tháng',
    features: ['10 thành viên', 'Tất cả tính năng Free', 'Theo dõi vị trí', 'SOS khẩn cấp', 'Lịch gia đình'],
    cta: 'Dùng thử 14 ngày',
    highlighted: true,
  },
  {
    name: 'Premium',
    price: '199.000đ',
    period: '/tháng',
    features: ['Không giới hạn thành viên', 'Tất cả tính năng Basic', 'AI Assistant', 'Wearable device', 'Album ảnh không giới hạn', 'Báo cáo nâng cao'],
    cta: 'Nâng cấp ngay',
    highlighted: false,
  },
]

const stats = [
  { icon: Users, value: '10.000+', label: 'Gia đình tin dùng' },
  { icon: Star, value: '4.9/5', label: 'Đánh giá trung bình' },
  { icon: Lock, value: '100%', label: 'Bảo mật dữ liệu' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white font-sans">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b border-gray-100 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600">
              <span className="text-sm font-bold text-white">FC</span>
            </div>
            <span className="text-xl font-bold text-gray-900">Family Care</span>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/login">
              <Button variant="ghost" className="text-gray-600 hover:text-gray-900">Đăng nhập</Button>
            </Link>
            <Link href="/register">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">Dùng thử miễn phí</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-indigo-50 px-4 py-24">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(59,130,246,0.1),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-blue-100 px-4 py-1.5 text-sm font-medium text-blue-700">
            <Star className="h-4 w-4 fill-blue-500 text-blue-500" />
            Giải pháp quản lý gia đình số #1 Việt Nam
          </div>
          <h1 className="mb-6 text-5xl font-extrabold leading-tight tracking-tight text-gray-900 sm:text-6xl">
            Kết nối &amp; Quản lý<br />
            <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              Gia Đình Thông Minh
            </span>
          </h1>
          <p className="mx-auto mb-10 max-w-2xl text-xl leading-relaxed text-gray-500">
            Một nền tảng duy nhất cho tài chính, nhiệm vụ, vị trí, chat và an toàn gia đình.
            Bảo mật dữ liệu tuyệt đối với kiến trúc cô lập theo từng gia đình.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/register">
              <Button size="lg" className="gap-2 bg-blue-600 px-8 text-base hover:bg-blue-700">
                Bắt đầu miễn phí <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/login">
              <Button size="lg" variant="outline" className="px-8 text-base border-gray-300 text-gray-700 hover:bg-gray-50">
                Xem demo
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Demo: <span className="font-mono text-gray-500">parent@demo.com</span> / <span className="font-mono text-gray-500">demo1234</span>
          </p>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-gray-100 bg-white py-12 px-4">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {stats.map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex flex-col items-center gap-2 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
                  <Icon className="h-6 w-6 text-blue-600" />
                </div>
                <span className="text-3xl font-bold text-gray-900">{value}</span>
                <span className="text-sm text-gray-500">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-4 py-24">
        <div className="mx-auto max-w-7xl">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-4xl font-bold text-gray-900">Mọi thứ gia đình cần trong một app</h2>
            <p className="text-lg text-gray-500">Không cần cài nhiều app, không cần chia sẻ dữ liệu với bên thứ ba.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="group rounded-2xl border border-gray-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md">
                <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 text-base font-semibold text-gray-900">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-gray-50 px-4 py-24">
        <div className="mx-auto max-w-5xl">
          <div className="mb-14 text-center">
            <h2 className="mb-3 text-4xl font-bold text-gray-900">Bảng giá đơn giản, minh bạch</h2>
            <p className="text-lg text-gray-500">Không phí ẩn, hủy bất kỳ lúc nào.</p>
          </div>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl p-6 ${
                  plan.highlighted
                    ? 'border-2 border-blue-500 bg-white shadow-xl'
                    : 'border border-gray-200 bg-white shadow-sm'
                }`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                    Phổ biến nhất
                  </div>
                )}
                <div className="mb-6">
                  <p className="mb-2 text-sm font-semibold uppercase tracking-wider text-gray-400">{plan.name}</p>
                  <div className="flex items-end gap-1">
                    <span className="text-4xl font-extrabold text-gray-900">{plan.price}</span>
                    <span className="mb-1 text-sm text-gray-400">{plan.period}</span>
                  </div>
                </div>
                <ul className="mb-8 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register">
                  <Button
                    className={`w-full ${
                      plan.highlighted
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                    }`}
                    variant={plan.highlighted ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-20 text-center">
        <div className="mx-auto max-w-2xl">
          <h2 className="mb-4 text-4xl font-bold text-white">Bắt đầu ngay hôm nay</h2>
          <p className="mb-8 text-lg text-blue-100">Miễn phí hoàn toàn. Không cần thẻ tín dụng.</p>
          <Link href="/register">
            <Button size="lg" className="gap-2 bg-white px-10 text-base font-semibold text-blue-600 hover:bg-blue-50">
              Tạo tài khoản miễn phí <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-100 bg-white px-4 py-8 text-center text-sm text-gray-400">
        <p>© 2024 Family Care. Được xây dựng với ❤️ cho các gia đình Việt Nam.</p>
      </footer>

    </div>
  )
}
