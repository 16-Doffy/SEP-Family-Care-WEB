import type { TaskStatus } from '../constants/taskStatus'

export interface TaskProof {
  id: string
  taskId: string
  submittedBy: string
  imageUrl?: string | null
  note?: string | null
  createdAt: string
  submitter?: { displayName: string; avatarUrl?: string | null }
}

export interface Task {
  id: string
  familyId: string
  title: string
  description?: string | null
  status: TaskStatus
  reward?: number | null
  dueDate?: string | null
  createdAt: string
  updatedAt: string
  createdBy: { id: string; user: { displayName: string; avatarUrl?: string | null } }
  assignedTo?: { id: string; user: { displayName: string; avatarUrl?: string | null } } | null
  proofs: TaskProof[]
  _count?: { proofs: number }
}

export interface CreateTaskDto {
  title: string
  description?: string
  reward?: number
  dueDate?: string
  assignedToId?: string
}

export interface UpdateTaskDto {
  title?: string
  description?: string
  reward?: number
  dueDate?: string
}
