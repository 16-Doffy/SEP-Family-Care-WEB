/**
 * @module chat.service
 * @description Cung cấp các hàm nghiệp vụ liên quan đến hệ thống nhắn tin trong gia đình.
 * Hỗ trợ hai loại cuộc trò chuyện:
 *  - GROUP: Nhóm chat chung của cả gia đình
 *  - PRIVATE: Trò chuyện riêng tư giữa hai thành viên
 *
 * Phân trang tin nhắn được thực hiện theo cơ chế cursor để tránh tải toàn bộ lịch sử.
 */

import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import type { Prisma } from '@prisma/client'

/**
 * Các trường được select khi truy vấn tin nhắn.
 * Sử dụng hằng số dùng chung để tránh lặp lại cấu hình select ở nhiều nơi.
 */
const MESSAGE_SELECT = {
  id: true,
  conversationId: true,
  type: true,
  content: true,
  metadata: true,
  createdAt: true,
  // Chỉ lấy thông tin hiển thị cơ bản của người gửi, không lấy dữ liệu nhạy cảm
  sender: { select: { id: true, displayName: true, avatarUrl: true } },
}

/**
 * Lấy danh sách tất cả các cuộc trò chuyện mà người dùng tham gia trong một gia đình.
 * Mỗi cuộc trò chuyện được kèm theo tin nhắn gần nhất để hiển thị preview.
 *
 * @param userId - ID của người dùng đang yêu cầu
 * @param familyId - ID của gia đình cần lấy danh sách cuộc trò chuyện
 * @returns Danh sách cuộc trò chuyện, sắp xếp theo thời gian cập nhật mới nhất
 */
export async function getConversations(userId: string, familyId: string) {
  return prisma.conversation.findMany({
    where: {
      familyId,
      // Chỉ trả về cuộc trò chuyện mà người dùng là thành viên
      participants: { some: { userId } },
    },
    include: {
      participants: {
        include: { user: { select: { id: true, displayName: true, avatarUrl: true } } },
      },
      messages: {
        // Chỉ lấy 1 tin nhắn mới nhất để hiển thị preview trong danh sách
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: MESSAGE_SELECT,
      },
    },
    // Cuộc trò chuyện có tin nhắn gần nhất sẽ hiển thị lên trên cùng
    orderBy: { updatedAt: 'desc' },
  })
}

/**
 * Lấy hoặc tạo nhóm chat của gia đình (type = GROUP).
 * Mỗi gia đình chỉ có một nhóm chat chung; hàm này đảm bảo tính idempotency –
 * gọi nhiều lần vẫn trả về cùng một cuộc trò chuyện.
 *
 * @param familyId - ID của gia đình
 * @returns Cuộc trò chuyện nhóm hiện có hoặc mới được tạo
 */
export async function getOrCreateFamilyGroupChat(familyId: string) {
  // Ưu tiên tìm cuộc trò chuyện nhóm đã tồn tại để tránh tạo trùng lặp
  const existing = await prisma.conversation.findFirst({
    where: { familyId, type: 'GROUP' },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  })
  if (existing) return existing

  // Lấy tất cả thành viên gia đình để thêm vào nhóm chat mới
  const family = await prisma.family.findUniqueOrThrow({
    where: { id: familyId },
    include: { members: true },
  })

  // Tạo nhóm chat mới với tất cả thành viên hiện tại của gia đình
  return prisma.conversation.create({
    data: {
      familyId,
      type: 'GROUP',
      name: `Nhóm ${family.name}`,
      participants: {
        create: family.members.map((m) => ({ userId: m.userId })),
      },
    },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  })
}

/**
 * Lấy hoặc tạo cuộc trò chuyện riêng tư giữa hai thành viên trong cùng một gia đình.
 * Hàm này đảm bảo idempotency – không tạo trùng cuộc trò chuyện nếu đã tồn tại.
 *
 * @param familyId - ID của gia đình
 * @param userId1 - ID của người dùng thứ nhất (thường là người đang đăng nhập)
 * @param userId2 - ID của người dùng thứ hai (mục tiêu muốn chat)
 * @returns Cuộc trò chuyện riêng tư hiện có hoặc mới được tạo
 * @throws {BadRequestError} Nếu hai userId giống nhau (không thể tự chat với bản thân)
 */
export async function getOrCreatePrivateChat(familyId: string, userId1: string, userId2: string) {
  // Kiểm tra điều kiện nghiệp vụ: người dùng không thể tự nhắn tin cho chính mình
  if (userId1 === userId2) throw Errors.BadRequest('Cannot chat with yourself')

  // Dùng điều kiện AND để tìm cuộc trò chuyện có đúng hai thành viên này
  const existing = await prisma.conversation.findFirst({
    where: {
      familyId,
      type: 'PRIVATE',
      AND: [
        { participants: { some: { userId: userId1 } } },
        { participants: { some: { userId: userId2 } } },
      ],
    },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  })
  if (existing) return existing

  return prisma.conversation.create({
    data: {
      familyId,
      type: 'PRIVATE',
      participants: { create: [{ userId: userId1 }, { userId: userId2 }] },
    },
    include: { participants: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } } },
  })
}

/**
 * Lấy danh sách tin nhắn của một cuộc trò chuyện với hỗ trợ phân trang dựa trên cursor.
 * Tin nhắn được trả về theo thứ tự từ cũ đến mới (ASC) sau khi đã phân trang.
 *
 * Cơ chế cursor-based pagination:
 *  - Client gửi `cursor` là ID của tin nhắn cuối cùng đã nhận
 *  - Server trả về PAGE_SIZE tin nhắn cũ hơn cursor đó
 *  - Nếu còn tin nhắn cũ hơn, `hasMore` = true và `nextCursor` sẽ được trả về
 *
 * @param conversationId - ID của cuộc trò chuyện
 * @param userId - ID của người dùng yêu cầu (để kiểm tra quyền truy cập)
 * @param cursor - ID của tin nhắn làm điểm bắt đầu phân trang (tùy chọn)
 * @returns Object gồm danh sách tin nhắn, con trỏ trang kế, và cờ hasMore
 * @throws {ForbiddenError} Nếu người dùng không phải là thành viên của cuộc trò chuyện
 */
export async function getMessages(conversationId: string, userId: string, cursor?: string) {
  // Kiểm tra quyền: chỉ thành viên tham gia cuộc trò chuyện mới được đọc tin nhắn
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  })
  if (!participant) throw Errors.Forbidden()

  const PAGE_SIZE = 30

  // Lấy PAGE_SIZE + 1 bản ghi để xác định còn trang tiếp theo hay không
  // mà không cần query count riêng biệt (tối ưu hiệu năng)
  const rows = await prisma.message.findMany({
    where: { conversationId },
    select: MESSAGE_SELECT,
    orderBy: { createdAt: 'desc' },
    take: PAGE_SIZE + 1,
    // Nếu có cursor thì bỏ qua bản ghi cursor và lấy các bản ghi tiếp theo
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  })

  const hasMore = rows.length > PAGE_SIZE
  // Chỉ trả về đúng PAGE_SIZE bản ghi nếu có trang tiếp theo
  const page = hasMore ? rows.slice(0, PAGE_SIZE) : rows
  // nextCursor là ID của tin nhắn cuối cùng trong trang hiện tại
  const nextCursor = hasMore ? page[page.length - 1].id : null

  // Đảo ngược kết quả: query DESC để lấy tin nhắn mới nhất trước,
  // sau đó reverse để hiển thị theo thứ tự từ cũ đến mới (chronological)
  return { messages: page.reverse(), nextCursor, hasMore }
}

/**
 * Gửi một tin nhắn mới vào cuộc trò chuyện.
 * Sử dụng transaction để đảm bảo tính toàn vẹn:
 * tin nhắn được tạo và timestamp của cuộc trò chuyện được cập nhật đồng thời.
 *
 * @param input - Thông tin tin nhắn cần gửi
 * @param input.conversationId - ID của cuộc trò chuyện đích
 * @param input.senderId - ID của người gửi
 * @param input.type - Loại tin nhắn: TEXT | IMAGE | LOCATION
 * @param input.content - Nội dung tin nhắn (text hoặc URL)
 * @param input.metadata - Dữ liệu bổ sung tùy theo loại tin nhắn (tùy chọn)
 * @returns Tin nhắn vừa được tạo
 * @throws {ForbiddenError} Nếu người gửi không thuộc cuộc trò chuyện
 */
export async function sendMessage(input: {
  conversationId: string
  senderId: string
  type: 'TEXT' | 'IMAGE' | 'LOCATION' | 'FILE'
  content: string
  metadata?: Record<string, unknown>
}) {
  // Kiểm tra quyền: chỉ thành viên tham gia mới được gửi tin nhắn
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId: input.conversationId, userId: input.senderId } },
  })
  if (!participant) throw Errors.Forbidden()

  // Dùng transaction để đảm bảo cả hai thao tác cùng thành công hoặc cùng thất bại.
  // Cập nhật updatedAt của conversation giúp sắp xếp danh sách chat theo tin nhắn mới nhất.
  const [message] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: input.conversationId,
        senderId: input.senderId,
        type: input.type,
        content: input.content,
        // Dùng object rỗng làm giá trị mặc định vì Prisma yêu cầu InputJsonObject (không phải undefined)
        metadata: (input.metadata ?? {}) as Prisma.InputJsonObject,
      },
      select: MESSAGE_SELECT,
    }),
    prisma.conversation.update({
      where: { id: input.conversationId },
      data: { updatedAt: new Date() },
    }),
  ])

  return message
}

/**
 * Đánh dấu tất cả tin nhắn trong cuộc trò chuyện là đã đọc đối với người dùng hiện tại.
 * Không ném lỗi nếu người dùng không phải là thành viên – bỏ qua yên lặng để tránh lộ thông tin.
 *
 * @param conversationId - ID của cuộc trò chuyện
 * @param userId - ID của người dùng muốn đánh dấu đã đọc
 */
export async function markRead(conversationId: string, userId: string) {
  // Kiểm tra nhẹ: nếu không phải thành viên thì bỏ qua, không ném lỗi
  // (tránh để client biết sự tồn tại của cuộc trò chuyện mà họ không tham gia)
  const participant = await prisma.conversationParticipant.findUnique({
    where: { conversationId_userId: { conversationId, userId } },
  })
  if (!participant) return
  await prisma.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  })
}

/**
 * Thêm một thành viên mới vào tất cả nhóm chat GROUP của gia đình.
 * Được gọi khi có thành viên mới tham gia gia đình để họ tự động
 * có quyền tham gia các nhóm chat đang hoạt động.
 *
 * @param familyId - ID của gia đình
 * @param userId - ID của thành viên mới cần thêm vào các nhóm chat
 */
export async function addParticipantToGroupChats(familyId: string, userId: string) {
  // Lấy tất cả nhóm chat của gia đình (chỉ lấy id để tối ưu query)
  const groupChats = await prisma.conversation.findMany({
    where: { familyId, type: 'GROUP' },
    select: { id: true },
  })

  for (const chat of groupChats) {
    // Kiểm tra trước khi thêm để tránh vi phạm ràng buộc unique
    const exists = await prisma.conversationParticipant.findUnique({
      where: { conversationId_userId: { conversationId: chat.id, userId } },
    })
    if (!exists) {
      await prisma.conversationParticipant.create({
        data: { conversationId: chat.id, userId },
      })
    }
  }
}
