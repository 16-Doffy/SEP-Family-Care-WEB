import type { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { prisma } from '../config/database'
import * as aiChatService from '../services/ai-chat.service'
import { isOpenAiEnabled } from '../services/ai.service'

export async function getHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const { conversation, messages } = await aiChatService.getMessages(req.user.userId)
    res.json({ conversation, messages, provider: isOpenAiEnabled() ? 'openai' : 'mock' })
  } catch (e) { next(e) }
}

const sendSchema = z.object({ content: z.string().min(1).max(2000) })

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
  try {
    const { content } = sendSchema.parse(req.body)

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.user.userId },
      select: { displayName: true, role: true },
    })

    const result = await aiChatService.sendAndReply(
      {
        userId: req.user.userId,
        familyId: req.user.familyId,
        displayName: user.displayName,
        role: user.role,
      },
      content,
    )

    res.status(201).json(result)
  } catch (e) { next(e) }
}

export async function clearHistory(req: Request, res: Response, next: NextFunction) {
  try {
    await aiChatService.clearHistory(req.user.userId)
    res.json({ ok: true })
  } catch (e) { next(e) }
}
