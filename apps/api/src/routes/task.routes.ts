/**
 * @module task.routes
 * @description Định nghĩa các route HTTP cho chức năng quản lý nhiệm vụ (task).
 *
 * Tất cả các route đều yêu cầu:
 *  - `authenticate`: người dùng phải đăng nhập (JWT hợp lệ).
 *  - `requireFamily`: người dùng phải thuộc một gia đình.
 *
 * Các thao tác quản lý (tạo, giao việc, duyệt, từ chối, huỷ) chỉ dành cho
 * PARENT hoặc SUPER_ADMIN. Thành viên thông thường chỉ có thể xem, bắt đầu
 * và nộp bằng chứng cho nhiệm vụ của mình.
 *
 * Upload ảnh bằng chứng sử dụng multer với các giới hạn:
 *  - Kích thước tối đa: 10MB.
 *  - Định dạng cho phép: jpeg, jpg, png, gif, webp.
 *  - File được lưu tại thư mục `uploads/` trong thư mục gốc của server.
 *
 * Prefix được mount bởi app chính (thường là `/api/tasks`).
 */

import { Router, type Router as ExpressRouter } from 'express'
import * as ctrl from '../controllers/task.controller'
import { authenticate, requireFamily, requireRole } from '../middleware/auth'
import multer from 'multer'
import path from 'path'
import fs from 'fs'

// Đảm bảo thư mục uploads tồn tại khi server khởi động
// (recursive: true để tạo cả thư mục cha nếu cần)
const uploadDir = path.join(process.cwd(), 'uploads')
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true })

/**
 * Cấu hình lưu file upload vào disk thay vì memory để xử lý file lớn hiệu quả hơn.
 * Tên file được tạo ngẫu nhiên (timestamp + số ngẫu nhiên) để tránh trùng lặp.
 */
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    // Kết hợp timestamp và số ngẫu nhiên để tạo tên file duy nhất
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    // Giữ nguyên phần mở rộng gốc của file (ví dụ: .jpg, .png)
    cb(null, `${unique}${path.extname(file.originalname)}`)
  },
})

/**
 * Cấu hình middleware multer cho upload ảnh bằng chứng.
 * Chỉ chấp nhận ảnh, từ chối các định dạng file khác để bảo mật.
 */
const upload = multer({
  storage,
  // Giới hạn kích thước file tối đa 10MB để tránh tốn băng thông và lưu trữ
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    // Chỉ cho phép các định dạng ảnh phổ biến
    const allowed = /jpeg|jpg|png|gif|webp/
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()))
  },
})

const router: ExpressRouter = Router()

// Áp dụng xác thực và kiểm tra gia đình cho toàn bộ router này
router.use(authenticate, requireFamily)

/** GET /tasks — Lấy danh sách nhiệm vụ (có thể lọc theo status, assignedToId). Mọi thành viên đều xem được. */
router.get('/', ctrl.getTasks)

/**
 * POST /tasks — Tạo nhiệm vụ mới.
 * Chỉ PARENT/SUPER_ADMIN mới được tạo nhiệm vụ để kiểm soát giao việc cho trẻ.
 */
router.post('/', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.createTask)

/** GET /tasks/:id — Xem chi tiết một nhiệm vụ kèm danh sách bằng chứng. Mọi thành viên đều xem được. */
router.get('/:id', ctrl.getTask)

/**
 * PATCH /tasks/:id/assign — Giao hoặc thay đổi người thực hiện nhiệm vụ.
 * Chỉ PARENT/SUPER_ADMIN có quyền để đảm bảo phụ huynh kiểm soát việc phân công.
 */
router.patch('/:id/assign', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.assignTask)

/**
 * PATCH /tasks/:id/start — Bắt đầu thực hiện nhiệm vụ (PENDING → IN_PROGRESS).
 * Mọi thành viên đều có thể tự bắt đầu nhiệm vụ được giao cho mình.
 */
router.patch('/:id/start', ctrl.startTask)

/**
 * POST /tasks/:id/proof — Nộp bằng chứng hoàn thành (IN_PROGRESS → SUBMITTED).
 * Chấp nhận một file ảnh (field name: `image`) qua multipart/form-data.
 * Mọi thành viên đều có thể nộp bằng chứng.
 */
router.post('/:id/proof', upload.single('image'), ctrl.submitProof)

/**
 * PATCH /tasks/:id/approve — Phê duyệt bằng chứng (SUBMITTED → APPROVED).
 * Chỉ PARENT/SUPER_ADMIN có quyền duyệt và kích hoạt thanh toán thưởng.
 */
router.patch('/:id/approve', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.approveTask)

/**
 * PATCH /tasks/:id/reject — Từ chối bằng chứng (SUBMITTED → REJECTED).
 * Chỉ PARENT/SUPER_ADMIN có quyền từ chối để yêu cầu làm lại.
 */
router.patch('/:id/reject', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.rejectTask)

/**
 * DELETE /tasks/:id — Huỷ nhiệm vụ (chuyển sang CANCELLED, không xoá khỏi database).
 * Dùng DELETE method vì về mặt nghiệp vụ đây là "xoá" nhiệm vụ khỏi danh sách hoạt động.
 * Chỉ PARENT/SUPER_ADMIN có quyền huỷ.
 */
router.delete('/:id', requireRole('PARENT', 'SUPER_ADMIN'), ctrl.cancelTask)

export default router
