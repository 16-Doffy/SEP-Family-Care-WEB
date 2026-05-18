/**
 * Layout dùng chung cho nhóm trang xác thực (đăng nhập, đăng ký).
 *
 * Bố cục split-screen:
 *  - Mobile: chỉ hiển thị form ở giữa với gradient nền
 *  - Desktop (lg+): bên trái là brand showcase, bên phải là form
 */
import { Heart, Calendar, Wallet, Siren, CheckSquare, MessageCircle } from 'lucide-react'

const features = [
  { icon: Calendar, label: 'Lịch gia đình', desc: 'Theo dõi sự kiện chung' },
  { icon: Wallet, label: 'Ví chung & cá nhân', desc: 'Quản lý chi tiêu minh bạch' },
  { icon: CheckSquare, label: 'Nhiệm vụ cho con', desc: 'Giao việc kèm phần thưởng' },
  { icon: Siren, label: 'SOS khẩn cấp', desc: 'Cảnh báo tức thì khi cần' },
  { icon: MessageCircle, label: 'Chat gia đình', desc: 'Trò chuyện realtime' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Cột trái: brand + showcase tính năng (ẩn trên mobile) */}
      <aside className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 text-white p-12 flex-col justify-between">
        {/* Decorative blobs */}
        <div aria-hidden className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-white/10 blur-3xl" />
        <div aria-hidden className="absolute bottom-0 right-0 w-96 h-96 rounded-full bg-pink-400/20 blur-3xl" />
        <div aria-hidden className="absolute top-1/3 right-10 w-40 h-40 rounded-full bg-yellow-300/10 blur-2xl" />

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <Heart className="w-6 h-6 fill-white text-white" />
          </div>
          <div>
            <p className="text-xl font-bold tracking-tight">Family Care</p>
            <p className="text-xs text-white/70">Kết nối, chăm sóc, sẻ chia</p>
          </div>
        </div>

        {/* Tiêu đề & feature list */}
        <div className="relative z-10 space-y-8">
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-3">
              Mọi điều quan trọng <br /> của gia đình bạn,<br />
              <span className="text-yellow-300">trên cùng một nơi.</span>
            </h1>
            <p className="text-white/80 text-base max-w-md">
              Nền tảng giúp các thành viên trong gia đình theo dõi hoạt động,
              chia sẻ tài chính và quan tâm nhau mỗi ngày.
            </p>
          </div>

          <ul className="space-y-3">
            {features.map(({ icon: Icon, label, desc }) => (
              <li key={label} className="flex items-start gap-3 group">
                <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center shrink-0 group-hover:bg-white/25 transition-colors">
                  <Icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-white/70">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <p className="relative z-10 text-xs text-white/60">
          © {new Date().getFullYear()} Family Care · Được xây dựng cho mọi gia đình Việt
        </p>
      </aside>

      {/* Cột phải: form đăng nhập / đăng ký */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-8 bg-gradient-to-br from-slate-50 to-blue-50 lg:bg-none lg:bg-white">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  )
}
