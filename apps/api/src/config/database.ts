/**
 * Cấu hình kết nối cơ sở dữ liệu thông qua Prisma Client.
 * Tái sử dụng instance duy nhất trong môi trường phát triển để tránh kết nối dư thừa khi hot-reload.
 */
import { PrismaClient } from '@prisma/client'

/**
 * Gắn prisma vào globalThis để giữ lại instance qua các lần hot-reload (chỉ ở môi trường không phải production).
 * Tránh tình trạng tạo quá nhiều kết nối khi Next.js / ts-node tải lại module.
 */
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

/**
 * Instance Prisma Client dùng chung cho toàn bộ ứng dụng.
 * - Môi trường development: ghi log `error` và `warn` để hỗ trợ debug.
 * - Môi trường production: chỉ ghi log `error` để giảm nhiễu.
 */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

// Lưu instance vào global để tái sử dụng khi module bị tải lại (chỉ ngoài production)
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
