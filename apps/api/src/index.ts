import { createApp } from './app'
import { env } from './config/env'
import { prisma } from './config/database'

async function main() {
  // Test DB connection
  await prisma.$connect()
  console.log('✅ Database connected')

  const { httpServer } = createApp()

  httpServer.listen(env.API_PORT, () => {
    console.log(`🚀 API running on http://localhost:${env.API_PORT}`)
    console.log(`   Environment: ${env.NODE_ENV}`)
  })
}

main().catch((err) => {
  console.error('Failed to start server:', err)
  process.exit(1)
})
