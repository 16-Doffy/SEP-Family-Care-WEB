/**
 * @module recurring-task-scheduler.service
 * @description Scheduler nền cho nhiệm vụ định kỳ (Core flow 2) và đóng tháng
 * tài chính (Core flow 1).
 *
 * Hai nhịp:
 *  - DAILY_TICK_MS (15 phút): kiểm tra mốc đầu ngày (00:05) để sinh instance;
 *    kiểm tra mốc cuối tháng (23:55 ngày cuối) để đóng tháng + bắn cảnh báo.
 *  - OVERDUE_TICK_MS (10 phút): quét task open-for-claim quá giờ → thông báo
 *    PARENT override.
 *
 * Dùng setInterval đơn giản (theo pattern calendar-reminder.service.ts) để
 * tránh thêm dependency mới. Idempotent: dùng cờ "đã chạy hôm nay" để không
 * sinh trùng.
 */

import { prisma } from '../config/database'
import {
  generateTodayInstances,
  notifyOverdueUnclaimed,
} from './recurring-task.service'
import { closeMonth } from './finance.service'
import { emitWarningsToFamily } from './finance-predict.service'

const DAILY_TICK_MS = 15 * 60_000 // 15 phút
const OVERDUE_TICK_MS = 10 * 60_000

let dailyTimer: NodeJS.Timeout | null = null
let overdueTimer: NodeJS.Timeout | null = null

let lastDailyRunDate: string | null = null
let lastMonthClose: string | null = null

function todayKey(d = new Date()) {
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

/** Kiểm tra ngày `d` có phải là ngày cuối tháng không. */
function isLastDayOfMonth(d: Date) {
  const next = new Date(d)
  next.setDate(d.getDate() + 1)
  return next.getMonth() !== d.getMonth()
}

async function dailyTick() {
  const now = new Date()
  const key = todayKey(now)

  // 1. Sinh instance đầu ngày (chạy sau 00:00 và trước 06:00, mỗi ngày 1 lần)
  if (lastDailyRunDate !== key && now.getHours() < 6) {
    try {
      const total = await generateTodayInstances()
      console.log(`[recurring] generated ${total} task instances for ${key}`)
      lastDailyRunDate = key
    } catch (err) {
      console.error('[recurring] generate instances failed:', err)
    }
  }

  // 2. Đóng tháng vào cuối ngày cuối tháng (sau 23:00)
  if (isLastDayOfMonth(now) && now.getHours() >= 23) {
    const monthKey = `${now.getFullYear()}-${now.getMonth() + 1}`
    if (lastMonthClose !== monthKey) {
      try {
        const families = await prisma.family.findMany({
          where: { status: 'ACTIVE' },
          select: { id: true },
        })
        for (const f of families) {
          await closeMonth(f.id, now.getFullYear(), now.getMonth() + 1)
          await emitWarningsToFamily(f.id)
        }
        console.log(`[finance] closed month ${monthKey} for ${families.length} families`)
        lastMonthClose = monthKey
      } catch (err) {
        console.error('[finance] close month failed:', err)
      }
    }
  }
}

async function overdueTick() {
  try {
    const n = await notifyOverdueUnclaimed()
    if (n > 0) console.log(`[recurring] notified ${n} parents about overdue unclaimed`)
  } catch (err) {
    console.error('[recurring] overdue check failed:', err)
  }
}

export function startRecurringTaskScheduler() {
  if (dailyTimer || overdueTimer) return
  dailyTick().catch((err) => console.error('[scheduler] daily tick error:', err))
  overdueTick().catch((err) => console.error('[scheduler] overdue tick error:', err))
  dailyTimer = setInterval(dailyTick, DAILY_TICK_MS)
  overdueTimer = setInterval(overdueTick, OVERDUE_TICK_MS)
  console.log(
    `⏰ Recurring task & finance scheduler started (daily ${DAILY_TICK_MS / 60_000}m, overdue ${OVERDUE_TICK_MS / 60_000}m)`,
  )
}

export function stopRecurringTaskScheduler() {
  if (dailyTimer) {
    clearInterval(dailyTimer)
    dailyTimer = null
  }
  if (overdueTimer) {
    clearInterval(overdueTimer)
    overdueTimer = null
  }
}
