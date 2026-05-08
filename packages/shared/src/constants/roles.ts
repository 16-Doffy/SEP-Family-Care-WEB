export const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  PARENT: 'PARENT',
  CHILD: 'CHILD',
} as const

export type Role = keyof typeof ROLES
