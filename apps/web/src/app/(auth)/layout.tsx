import { Heart, Calendar, Wallet, Siren, CheckSquare, MessageCircle, ShieldCheck } from 'lucide-react'
import Image from 'next/image'

const floaters = [
  { icon: Calendar, label: 'Lịch gia đình', desc: 'Đồng bộ sự kiện', pos: 'top-[15%] left-[8%]', anim: 'animate-float' },
  { icon: MessageCircle, label: 'Chat gia đình', desc: 'Realtime mọi lúc', pos: 'top-[45%] left-[4%]', anim: 'animate-float-delayed' },
  { icon: CheckSquare, label: 'Nhiệm vụ', desc: 'Giao việc & reward', pos: 'bottom-[20%] left-[10%]', anim: 'animate-float-slow' },
  { icon: Wallet, label: 'Quỹ nội bộ', desc: 'Chi tiêu minh bạch', pos: 'top-[18%] right-[8%]', anim: 'animate-float-delayed' },
  { icon: ShieldCheck, label: 'Bảo mật cao', desc: 'Dữ liệu an toàn', pos: 'top-[45%] right-[4%]', anim: 'animate-float-slow' },
  { icon: Siren, label: 'SOS khẩn cấp', desc: 'Cảnh báo tức thì', pos: 'bottom-[20%] right-[10%]', anim: 'animate-float' },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen w-full flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-indigo-950 via-purple-900 to-violet-950 overflow-hidden font-sans">
      
      {/* Decorative blurred blobs in background */}
      <div aria-hidden className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/30 rounded-full blur-[100px] pointer-events-none" />
      <div aria-hidden className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/30 rounded-full blur-[100px] pointer-events-none" />

      {/* Floating Image Bubbles */}
      <div className="absolute top-[20%] left-[25%] animate-float-slow hidden xl:block w-32 h-32 rounded-full border-[4px] border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)] overflow-hidden">
        <Image src="/images/fm1.png" alt="Happy Family" fill className="object-cover opacity-90 hover:opacity-100 transition-opacity" />
      </div>
      <div className="absolute bottom-[25%] right-[22%] animate-float hidden xl:block w-40 h-40 rounded-full border-[4px] border-white/20 shadow-[0_0_30px_rgba(255,255,255,0.2)] overflow-hidden">
        <Image src="/images/fm2.png" alt="Happy Family" fill className="object-cover opacity-90 hover:opacity-100 transition-opacity" />
      </div>

      {/* Floating Hearts */}
      <Heart className="absolute top-[10%] right-[30%] text-pink-400/50 w-8 h-8 animate-float-delayed hidden md:block" />
      <Heart className="absolute bottom-[15%] left-[20%] text-red-400/50 w-12 h-12 animate-float hidden md:block" />
      <Heart className="absolute top-[60%] left-[25%] text-pink-300/40 w-6 h-6 animate-float-slow hidden lg:block" />

      {/* Floating Chips (Hidden on small screens) */}
      {floaters.map((item, i) => (
        <div key={i} className={`hidden lg:flex absolute ${item.pos} ${item.anim} items-center gap-3 bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl rounded-full pr-6 pl-2 py-2 text-white`}>
          <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center shrink-0">
            <item.icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">{item.label}</p>
            <p className="text-[10px] text-white/60 leading-tight">{item.desc}</p>
          </div>
        </div>
      ))}

      {/* Top Header Logo */}
      <div className="absolute top-10 flex flex-col items-center pointer-events-none drop-shadow-md z-20">
        <div className="flex items-center gap-2 text-white/90">
          <Heart className="w-4 h-4 fill-white" />
          <span className="font-bold tracking-wider">Family Care</span>
        </div>
        <p className="text-xs text-white/50">Kết nối · Chăm sóc · Sẻ chia</p>
      </div>

      {/* Main Login Form Container */}
      <main className="relative z-10 w-full max-w-md px-4">
        {children}
      </main>

      {/* Bottom Footer */}
      <div className="absolute bottom-6 text-center text-xs text-white/40 pointer-events-none">
        © {new Date().getFullYear()} Family Care · Được xây dựng cho mọi gia đình Việt
      </div>
    </div>
  )
}
