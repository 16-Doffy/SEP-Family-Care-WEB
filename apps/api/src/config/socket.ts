import { Server } from 'socket.io'
import type { Server as HttpServer } from 'http'
import { verifyAccessToken } from '../utils/jwt'
import { env } from './env'

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
    if (!token) {
      return next(new Error('No token provided'))
    }
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

  io.on('connection', (socket) => {
    const { userId, familyId } = socket.data as { userId: string; familyId?: string }

    // Join personal room + family room
    socket.join(`user:${userId}`)
    if (familyId) socket.join(`family:${familyId}`)

    socket.on('disconnect', () => {
      // cleanup handled automatically by socket.io
    })
  })

  return io
}

export function getIO(): Server {
  if (!io) throw new Error('Socket.IO not initialized')
  return io
}
