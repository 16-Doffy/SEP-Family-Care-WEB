import { prisma } from '../config/database'
import { Errors } from '../utils/errors'
import path from 'path'
import fs from 'fs'

export async function uploadPhotos(input: {
  familyId: string
  uploaderId: string  // FamilyMember.id
  files: { url: string; caption?: string }[]
}) {
  if (input.files.length === 0) throw Errors.BadRequest('Không có ảnh nào')

  const photos = await prisma.$transaction(
    input.files.map((f) =>
      prisma.albumPhoto.create({
        data: {
          familyId: input.familyId,
          uploaderId: input.uploaderId,
          imageUrl: f.url,
          caption: f.caption,
        },
        include: {
          uploader: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
        },
      }),
    ),
  )
  return photos
}

export async function getFamilyPhotos(familyId: string, cursor?: string) {
  return prisma.albumPhoto.findMany({
    where: { familyId },
    orderBy: { createdAt: 'desc' },
    take: 60,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      uploader: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
  })
}

export async function getPhoto(id: string, familyId: string) {
  const photo = await prisma.albumPhoto.findFirst({
    where: { id, familyId },
    include: {
      uploader: { include: { user: { select: { id: true, displayName: true, avatarUrl: true } } } },
    },
  })
  if (!photo) throw Errors.NotFound('Ảnh')
  return photo
}

export async function deletePhoto(input: {
  id: string
  familyId: string
  userId: string
  isParent: boolean
}) {
  const photo = await prisma.albumPhoto.findFirst({
    where: { id: input.id, familyId: input.familyId },
    include: { uploader: { select: { userId: true } } },
  })
  if (!photo) throw Errors.NotFound('Ảnh')

  // Only uploader or parent can delete
  if (photo.uploader.userId !== input.userId && !input.isParent) {
    throw Errors.Forbidden()
  }

  await prisma.albumPhoto.delete({ where: { id: input.id } })

  // Try to delete physical file
  try {
    const filename = path.basename(photo.imageUrl)
    const filePath = path.join(process.cwd(), 'uploads', filename)
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
  } catch {}

  return { ok: true }
}

export async function getStats(familyId: string) {
  const [total, byMember] = await Promise.all([
    prisma.albumPhoto.count({ where: { familyId } }),
    prisma.albumPhoto.groupBy({
      by: ['uploaderId'],
      where: { familyId },
      _count: true,
    }),
  ])
  return { total, byMember }
}
