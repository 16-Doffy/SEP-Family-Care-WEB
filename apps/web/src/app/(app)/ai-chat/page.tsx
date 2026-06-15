/**
 * Trang trợ lý AI gia đình — chat với AI về tài chính, nhiệm vụ và lịch.
 * Sử dụng optimistic update để hiển thị tin nhắn người dùng ngay lập tức trước khi AI trả lời.
 */
'use client'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Send, Trash2, Loader2, Bot, User as UserIcon } from 'lucide-react'
import toast from 'react-hot-toast'
import { cn } from '@/lib/utils'

/** Tin nhắn trong cuộc hội thoại AI */
interface AiMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  model: string | null
  createdAt: string
}

/** Phản hồi từ API lịch sử chat AI */
interface HistoryResponse {
  conversation: { id: string }
  messages: AiMessage[]
  /** Provider hiện tại: 'openai' nếu có API key, 'mock' khi chạy offline */
  provider: 'openai' | 'mock'
}

/** Gợi ý câu hỏi nhanh hiển thị khi chưa có tin nhắn nào */
const SUGGESTIONS = [
  'Sổ quỹ của tôi đang ghi nhận bao nhiêu?',
  'Tôi có bao nhiêu nhiệm vụ chưa làm?',
  'Có sự kiện gì sắp tới không?',
  'Cho tôi vài mẹo tiết kiệm cho gia đình',
]

/**
 * Trang AI Chat với optimistic UI.
 * Khi gửi tin nhắn, hiển thị ngay tin của user rồi chờ AI phản hồi.
 * Nếu AI lỗi, rollback về state trước để tránh tin nhắn rác.
 */
export default function AiChatPage() {
  const qc = useQueryClient()
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Lấy lịch sử hội thoại AI khi trang tải
  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ['ai-history'],
    queryFn: () => api.get('/ai/history').then((r) => r.data),
  })

  const sendMut = useMutation({
    mutationFn: (content: string) => api.post('/ai/message', { content }).then((r) => r.data),
    /**
     * Optimistic update: thêm tin nhắn người dùng vào cache ngay lập tức
     * để giao diện phản hồi nhanh, không cần chờ server.
     */
    onMutate: async (content) => {
      // Hủy các query đang chạy để tránh ghi đè optimistic update
      await qc.cancelQueries({ queryKey: ['ai-history'] })
      const previous = qc.getQueryData<HistoryResponse>(['ai-history'])
      const optimisticUser: AiMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content,
        model: null,
        createdAt: new Date().toISOString(),
      }
      qc.setQueryData<HistoryResponse>(['ai-history'], (prev) =>
        prev ? { ...prev, messages: [...prev.messages, optimisticUser] } : prev,
      )
      return { previous }
    },
    // Sau khi thành công, fetch lại để có tin nhắn AI thật từ server
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-history'] })
    },
    // Nếu thất bại, khôi phục state cũ (rollback optimistic update)
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(['ai-history'], ctx.previous)
      toast.error('AI không phản hồi được, thử lại nhé')
    },
  })

  const clearMut = useMutation({
    mutationFn: () => api.delete('/ai/history'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-history'] })
      toast.success('Đã xoá lịch sử')
    },
  })

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [data?.messages.length, sendMut.isPending])

  /**
   * Gửi tin nhắn tới AI.
   * Chấp nhận nội dung trực tiếp (khi click suggestion) hoặc dùng giá trị ô input.
   * @param content - Nội dung tin nhắn (tùy chọn, mặc định dùng state `input`)
   */
  const handleSend = (content?: string) => {
    const text = (content ?? input).trim()
    if (!text || sendMut.isPending) return
    sendMut.mutate(text)
    setInput('')
  }

  const messages = data?.messages ?? []
  const isEmpty = !isLoading && messages.length === 0

  return (
    <div className="flex h-screen flex-col">
      <Topbar title="Trợ lý AI" />
      <div className="flex-1 flex flex-col bg-gray-50 min-h-0">
        <div className="px-6 py-3 border-b bg-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            <span className="font-medium">Family Care Assistant</span>
            <Badge variant={data?.provider === 'openai' ? 'default' : 'secondary'}>
              {data?.provider === 'openai' ? 'OpenAI' : 'Mock'}
            </Badge>
          </div>
          {messages.length > 0 && (
            <Button size="sm" variant="ghost" onClick={() => { if (confirm('Xoá toàn bộ lịch sử chat AI?')) clearMut.mutate() }}>
              <Trash2 className="w-4 h-4 mr-1" /> Xoá lịch sử
            </Button>
          )}
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
          ) : isEmpty ? (
            <div className="max-w-2xl mx-auto pt-12 text-center">
              <div className="inline-flex w-16 h-16 rounded-full bg-purple-100 items-center justify-center mb-4">
                <Sparkles className="w-8 h-8 text-purple-500" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">Chào! Tôi là trợ lý AI của gia đình bạn</h2>
              <p className="text-sm text-muted-foreground mt-2">
                Hỏi tôi về tài chính, nhiệm vụ, lịch hoặc xin mẹo tiết kiệm.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-6">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSend(s)}
                    className="text-left text-sm px-4 py-3 rounded-lg border bg-white hover:bg-purple-50 hover:border-purple-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => (
              <div key={m.id} className={cn('flex gap-3 max-w-3xl mx-auto', m.role === 'user' && 'flex-row-reverse')}>
                <div className={cn('w-8 h-8 rounded-full flex items-center justify-center shrink-0', m.role === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-600')}>
                  {m.role === 'user' ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>
                <div className={cn('rounded-2xl px-4 py-2 max-w-[80%]', m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border shadow-sm')}>
                  <div className="text-sm whitespace-pre-wrap leading-relaxed">{m.content}</div>
                  <div className={cn('text-[10px] mt-1', m.role === 'user' ? 'text-blue-100' : 'text-muted-foreground')}>
                    {new Date(m.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    {m.model && m.role === 'assistant' && ` · ${m.model}`}
                  </div>
                </div>
              </div>
            ))
          )}
          {sendMut.isPending && (
            <div className="flex gap-3 max-w-3xl mx-auto">
              <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="rounded-2xl px-4 py-3 bg-white border shadow-sm">
                <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              </div>
            </div>
          )}
        </div>

        <div className="border-t bg-white p-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <Input
              placeholder="Hỏi trợ lý AI..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              disabled={sendMut.isPending}
              className="flex-1"
            />
            <Button onClick={() => handleSend()} disabled={!input.trim() || sendMut.isPending}>
              {sendMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
