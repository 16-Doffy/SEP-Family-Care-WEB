/**
 * Trang album ảnh gia đình — tải lên, xem và xóa ảnh kỷ niệm.
 * Ảnh được nhóm theo ngày tải lên để dễ dàng duyệt theo thời gian.
 */
'use client'
import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import axios from 'axios'
import { api } from '@/lib/api'
import { useAuth } from '@/context/AuthContext'
import { Topbar } from '@/components/layout/Topbar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Camera, Upload, Loader2, X, Trash2, ImageIcon, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import toast from 'react-hot-toast'

/** Base URL API để xây dựng URL ảnh đầy đủ */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000'

/** Kiểu dữ liệu một bức ảnh trong album */
interface Photo {
  id: string
  imageUrl: string
  caption?: string | null
  createdAt: string
  uploader: { user: { id: string; displayName: string; avatarUrl?: string | null } }
}

/**
 * Nhóm danh sách ảnh theo ngày tải lên.
 * Sử dụng Map để giữ thứ tự chèn (ngày gần nhất được thêm trước).
 * @param photos - Danh sách ảnh cần nhóm
 * @returns Mảng tuple [nhãn ngày, danh sách ảnh]
 */
function groupByDate(photos: Photo[]) {
  const groups = new Map<string, Photo[]>()
  for (const p of photos) {
    const date = new Date(p.createdAt).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    if (!groups.has(date)) groups.set(date, [])
    groups.get(date)!.push(p)
  }
  return Array.from(groups.entries())
}

/**
 * Trang album gia đình.
 * Dùng axios thay vì api instance cho upload vì cần gắn Authorization header thủ công
 * khi gửi multipart/form-data (interceptor của api instance có thể không xử lý đúng).
 */
export default function AlbumPage() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [caption, setCaption] = useState('')
  const [previewPhoto, setPreviewPhoto] = useState<Photo | null>(null)

  const { data, isLoading } = useQuery<{ photos: Photo[] }>({
    queryKey: ['album'],
    queryFn: () => api.get('/album').then((r) => r.data),
    enabled: !!user?.familyMember,
  })
  const photos = data?.photos ?? []

  const uploadMut = useMutation({
    mutationFn: async () => {
      const formData = new FormData()
      selectedFiles.forEach((f) => formData.append('photos', f))
      if (caption.trim()) formData.append('caption', caption.trim())

      const token = localStorage.getItem('accessToken')
      return axios.post(`${API_URL}/api/album`, formData, {
        headers: { Authorization: `Bearer ${token}` },
      })
    },
    onSuccess: () => {
      toast.success(`Đã tải lên ${selectedFiles.length} ảnh`)
      qc.invalidateQueries({ queryKey: ['album'] })
      setUploadOpen(false)
      setSelectedFiles([])
      setCaption('')
    },
    onError: () => toast.error('Tải ảnh lên thất bại'),
  })

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.delete(`/album/${id}`),
    onSuccess: () => {
      toast.success('Đã xóa ảnh')
      qc.invalidateQueries({ queryKey: ['album'] })
      setPreviewPhoto(null)
    },
    onError: () => toast.error('Xóa thất bại'),
  })

  /** Tập hợp các đuôi file ảnh được hỗ trợ (bao gồm các định dạng ít phổ biến) */
  const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'jfif', 'jpe', 'heic', 'heif', 'avif', 'bmp', 'tiff', 'tif'])

  /**
   * Kiểm tra xem file có phải ảnh không.
   * Ưu tiên kiểm tra MIME type, nếu không có thì kiểm tra đuôi file.
   * @param f - File cần kiểm tra
   */
  const isImageFile = (f: File) => {
    if (f.type.startsWith('image/')) return true
    const ext = f.name.split('.').pop()?.toLowerCase() ?? ''
    return IMAGE_EXTS.has(ext)
  }

  /**
   * Xử lý khi người dùng chọn file.
   * Lọc chỉ lấy file ảnh và giới hạn tối đa 10 file mỗi lần upload.
   * @param files - Danh sách file được chọn từ input
   */
  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const arr = Array.from(files).filter(isImageFile).slice(0, 10)
    setSelectedFiles(arr)
    if (arr.length > 0) setUploadOpen(true)
  }

  if (!user?.familyMember) {
    return (
      <div className="flex h-screen flex-col">
        <Topbar title="Album gia đình" />
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          <p>Bạn cần tham gia gia đình để xem album</p>
        </div>
      </div>
    )
  }

  const isParent = user.role === 'PARENT' || user.role === 'SUPER_ADMIN'
  const grouped = groupByDate(photos)

  return (
    <div className="flex h-screen flex-col">
      <Topbar title="Album gia đình" />

      <div className="flex-1 overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-white sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Kho ảnh chung</h2>
            <p className="text-xs text-muted-foreground">{photos.length} ảnh</p>
          </div>
          <Button onClick={() => fileInputRef.current?.click()} className="gap-2 bg-pink-500 hover:bg-pink-600">
            <Upload className="w-4 h-4" />Tải ảnh lên
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.jfif,.jpe,.heic,.heif,.avif,.bmp,.tiff,.tif"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </div>

        <div className="p-6">
          {isLoading ? (
            <div className="flex justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-pink-500" /></div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
              <ImageIcon className="w-16 h-16 opacity-30" />
              <p className="font-medium">Chưa có ảnh nào</p>
              <p className="text-sm">Hãy tải lên kỷ niệm đầu tiên của gia đình!</p>
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="mt-2 gap-2">
                <Camera className="w-4 h-4" />Tải ảnh đầu tiên
              </Button>
            </div>
          ) : (
            <div className="space-y-8">
              {grouped.map(([date, dayPhotos]) => (
                <div key={date}>
                  <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-gray-700 capitalize">
                    <Calendar className="w-4 h-4" />
                    {date}
                    <span className="text-xs font-normal text-muted-foreground">({dayPhotos.length} ảnh)</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {dayPhotos.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setPreviewPhoto(p)}
                        className="relative aspect-square rounded-lg overflow-hidden bg-gray-100 group hover:ring-2 hover:ring-pink-400 transition-all"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`${API_URL}${p.imageUrl}`}
                          alt={p.caption ?? ''}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                        <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-white text-xs truncate">{p.uploader.user.displayName}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Upload preview modal */}
      <Dialog open={uploadOpen} onOpenChange={(o) => !o && setUploadOpen(false)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tải lên {selectedFiles.length} ảnh</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-72 overflow-y-auto">
              {selectedFiles.map((f, i) => (
                <div key={i} className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" />
                  <button
                    onClick={() => setSelectedFiles(selectedFiles.filter((_, idx) => idx !== i))}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-red-500"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="space-y-1">
              <label className="text-sm font-medium">Chú thích chung (không bắt buộc)</label>
              <Input
                placeholder="Sinh nhật mẹ, đi biển Vũng Tàu..."
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setSelectedFiles([]) }}>
              Hủy
            </Button>
            <Button
              onClick={() => uploadMut.mutate()}
              disabled={uploadMut.isPending || selectedFiles.length === 0}
              className="bg-pink-500 hover:bg-pink-600"
            >
              {uploadMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Tải lên ({selectedFiles.length})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo viewer modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); setPreviewPhoto(null) }}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>

          {(previewPhoto.uploader.user.id === user.id || isParent) && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                if (confirm('Xóa ảnh này khỏi album?')) deleteMut.mutate(previewPhoto.id)
              }}
              className="absolute top-4 right-16 px-3 h-10 rounded-full bg-red-500/80 hover:bg-red-500 text-white flex items-center gap-1.5 text-sm"
              disabled={deleteMut.isPending}
            >
              <Trash2 className="w-4 h-4" />Xóa
            </button>
          )}

          <div className="max-w-5xl w-full max-h-full flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`${API_URL}${previewPhoto.imageUrl}`}
              alt={previewPhoto.caption ?? ''}
              className="max-h-[80vh] max-w-full object-contain rounded-lg"
            />
            <div className="mt-3 text-white text-center max-w-xl">
              {previewPhoto.caption && <p className="text-base mb-1">"{previewPhoto.caption}"</p>}
              <p className="text-sm text-white/70">
                {previewPhoto.uploader.user.displayName} •{' '}
                {new Date(previewPhoto.createdAt).toLocaleString('vi-VN', { dateStyle: 'long', timeStyle: 'short' })}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
