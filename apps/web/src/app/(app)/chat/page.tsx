/**
 * Trang trò chuyện nhóm và riêng tư trong gia đình.
 * Hỗ trợ gửi văn bản, ảnh, phân trang tin nhắn cũ và chỉ báo đang nhập.
 */
'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { Topbar } from '@/components/layout/Topbar'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getInitials, formatDateTime } from '@/lib/utils'
import { Send, ImageIcon, Users, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

/** Base URL API dùng để render ảnh trong tin nhắn */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/** Người gửi tin nhắn */
interface MessageSender { id: string; displayName: string; avatarUrl?: string | null }
/** Tin nhắn trong cuộc trò chuyện */
interface ChatMessage { id: string; conversationId: string; type: string; content: string; metadata?: Record<string, unknown>; createdAt: string; sender: MessageSender }
/** Người tham gia cuộc trò chuyện */
interface Participant { userId: string; user: { id: string; displayName: string; avatarUrl?: string | null } }
/** Cuộc trò chuyện (nhóm GROUP hoặc riêng tư PRIVATE) */
interface Conversation { id: string; type: string; name?: string | null; participants: Participant[]; messages: ChatMessage[]; updatedAt: string }

/**
 * Lấy tên hiển thị của cuộc trò chuyện.
 * Với nhóm: dùng tên nhóm; với chat riêng: dùng tên người kia.
 * @param convo - Cuộc trò chuyện cần lấy tên
 * @param myId - ID của người dùng hiện tại
 */
function getConvoName(convo: Conversation, myId: string) {
  if (convo.type === 'GROUP') return convo.name ?? 'Nhóm gia đình'
  const other = convo.participants.find((p) => p.userId !== myId)
  return other?.user.displayName ?? 'Chat riêng'
}

/**
 * Lấy chữ cái đầu (initial) để hiển thị avatar cuộc trò chuyện.
 * Với nhóm: 'GĐ'; với chat riêng: initial của người kia.
 * @param convo - Cuộc trò chuyện
 * @param myId - ID của người dùng hiện tại
 */
function getConvoInitial(convo: Conversation, myId: string) {
  if (convo.type === 'GROUP') return 'GĐ'
  const other = convo.participants.find((p) => p.userId !== myId)
  return getInitials(other?.user.displayName ?? '?')
}

/** Phản hồi phân trang tin nhắn từ API */
interface MessagesPage { messages: ChatMessage[]; nextCursor: string | null; hasMore: boolean }

/**
 * Trang chat — sidebar danh sách cuộc trò chuyện + khu vực tin nhắn chính.
 * Sử dụng cursor-based pagination để tải tin nhắn cũ khi scroll lên đầu.
 */
export default function ChatPage() {
  const { user } = useAuth()
  const socket = useSocket()
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Lưu tin nhắn trong local state (không dùng React Query) để dễ append realtime
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [inputText, setInputText] = useState('')
  const [typingUsers, setTypingUsers] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  // Ref cho typing timeout để debounce sự kiện "đang nhập"
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  /** Cuộn xuống tin nhắn mới nhất */
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })

  const { data: conversations = [], isLoading: loadingConvos } = useQuery<Conversation[]>({
    queryKey: ['conversations'],
    queryFn: () => api.get('/chat/conversations').then((r) => r.data),
    enabled: !!user?.familyMember,
  })

  const { data: firstPage, isLoading: loadingMsgs } = useQuery<MessagesPage>({
    queryKey: ['messages', selectedId],
    queryFn: () => api.get(`/chat/conversations/${selectedId}/messages`).then((r) => r.data),
    enabled: !!selectedId,
  })

  useEffect(() => {
    if (firstPage) {
      setMessages(firstPage.messages)
      setNextCursor(firstPage.nextCursor)
      setHasMore(firstPage.hasMore)
      setTimeout(scrollToBottom, 100)
    }
  }, [firstPage])

  /**
   * Tải thêm tin nhắn cũ hơn bằng cursor pagination.
   * Lưu scrollHeight trước để giữ nguyên vị trí cuộn sau khi prepend tin nhắn mới vào đầu danh sách.
   */
  const loadMore = useCallback(async () => {
    if (!selectedId || !nextCursor || loadingMore || !hasMore) return
    const scrollEl = messagesScrollRef.current
    const prevHeight = scrollEl?.scrollHeight ?? 0
    setLoadingMore(true)
    try {
      const { data } = await api.get<MessagesPage>(`/chat/conversations/${selectedId}/messages`, { params: { cursor: nextCursor } })
      // Thêm tin cũ vào đầu mảng (tin cũ hơn ở trên cùng)
      setMessages((prev) => [...data.messages, ...prev])
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
      // Giữ nguyên vị trí cuộn bằng cách bù lại độ chênh lệch scrollHeight
      requestAnimationFrame(() => {
        if (scrollEl) scrollEl.scrollTop = scrollEl.scrollHeight - prevHeight
      })
    } catch {
      toast.error('Không tải được tin cũ')
    } finally {
      setLoadingMore(false)
    }
  }, [selectedId, nextCursor, loadingMore, hasMore])

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    if (e.currentTarget.scrollTop < 80 && hasMore && !loadingMore) loadMore()
  }

  useEffect(() => {
    if (!socket || !selectedId) return
    socket.emit('chat:join', { conversationId: selectedId })

    const handleMessage = (msg: ChatMessage) => {
      if (msg.conversationId === selectedId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev
          return [...prev, msg]
        })
        setTimeout(scrollToBottom, 50)
        qc.invalidateQueries({ queryKey: ['conversations'] })
      }
    }

    const handleTyping = ({ userId, isTyping: typing }: { userId: string; conversationId: string; isTyping: boolean }) => {
      if (userId === user?.id) return
      const name = conversations.find((c) => c.id === selectedId)?.participants.find((p) => p.userId === userId)?.user.displayName ?? 'Ai đó'
      setTypingUsers((prev) => typing ? (prev.includes(name) ? prev : [...prev, name]) : prev.filter((n) => n !== name))
    }

    socket.on('chat:message', handleMessage)
    socket.on('chat:typing', handleTyping)
    return () => {
      socket.off('chat:message', handleMessage)
      socket.off('chat:typing', handleTyping)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, selectedId])

  const sendMut = useMutation({
    mutationFn: (text: string) => api.post(`/chat/conversations/${selectedId}/messages`, { content: text }),
    onSuccess: () => { setInputText(''); qc.invalidateQueries({ queryKey: ['conversations'] }) },
    onError: () => toast.error('Gửi thất bại'),
  })

  const imageMut = useMutation({
    mutationFn: (file: File) => {
      const fd = new FormData()
      fd.append('image', file)
      return api.post(`/chat/conversations/${selectedId}/messages/image`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
    onError: () => toast.error('Gửi ảnh thất bại'),
  })

  const openGroupChat = useCallback(async () => {
    try {
      const { data } = await api.get('/chat/conversations/group')
      await qc.invalidateQueries({ queryKey: ['conversations'] })
      setSelectedId(data.id)
      setMessages([])
      setNextCursor(null)
      setHasMore(false)
    } catch { toast.error('Không thể mở nhóm chat') }
  }, [qc])

  const openPrivateChat = useCallback(async (targetUserId: string) => {
    try {
      const { data } = await api.post('/chat/conversations/private', { targetUserId })
      await qc.invalidateQueries({ queryKey: ['conversations'] })
      setSelectedId(data.id)
      setMessages([])
      setNextCursor(null)
      setHasMore(false)
    } catch { toast.error('Không thể mở chat riêng') }
  }, [qc])

  const handleSend = () => {
    if (!inputText.trim() || !selectedId) return
    sendMut.mutate(inputText.trim())
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  /**
   * Xử lý thay đổi ô nhập liệu.
   * Phát sự kiện "đang nhập" qua Socket.IO và tự động dừng sau 1.5 giây
   * không có thêm ký tự (debounce pattern).
   */
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value)
    if (!socket || !selectedId) return
    if (!isTyping) {
      setIsTyping(true)
      socket.emit('chat:typing', { conversationId: selectedId, isTyping: true })
    }
    // Reset timer mỗi khi user nhập thêm ký tự
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      setIsTyping(false)
      socket.emit('chat:typing', { conversationId: selectedId, isTyping: false })
    }, 1500)
  }

  const selectedConvo = conversations.find((c) => c.id === selectedId)
  const familyMembers = selectedConvo?.participants.filter((p) => p.userId !== user?.id) ?? []

  return (
    <div className="flex h-screen flex-col">
      <Topbar title="Trò chuyện" />
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation list */}
        <aside className="w-72 border-r flex flex-col bg-white shrink-0">
          <div className="p-3 border-b space-y-2">
            <Button size="sm" className="w-full justify-start gap-2" variant="outline" onClick={openGroupChat}>
              <Users className="w-4 h-4 text-blue-600" />
              <span className="text-sm">Nhóm gia đình</span>
            </Button>
            {user?.familyMember && familyMembers.length === 0 && conversations.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">Bắt đầu bằng cách mở nhóm chat ↑</p>
            )}
          </div>
          <div className="flex-1 overflow-y-auto">
            {loadingConvos ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
            ) : (
              conversations.map((convo) => {
                const lastMsg = convo.messages[0]
                const name = getConvoName(convo, user?.id ?? '')
                const initial = getConvoInitial(convo, user?.id ?? '')
                return (
                  <button
                    key={convo.id}
                    onClick={() => { setSelectedId(convo.id); setMessages([]); setNextCursor(null); setHasMore(false) }}
                    className={cn(
                      'w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors border-b',
                      selectedId === convo.id && 'bg-blue-50',
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0', convo.type === 'GROUP' ? 'bg-blue-500' : 'bg-green-500')}>
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{name}</p>
                      {lastMsg && (
                        <p className="text-xs text-muted-foreground truncate">
                          {lastMsg.sender.id === user?.id ? 'Bạn: ' : ''}{lastMsg.type === 'IMAGE' ? '📷 Ảnh' : lastMsg.content}
                        </p>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Family members to start private chat */}
          {user?.familyMember && (
            <div className="border-t p-3">
              <p className="text-xs font-medium text-muted-foreground mb-2">Chat riêng</p>
              <div className="space-y-1">
                {conversations
                  .flatMap((c) => c.participants)
                  .filter((p, i, arr) => p.userId !== user.id && arr.findIndex((x) => x.userId === p.userId) === i)
                  .map((p) => (
                    <button
                      key={p.userId}
                      onClick={() => openPrivateChat(p.userId)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 text-sm text-left"
                    >
                      <Avatar className="w-6 h-6">
                        <AvatarFallback className="text-[10px] bg-green-100 text-green-700">{getInitials(p.user.displayName)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">{p.user.displayName}</span>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </aside>

        {/* Message area */}
        <div className="flex-1 flex flex-col min-w-0">
          {!selectedId ? (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
              <MessageSquare className="w-12 h-12 opacity-30" />
              <p className="text-sm">Chọn cuộc trò chuyện hoặc mở Nhóm gia đình</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="h-14 border-b flex items-center px-4 gap-3 bg-white shrink-0">
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold', selectedConvo?.type === 'GROUP' ? 'bg-blue-500' : 'bg-green-500')}>
                  {selectedConvo ? getConvoInitial(selectedConvo, user?.id ?? '') : '?'}
                </div>
                <div>
                  <p className="font-semibold text-sm">{selectedConvo ? getConvoName(selectedConvo, user?.id ?? '') : ''}</p>
                  {selectedConvo?.type === 'GROUP' && (
                    <p className="text-xs text-muted-foreground">{selectedConvo.participants.length} thành viên</p>
                  )}
                </div>
              </div>

              {/* Messages */}
              <div ref={messagesScrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50">
                {loadingMore && (
                  <div className="flex justify-center py-2"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
                )}
                {!loadingMore && !hasMore && messages.length > 0 && (
                  <p className="text-center text-[10px] text-muted-foreground py-1">— Đầu cuộc trò chuyện —</p>
                )}
                {loadingMsgs ? (
                  <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
                ) : messages.length === 0 ? (
                  <p className="text-center text-muted-foreground text-sm py-8">Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</p>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.sender.id === user?.id
                    return (
                      <div key={msg.id} className={cn('flex gap-2', isMe && 'flex-row-reverse')}>
                        {!isMe && (
                          <Avatar className="w-7 h-7 shrink-0 mt-1">
                            <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700">{getInitials(msg.sender.displayName)}</AvatarFallback>
                          </Avatar>
                        )}
                        <div className={cn('max-w-xs lg:max-w-md', isMe && 'items-end flex flex-col')}>
                          {!isMe && <p className="text-xs text-muted-foreground mb-1 ml-1">{msg.sender.displayName}</p>}
                          <div className={cn('px-3 py-2 rounded-2xl text-sm', isMe ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-white text-gray-900 shadow-sm rounded-tl-sm')}>
                            {msg.type === 'IMAGE' ? (
                              <img src={`${API_URL}${msg.content}`} alt="img" className="rounded-lg max-h-48 max-w-full object-cover" />
                            ) : (
                              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                            )}
                          </div>
                          <p className={cn('text-[10px] text-muted-foreground mt-0.5', isMe ? 'text-right' : 'text-left ml-1')}>{formatDateTime(msg.createdAt)}</p>
                        </div>
                      </div>
                    )
                  })
                )}
                {typingUsers.length > 0 && (
                  <p className="text-xs text-muted-foreground italic ml-2">{typingUsers.join(', ')} đang nhập...</p>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-3 border-t bg-white flex gap-2 items-center shrink-0">
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) imageMut.mutate(f); e.target.value = '' }} />
                <Button size="icon" variant="ghost" onClick={() => fileInputRef.current?.click()} disabled={imageMut.isPending} title="Gửi ảnh">
                  {imageMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4 text-muted-foreground" />}
                </Button>
                <Input
                  placeholder="Nhập tin nhắn..."
                  value={inputText}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  className="flex-1"
                  disabled={sendMut.isPending}
                />
                <Button size="icon" onClick={handleSend} disabled={!inputText.trim() || sendMut.isPending}>
                  {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
