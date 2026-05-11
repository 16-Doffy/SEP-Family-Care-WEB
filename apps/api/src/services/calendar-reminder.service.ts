import { prisma } from '../config/database'
import { createNotification } from './notification.service'

const REMINDER_WINDOW_MIN = 30
const SCAN_INTERVAL_MS = 60_000

function formatTime(d: Date) {
  return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
}

export async function scanAndSendReminders() {
  const now = new Date()
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_MIN * 60_000)

  const events = await prisma.familyEvent.findMany({
    where: {
      reminderSent: false,
      startDate: { gte: now, lte: windowEnd },
    },
    include: {
      family: { include: { members: { select: { userId: true } } } },
    },
  })

  for (const ev of events) {
    const minutesAway = Math.max(1, Math.round((ev.startDate.getTime() - now.getTime()) / 60_000))
    await Promise.all(
      ev.family.members.map((m) =>
        createNotification({
          userId: m.userId,
          type: 'CALENDAR_REMINDER',
          title: `⏰ Sắp đến: ${ev.title}`,
          body: `Bắt đầu lúc ${formatTime(ev.startDate)} (còn ~${minutesAway} phút)`,
          metadata: { eventId: ev.id, startDate: ev.startDate.toISOString() },
        }),
      ),
    )
    await prisma.familyEvent.update({ where: { id: ev.id }, data: { reminderSent: true } })
  }
}

let timer: NodeJS.Timeout | null = null

export function startCalendarReminderScheduler() {
  if (timer) return
  const tick = () => {
    scanAndSendReminders().catch((err) => console.error('[calendar-reminder] scan failed:', err))
  }
  tick()
  timer = setInterval(tick, SCAN_INTERVAL_MS)
  console.log(`⏰ Calendar reminder scheduler started (every ${SCAN_INTERVAL_MS / 1000}s, window ${REMINDER_WINDOW_MIN}m)`)
}

export function stopCalendarReminderScheduler() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
