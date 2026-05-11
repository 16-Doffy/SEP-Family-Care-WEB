import { createApp } from './app'
import { env } from './config/env'
import { prisma } from './config/database'
import { startCalendarReminderScheduler } from './services/calendar-reminder.service'
import { ensureDefaultPlans } from './services/subscription-plan.service'
import { startSubscriptionExpiryScheduler } from './services/payment.service'

async function main() {
  // Test DB connection
  await prisma.$connect()
  console.log('✅ Database connected')

  await ensureDefaultPlans().catch((err) => console.error('Plan seed failed:', err))

  const { httpServer } = createApp()

  httpServer.listen(env.API_PORT, () => {
    console.log(`🚀 API running on http://localhost:${env.API_PORT}`)
    console.log(`   Environment: ${env.NODE_ENV}`)
    startCalendarReminderScheduler()
    startSubscriptionExpiryScheduler()
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
