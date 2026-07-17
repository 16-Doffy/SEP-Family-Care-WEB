/**
 * @module hooks/useAdmin
 * @description React Query hooks cho khu vực Admin (SYSTEM_ADMIN), theo đúng API team:
 * `/admin/users`, `/admin/families`, `/admin/family-members`, `/admin/subscription-plans`,
 * `/admin/invitations`. Swagger không khai báo schema response chi tiết cho các GET này,
 * nên các interface dưới đây dựa trên field của DTO ghi (PATCH/POST) — coi các field còn
 * lại là "best effort", luôn fallback an toàn khi hiển thị.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Paginated } from './useTeamFinance'

export interface AdminUser {
  id: string
  email: string
  fullName: string
  phone?: string | null
  avatarUrl?: string | null
  userType: 'NORMAL_USER' | 'SYSTEM_ADMIN'
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  verificationStatus?: 'UNVERIFIED' | 'VERIFIED'
  createdAt?: string
}

export interface AdminUpdateUserInput {
  accountStatus?: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED'
  userType?: 'NORMAL_USER' | 'SYSTEM_ADMIN'
  verificationStatus?: 'UNVERIFIED' | 'VERIFIED'
  fullName?: string
  phone?: string
  avatarUrl?: string
}

export function useAdminUser(id: string | null) {
  return useQuery<AdminUser>({
    queryKey: ['admin', 'users', id],
    queryFn: () => api.get(`/admin/users/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useAdminUsers(params?: { page?: number; limit?: number; search?: string; userType?: string; accountStatus?: string }) {
  return useQuery<Paginated<AdminUser>>({
    queryKey: ['admin', 'users', params],
    queryFn: () => api.get('/admin/users', { params }).then((r) => r.data),
  })
}

export function useUpdateAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: AdminUpdateUserInput & { id: string }) =>
      api.patch(`/admin/users/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export interface AdminFamilyMember {
  id: string
  userId: string
  familyId: string
  familyRole: 'FAMILY_MANAGER' | 'DEPUTY_MEMBER' | 'FAMILY_MEMBER'
  relationship?: string | null
  status: 'ACTIVE' | 'INACTIVE' | 'REMOVED'
  displayName?: string | null
  user?: { id: string; fullName: string; email: string } | null
}

export interface AdminFamily {
  id: string
  name: string
  description?: string | null
  avatarUrl?: string | null
  status: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'EXPIRED'
  activationStatus?: 'ACTIVE' | 'PENDING' | 'FAILED'
  createdAt?: string
  members?: AdminFamilyMember[]
  _count?: { members: number }
}

export interface AdminUpdateFamilyInput {
  name?: string
  description?: string
  avatarUrl?: string
  status?: 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'EXPIRED'
  activationStatus?: 'ACTIVE' | 'PENDING' | 'FAILED'
}

export function useAdminFamilies(params?: { page?: number; limit?: number; search?: string; status?: string }) {
  return useQuery<Paginated<AdminFamily>>({
    queryKey: ['admin', 'families', params],
    queryFn: () => api.get('/admin/families', { params }).then((r) => r.data),
  })
}

export function useAdminFamily(id: string | null) {
  return useQuery<AdminFamily>({
    queryKey: ['admin', 'family', id],
    queryFn: () => api.get(`/admin/families/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useUpdateAdminFamily() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: AdminUpdateFamilyInput & { id: string }) =>
      api.patch(`/admin/families/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'families'] }),
  })
}

export interface AdminUpdateMemberInput {
  familyRole?: 'FAMILY_MANAGER' | 'DEPUTY_MEMBER' | 'FAMILY_MEMBER'
  relationship?: 'FATHER' | 'MOTHER' | 'SPOUSE' | 'CHILD' | 'SISTER' | 'BROTHER' | 'GRANDPARENT' | 'OTHER'
  status?: 'ACTIVE' | 'INACTIVE' | 'REMOVED'
  displayName?: string
}

export function useAdminFamilyMember(id: string | null) {
  return useQuery<AdminFamilyMember>({
    queryKey: ['admin', 'family-members', id],
    queryFn: () => api.get(`/admin/family-members/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useAdminFamilyMembers(params?: { page?: number; limit?: number; familyId?: string; userId?: string; familyRole?: string; status?: string }) {
  return useQuery<Paginated<AdminFamilyMember>>({
    queryKey: ['admin', 'family-members', params],
    queryFn: () => api.get('/admin/family-members', { params }).then((r) => r.data),
    // enabled when: no params (fetch all), OR specific familyId/userId, OR explicit limit for admin listing
    enabled: params == null || !!params?.familyId || !!params?.userId || params?.limit !== undefined,
  })
}


export function useUpdateAdminFamilyMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: AdminUpdateMemberInput & { id: string }) =>
      api.patch(`/admin/family-members/${id}`, data).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'family-members'] })
      qc.invalidateQueries({ queryKey: ['admin', 'families'] })
      qc.invalidateQueries({ queryKey: ['admin', 'family'] })
    },
  })
}

export interface SubscriptionPlan {
  id: string
  planCode: string
  name: string
  annualPrice: number | string
  maxMembers: number | null
  storageLimit: number
  stripePriceId?: string | null
  featureAccess?: Record<string, unknown> | null
  isActive: boolean
  _count?: { families: number }
}

export interface SubscriptionPlanInput {
  planCode: string
  name: string
  annualPrice: number
  maxMembers?: number
  storageLimit: number
  stripePriceId?: string
  featureAccess?: Record<string, unknown>
  isActive?: boolean
}

export function useAdminSubscriptionPlan(id: string | null) {
  return useQuery<SubscriptionPlan>({
    queryKey: ['admin', 'subscription-plans', id],
    queryFn: () => api.get(`/admin/subscription-plans/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useAdminSubscriptionPlans(params?: { page?: number; limit?: number; search?: string; isActive?: boolean }) {
  return useQuery<Paginated<SubscriptionPlan>>({
    queryKey: ['admin', 'subscription-plans', params],
    queryFn: () => api.get('/admin/subscription-plans', { params }).then((r) => r.data),
  })
}

export function useCreateSubscriptionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: SubscriptionPlanInput) => api.post('/admin/subscription-plans', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscription-plans'] }),
  })
}

export function useUpdateSubscriptionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...data }: Partial<SubscriptionPlanInput> & { id: string }) =>
      api.patch(`/admin/subscription-plans/${id}`, data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscription-plans'] }),
  })
}

export function useDeleteSubscriptionPlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/subscription-plans/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'subscription-plans'] }),
  })
}

export interface AdminJoinRequest {
  id: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELED' | string
  message?: string | null
  familyId: string
  createdAt?: string
  user?: {
    fullName?: string
    email?: string
  } | null
}

export function useAdminJoinRequest(id: string | null) {
  return useQuery<AdminJoinRequest>({
    queryKey: ['admin', 'join-requests', id],
    queryFn: () => api.get(`/admin/join-requests/${id}`).then((r) => r.data),
    enabled: !!id,
  })
}

export function useAdminJoinRequests(params?: { page?: number; limit?: number; status?: string; familyId?: string }) {
  return useQuery<Paginated<AdminJoinRequest>>({
    queryKey: ['admin', 'join-requests', params],
    queryFn: () => api.get('/admin/join-requests', { params }).then((r) => r.data),
  })
}

export function useDeleteAdminJoinRequest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/join-requests/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'join-requests'] }),
  })
}

export function useDeleteAdminUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/users/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  })
}

export function useDeleteAdminFamily() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/families/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'families'] }),
  })
}

export function useDeleteAdminFamilyMember() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete(`/admin/family-members/${id}`).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'family-members'] })
      qc.invalidateQueries({ queryKey: ['admin', 'family'] })
      qc.invalidateQueries({ queryKey: ['admin', 'families'] })
    },
  })
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export interface AdminDashboardSummary {
  users?: { total: number; active: number; locked: number; disabled: number; pending: number }
  families?: { total: number; active: number; pending: number; suspended: number; expired: number }
  subscriptions?: { free: number; monthly: number; yearly: number; active: number; expired: number; canceled: number; pastDue: number }
  payments?: { totalPaidAmount: number; paidCount: number; failedCount: number; pendingCount: number; currency: string }
  [key: string]: unknown
}

export function useAdminDashboardSummary() {
  return useQuery<AdminDashboardSummary>({
    queryKey: ['admin', 'dashboard', 'summary'],
    queryFn: () => api.get('/admin/dashboard/summary').then((r) => r.data),
    staleTime: 30_000,
  })
}

// ─── Revenue ─────────────────────────────────────────────────────────────────

export interface AdminRevenueSummary {
  totalRevenue?: number
  currentMonthRevenue?: number
  monthlyPlanRevenue?: number
  yearlyPlanRevenue?: number
  paidPayments?: number
  failedPayments?: number
  pendingPayments?: number
  currency?: string
  [key: string]: unknown
}

export interface AdminRevenueMonthlyItem {
  month?: string
  totalRevenue?: number
  monthlyRevenue?: number
  yearlyRevenue?: number
  paidCount?: number
  currency?: string
  [key: string]: unknown
}

export function useAdminRevenueSummary() {
  return useQuery<AdminRevenueSummary>({
    queryKey: ['admin', 'revenue', 'summary'],
    queryFn: () => api.get('/admin/revenue/summary').then((r) => r.data),
  })
}

export function useAdminRevenueMonthly(params?: { from?: string; to?: string; planCode?: string }) {
  return useQuery<AdminRevenueMonthlyItem[]>({
    queryKey: ['admin', 'revenue', 'monthly', params],
    queryFn: () => api.get('/admin/revenue/monthly', { params }).then((r) => r.data),
  })
}

// ─── Payments ────────────────────────────────────────────────────────────────

export interface AdminPayment {
  id: string
  familyId?: string
  planCode?: string
  amount?: number
  status: 'PAID' | 'FAILED' | 'PENDING' | string
  createdAt?: string
  [key: string]: unknown
}

export function useAdminPayments(params?: { page?: number; limit?: number; status?: string; planCode?: string }) {
  return useQuery<Paginated<AdminPayment>>({
    queryKey: ['admin', 'payments', params],
    queryFn: () => api.get('/admin/payments', { params }).then((r) => r.data),
  })
}

// ─── Audit Logs ──────────────────────────────────────────────────────────────

export interface AdminAuditLog {
  id: string
  adminUserId?: string
  action: string
  targetType?: string
  targetId?: string
  result: 'SUCCESS' | 'FAILED' | string
  createdAt?: string
  details?: Record<string, unknown>
  adminUser?: { fullName?: string; email?: string }
}

export type AuditLogAction =
  | 'ADMIN_USER_LOCK' | 'ADMIN_USER_UNLOCK'
  | 'ADMIN_SUBSCRIPTION_MANUAL_RENEW' | 'ADMIN_SUBSCRIPTION_STATUS_UPDATE' | 'ADMIN_SUBSCRIPTION_STRIPE_SYNC'
  | 'ADMIN_PROVISIONING_RETRY'
  | 'ADMIN_CONTAINER_STATS_VIEW' | 'ADMIN_CONTAINER_LOGS_VIEW'
  | 'ADMIN_BACKUP_CREATE' | 'ADMIN_RESTORE_REQUEST_CREATE' | 'ADMIN_RESTORE_CONFIRM'

export type AuditLogTargetType = 'USER' | 'FAMILY' | 'SUBSCRIPTION' | 'PROVISIONING' | 'CONTAINER' | 'BACKUP' | 'RESTORE' | 'SYSTEM'

export function useAdminAuditLogs(params?: {
  page?: number; limit?: number
  adminUserId?: string; action?: AuditLogAction; targetType?: AuditLogTargetType
  targetId?: string; result?: 'SUCCESS' | 'FAILED'; from?: string; to?: string
}) {
  return useQuery<Paginated<AdminAuditLog>>({
    queryKey: ['admin', 'audit-logs', params],
    queryFn: () => api.get('/admin/audit-logs', { params }).then((r) => r.data),
  })
}

export function useAdminAuditLog(auditLogId: string | null) {
  return useQuery<AdminAuditLog>({
    queryKey: ['admin', 'audit-logs', auditLogId],
    queryFn: () => api.get(`/admin/audit-logs/${auditLogId}`).then((r) => r.data),
    enabled: !!auditLogId,
  })
}

// ─── System ───────────────────────────────────────────────────────────────────

export interface AdminSystemHealth {
  backend?: { status: string; uptimeSeconds: number; timestamp: string; version: string }
  database?: { status: string; type: string; error?: string }
  message?: string
  nodeEnv?: string
  platform?: string
  uptimeSeconds?: number
  cpu?: { cores?: number; loadAverage?: number[] }
  memory?: { rss?: number; heapUsed?: number; heapTotal?: number; systemFree?: number; systemTotal?: number }
  uploads?: { files?: number; bytes?: number }
  timestamp?: string
  [key: string]: unknown
}

export interface AdminSystemRuntime {
  nodeVersion?: string
  pid?: number
  uptime?: number
  memoryUsage?: { rss?: number; heapUsed?: number; heapTotal?: number }
  [key: string]: unknown
}

export interface AdminInfraHost {
  cpu?: { cores?: number; model?: string; loadAverage?: number[] }
  memory?: { total?: number; free?: number; used?: number }
  disk?: { total?: number; free?: number; used?: number }
  os?: { platform?: string; hostname?: string; uptime?: number }
  [key: string]: unknown
}

export interface AdminDockerContainer {
  ID?: string; Names?: string; Image?: string; State?: string; Status?: string
  containerId?: string; name?: string; image?: string; state?: string; status?: string
  [key: string]: unknown
}

export function useAdminSystemHealth() {
  return useQuery<AdminSystemHealth>({
    queryKey: ['admin', 'system', 'health'],
    queryFn: () => api.get('/admin/system/health').then((r) => r.data),
    refetchInterval: 30_000,
  })
}

export function useAdminSystemRuntime() {
  return useQuery<AdminSystemRuntime>({
    queryKey: ['admin', 'system', 'runtime'],
    queryFn: () => api.get('/admin/system/runtime').then((r) => r.data),
    refetchInterval: 30_000,
  })
}

export function useAdminInfraHost() {
  return useQuery<AdminInfraHost>({
    queryKey: ['admin', 'infrastructure', 'host'],
    queryFn: () => api.get('/admin/infrastructure/host').then((r) => r.data),
    refetchInterval: 30_000,
  })
}

export function useAdminDockerContainers() {
  return useQuery<AdminDockerContainer[]>({
    queryKey: ['admin', 'infrastructure', 'docker', 'containers'],
    queryFn: () => api.get('/admin/infrastructure/docker/containers').then((r) => r.data),
    refetchInterval: 30_000,
  })
}

export function useAdminDockerContainerStats(containerId: string | null) {
  return useQuery<{ [key: string]: unknown }>({
    queryKey: ['admin', 'infrastructure', 'docker', 'stats', containerId],
    queryFn: () => api.get(`/admin/infrastructure/docker/containers/${containerId}/stats`).then((r) => r.data),
    enabled: !!containerId,
    refetchInterval: 10_000,
  })
}

export function useAdminDockerContainerLogs(containerId: string | null, params?: { tail?: number; timestamps?: boolean; stdout?: boolean; stderr?: boolean; since?: string; until?: string }) {
  return useQuery<{ logs?: string; [key: string]: unknown }>({
    queryKey: ['admin', 'infrastructure', 'docker', 'logs', containerId, params],
    queryFn: () => api.get(`/admin/infrastructure/docker/containers/${containerId}/logs`, { params }).then((r) => r.data),
    enabled: !!containerId,
  })
}

// ─── Backup / Restore ────────────────────────────────────────────────────────

export type BackupTarget = 'DATABASE' | 'SYSTEM_CONFIG' | 'FULL_SYSTEM'

export interface AdminBackup {
  id: string; target?: BackupTarget; status?: string; note?: string; createdAt?: string
  [key: string]: unknown
}

export interface AdminRestore {
  id: string; backupId?: string; target?: BackupTarget; status?: string; note?: string; createdAt?: string
  [key: string]: unknown
}

export function useAdminBackups(params?: { page?: number; limit?: number; status?: string; target?: BackupTarget }) {
  return useQuery<Paginated<AdminBackup>>({
    queryKey: ['admin', 'backups', params],
    queryFn: () => api.get('/admin/backups', { params }).then((r) => r.data),
  })
}

export function useAdminBackup(backupId: string | null) {
  return useQuery<AdminBackup>({
    queryKey: ['admin', 'backups', backupId],
    queryFn: () => api.get(`/admin/backups/${backupId}`).then((r) => r.data),
    enabled: !!backupId,
  })
}

export function useCreateAdminBackup() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { target: BackupTarget; note?: string }) =>
      api.post('/admin/backups', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'backups'] }),
  })
}

export function useAdminRestores() {
  return useQuery<Paginated<AdminRestore>>({
    queryKey: ['admin', 'restores'],
    queryFn: () => api.get('/admin/restores').then((r) => r.data),
  })
}

export function useAdminRestore(restoreId: string | null) {
  return useQuery<AdminRestore>({
    queryKey: ['admin', 'restores', restoreId],
    queryFn: () => api.get(`/admin/restores/${restoreId}`).then((r) => r.data),
    enabled: !!restoreId,
  })
}

export function useCreateAdminRestore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (data: { backupId: string; target: BackupTarget; note?: string }) =>
      api.post('/admin/restores', data).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'restores'] }),
  })
}

export function useConfirmAdminRestore() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (restoreId: string) =>
      api.post(`/admin/restores/${restoreId}/confirm`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'restores'] }),
  })
}

// ─── Family Subscription Management ─────────────────────────────────────────

export interface AdminFamilySubscription {
  id?: string; familyId?: string; planCode?: string; status?: string
  currentPeriodStart?: string; currentPeriodEnd?: string
  monthsToAdd?: number; stripeSubscriptionId?: string
  [key: string]: unknown
}

export interface AdminFamilyActivationStatus {
  status?: string; workspaceUrl?: string; provisionedAt?: string
  lastProvisioningLog?: { result?: string; message?: string; createdAt?: string }
  [key: string]: unknown
}

export interface AdminProvisioningLog {
  id: string; familyId?: string; result?: string; message?: string; createdAt?: string
  [key: string]: unknown
}

export function useAdminFamilySubscription(familyId: string | null) {
  return useQuery<AdminFamilySubscription>({
    queryKey: ['admin', 'family-subscription', familyId],
    queryFn: () => api.get(`/admin/families/${familyId}/subscription`).then((r) => r.data),
    enabled: !!familyId,
  })
}

export function useAdminFamilyActivationStatus(familyId: string | null) {
  return useQuery<AdminFamilyActivationStatus>({
    queryKey: ['admin', 'family-activation', familyId],
    queryFn: () => api.get(`/admin/families/${familyId}/activation-status`).then((r) => r.data),
    enabled: !!familyId,
  })
}

export function useAdminFamilyProvisioningLogs(familyId: string | null) {
  return useQuery<Paginated<AdminProvisioningLog>>({
    queryKey: ['admin', 'family-provisioning-logs', familyId],
    queryFn: () => api.get(`/admin/families/${familyId}/provisioning-logs`).then((r) => r.data),
    enabled: !!familyId,
  })
}

export function useAdminProvisioningLogs(params?: {
  page?: number; limit?: number; status?: string; actionType?: string
  familyId?: string; from?: string; to?: string
}) {
  return useQuery<Paginated<AdminProvisioningLog>>({
    queryKey: ['admin', 'provisioning-logs', params],
    queryFn: () => api.get('/admin/provisioning-logs', { params }).then((r) => r.data),
  })
}

export function useSyncStripeFamilySubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (familyId: string) =>
      api.post(`/admin/families/${familyId}/subscription/sync-stripe`).then((r) => r.data),
    onSuccess: (_, familyId) => {
      qc.invalidateQueries({ queryKey: ['admin', 'family-subscription', familyId] })
    },
  })
}

export function useManualRenewFamilySubscription() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ familyId, ...data }: { familyId: string; planCode: string; monthsToAdd: number; reason?: string }) =>
      api.post(`/admin/families/${familyId}/subscription/manual-renew`, data).then((r) => r.data),
    onSuccess: (_, { familyId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'family-subscription', familyId] })
      qc.invalidateQueries({ queryKey: ['admin', 'families'] })
    },
  })
}

export function useUpdateFamilySubscriptionStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ familyId, ...data }: { familyId: string; status: 'ACTIVE' | 'PAST_DUE' | 'CANCELED'; reason?: string }) =>
      api.patch(`/admin/families/${familyId}/subscription/status`, data).then((r) => r.data),
    onSuccess: (_, { familyId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'family-subscription', familyId] })
      qc.invalidateQueries({ queryKey: ['admin', 'families'] })
    },
  })
}

export function useRetryFamilyProvisioning() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ familyId, ...data }: { familyId: string; simulateResult?: 'SUCCESS' | 'FAILED'; message?: string }) =>
      api.post(`/admin/families/${familyId}/provisioning/retry`, data).then((r) => r.data),
    onSuccess: (_, { familyId }) => {
      qc.invalidateQueries({ queryKey: ['admin', 'family-activation', familyId] })
      qc.invalidateQueries({ queryKey: ['admin', 'family-provisioning-logs', familyId] })
    },
  })
}
