export const NOTIFICATION_TYPE = {
  TASK_ASSIGNED: 'TASK_ASSIGNED',
  TASK_SUBMITTED: 'TASK_SUBMITTED',
  TASK_APPROVED: 'TASK_APPROVED',
  TASK_REJECTED: 'TASK_REJECTED',
  TRANSFER_RECEIVED: 'TRANSFER_RECEIVED',
  MEMBER_JOINED: 'MEMBER_JOINED',
  CHAT_MESSAGE: 'CHAT_MESSAGE',
  SOS: 'SOS',
  SYSTEM: 'SYSTEM',
} as const

export type NotificationType = keyof typeof NOTIFICATION_TYPE

export interface Notification {
  id: string
  userId: string
  type: NotificationType
  title: string
  body: string
  isRead: boolean
  metadata?: Record<string, unknown> | null
  createdAt: string
}

// Socket.IO event payloads
export interface WsNotificationPayload {
  notification: Notification
  unreadCount: number
}
