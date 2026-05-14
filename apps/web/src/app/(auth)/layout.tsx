/**
 * Layout dùng chung cho nhóm trang xác thực (đăng nhập, đăng ký).
 * Căn giữa nội dung trên nền gradient xanh, tạo giao diện đồng nhất cho auth flow.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      {children}
    </div>
  )
}
