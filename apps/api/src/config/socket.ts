import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { verifyAccessToken } from '../utils/jwt'
import { env } from './env'
import { prisma } from './database'

let io: Server

export function initSocket(httpServer: HttpServer): Server {
  io = new Server(httpServer, {
    cors: {
      origin: env.WEB_URL,
      methods: ['GET', 'POST'],
      credentials: true,
    },
  })

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined
    if (!token) return next(new Error('No token provided'))
    try {
      const payload = verifyAccessToken(token)
      socket.data.userId = payload.userId
      socket.data.familyId = payload.familyId
      socket.data.role = payload.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const { userId, familyId } = socket.data as { userId: string; familyId?: string }

    socket.join(`user:${userId}`)
    if (familyId) socket.join(`family:${familyId}`)

    // Auto-join all conversation rooms the user is part of
    try {
      const participants = await prisma.conversationParticipant.findMany({
        where: { userId },
        select: { conversationId: true },
      })
      participants.forEach(({ conversationId }) => {
        socket.join(`conversation:${conversationId}`)
      })
    } catch {}

    // Join a specific conversation room (called when user opens a chat)
    socket.on('chat:join', ({ conversationId }: { conversationId: string }) => {
      socket.join(`conversation:${conversationId}`)
    })

    // Typing indicator
    socket.on('chat:typing', ({ conversationId, isTyping }: { conversationId: string; isTyping: boolean }) => {
      socket.to(`conversation:${conversationId}`).emit('chat:typing', {
        userId,
        conversationId,
        isTyping,
      })
    })

    socket.on('disconnect', () => {
      // Socket.IO cleans up rooms automatically
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}
