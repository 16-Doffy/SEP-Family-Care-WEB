import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import path from 'path'
import { createServer } from 'http'
import { initSocket } from './config/socket'
import { errorHandler } from './middleware/errorHandler'
import { apiRouter } from './routes'
import { env } from './config/env'
import { setIOGetter } from './services/notification.service'

export function createApp() {
  const app = express()
  const httpServer = createServer(app)

  // Socket.IO
  const io = initSocket(httpServer)
  setIOGetter(() => io)

  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
  app.use(cors({
    origin: env.WEB_URL,
    credentials: true,
  }))
  app.use(express.json())
  app.use(express.urlencoded({ extended: true }))

  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  }))

  app.use('/api', rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
  }))

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')))

  // Health check
  app.get('/health', (_req, res) => res.json({ status: 'ok', timestamp: new Date().toISOString() }))

  // API routes
  app.use('/api', apiRouter)

  app.use(errorHandler)

  return { app, httpServer }
}
