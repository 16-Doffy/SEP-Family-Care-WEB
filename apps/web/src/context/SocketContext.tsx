'use client'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import type { Socket } from 'socket.io-client'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { useAuth } from './AuthContext'

const SocketContext = createContext<Socket | null>(null)

export function SocketProvider({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth()
  const [socket, setSocket] = useState<Socket | null>(null)

  useEffect(() => {
    if (!accessToken) {
      disconnectSocket()
      setSocket(null)
      return
    }
    const s = getSocket(accessToken)
    setSocket(s)
    return () => {
      disconnectSocket()
    }
  }, [accessToken])

  return <SocketContext.Provider value={socket}>{children}</SocketContext.Provider>
}

export function useSocket() {
  return useContext(SocketContext)
}
