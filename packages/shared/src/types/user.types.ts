import type { Role } from '../constants/roles'

export interface User {
  id: string
  email: string
  displayName: string
  avatarUrl?: string | null
  role: Role
  isActive: boolean
  createdAt: string
}

export interface FamilyMember {
  id: string
  userId: string
  familyId: string
  nickname?: string | null
  joinedAt: string
  user: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl' | 'role'>
}

export interface RegisterDto {
  email: string
  password: string
  displayName: string
  familyName: string
  role?: 'PARENT' | 'CHILD'
}

export interface LoginDto {
  email: string
  password: string
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User & { familyMember?: FamilyMember }
}
