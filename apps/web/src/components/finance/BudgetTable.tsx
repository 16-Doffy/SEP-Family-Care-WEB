/**
 * @file BudgetTable.tsx
 * @description Bảng ngân sách: liệt kê thành viên + thu/chi dự kiến và thực tế,
 * cho phép PARENT chỉnh chi chung gia đình (FamilyBudget) qua dialog phụ.
 */
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { formatCurrency, getInitials, cn } from '@/lib/utils'
import { Edit2, Plus, Trash2, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useUpsertBudget,
  useUpdateMemberBudget,
  type MonthlySummary,
} from '@/hooks/useFinance'

interface Props {
  summary: MonthlySummary
  isParent: boolean
  currentMemberId?: string
}

export function BudgetTable({ summary, isParent, currentMemberId }: Props) {
  const [familyBudgetOpen, setFamilyBudgetOpen] = useState(false)
  const [memberDialog, setMemberDialog] = useState<{
    memberId: string
    occupation: string
    plannedPersonalExpense: number
    personalSpendingLimit: number
  } | null>(null)

  const upsert = useUpsertBudget()
  const updateMember = useUpdateMemberBudget()

  const totalPlannedIncome = summary.planned.income
  const totalPlannedExpense = summary.planned.totalExpense

  // FAMILY_MEMBER chỉ thấy ngân sách của chính mình — không xem dữ liệu người khác
  const visibleMembers = isParent
    ? summary.perMember
    : summary.perMember.filter((m) => m.memberId === currentMemberId)

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Chi chung gia đình</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Tổng dự kiến: <span className="font-semibold text-gray-700">{formatCurrency(summary.planned.sharedExpense)}</span>
              {' · '}Thực tế: <span className="font-semibold text-gray-700">{formatCurrency(summary.actual.sharedExpense)}</span>
            </p>
          </div>
          {isParent && (
            <Button variant="outline" size="sm" onClick={() => setFamilyBudgetOpen(true)} className="gap-1">
              <Edit2 className="w-3.5 h-3.5" />Sửa
            </Button>
          )}
        </CardHeader>
        <CardContent className="pt-0">
          {summary.budget?.categories && summary.budget.categories.length > 0 ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {summary.budget.categories.map((c) => (
                <div key={c.id} className="border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">{c.name}</p>
                  <p className="text-sm font-semibold mt-1">{formatCurrency(Number(c.amount))}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Chưa thiết lập chi chung dự kiến. {isParent && 'Bấm "Sửa" để thêm danh mục (tiền nhà, điện, nước...)'}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {isParent ? 'Ngân sách từng thành viên' : 'Ngân sách của tôi'}
          </CardTitle>
          {isParent && (
            <p className="text-xs text-muted-foreground">
              Tổng thu dự kiến {formatCurrency(totalPlannedIncome)} – tổng chi dự kiến {formatCurrency(totalPlannedExpense)}
            </p>
          )}
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left px-4 py-2 font-medium">Thành viên</th>
                <th className="text-left px-4 py-2 font-medium">Nghề</th>
                <th className="text-right px-4 py-2 font-medium">Thu dự kiến</th>
                <th className="text-right px-4 py-2 font-medium">Chi riêng dự kiến</th>
                <th className="text-right px-4 py-2 font-medium">Chi thực tế tháng</th>
                <th className="text-right px-4 py-2 font-medium">Hạn mức</th>
                <th className="text-right px-4 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {visibleMembers.map((m) => {
                const canEdit = isParent || m.memberId === currentMemberId
                return (
                  <tr key={m.memberId} className={cn('border-t', m.isOverLimit && 'bg-red-50')}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Avatar className="w-7 h-7">
                          <AvatarFallback className="text-[11px]">{getInitials(m.displayName)}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium leading-tight">{m.displayName}</p>
                          {!m.hasIncome && (
                            <p className="text-[10px] text-muted-foreground">Chưa kiếm ra tiền</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{m.occupation ?? '—'}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-green-600">
                      {formatCurrency(m.plannedIncome)}
                    </td>
                    <td className="px-4 py-2.5 text-right">{formatCurrency(m.plannedPersonalExpense)}</td>
                    <td className={cn('px-4 py-2.5 text-right', m.isOverLimit && 'text-red-600 font-semibold')}>
                      {formatCurrency(m.actualPersonalExpense)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {m.personalSpendingLimit ? formatCurrency(m.personalSpendingLimit) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {canEdit && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setMemberDialog({
                              memberId: m.memberId,
                              occupation: m.occupation ?? '',
                              plannedPersonalExpense: m.plannedPersonalExpense,
                              personalSpendingLimit: m.personalSpendingLimit ?? 0,
                            })
                          }
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <FamilyBudgetDialog
        open={familyBudgetOpen}
        onOpenChange={setFamilyBudgetOpen}
        summary={summary}
        onSubmit={async (categories) => {
          await upsert.mutateAsync({
            year: summary.year,
            month: summary.month,
            categories,
          })
          toast.success('Đã lưu chi chung gia đình')
          setFamilyBudgetOpen(false)
        }}
        loading={upsert.isPending}
      />

      <Dialog open={!!memberDialog} onOpenChange={() => setMemberDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cập nhật ngân sách cá nhân</DialogTitle>
          </DialogHeader>
          {memberDialog && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label>Nghề nghiệp</Label>
                <Input
                  placeholder="Kỹ sư, học sinh..."
                  value={memberDialog.occupation}
                  onChange={(e) => setMemberDialog({ ...memberDialog, occupation: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label>Chi cá nhân dự kiến (VND/tháng)</Label>
                <Input
                  type="number"
                  min={0}
                  value={memberDialog.plannedPersonalExpense}
                  onChange={(e) =>
                    setMemberDialog({ ...memberDialog, plannedPersonalExpense: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Hạn mức cảnh báo (VND/tháng, 0 = không cảnh báo)</Label>
                <Input
                  type="number"
                  min={0}
                  value={memberDialog.personalSpendingLimit}
                  onChange={(e) =>
                    setMemberDialog({ ...memberDialog, personalSpendingLimit: Number(e.target.value) })
                  }
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setMemberDialog(null)}>
                  Hủy
                </Button>
                <Button
                  onClick={async () => {
                    await updateMember.mutateAsync({
                      memberId: memberDialog.memberId,
                      data: {
                        occupation: memberDialog.occupation || undefined,
                        plannedPersonalExpense: memberDialog.plannedPersonalExpense,
                        personalSpendingLimit:
                          memberDialog.personalSpendingLimit > 0 ? memberDialog.personalSpendingLimit : null,
                      },
                    })
                    toast.success('Đã cập nhật ngân sách')
                    setMemberDialog(null)
                  }}
                  disabled={updateMember.isPending}
                >
                  {updateMember.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Lưu
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function FamilyBudgetDialog({
  open,
  onOpenChange,
  summary,
  onSubmit,
  loading,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  summary: MonthlySummary
  onSubmit: (categories: { name: string; amount: number }[]) => void
  loading: boolean
}) {
  const initial =
    summary.budget?.categories.map((c) => ({ name: c.name, amount: Number(c.amount) })) ?? [
      { name: 'Tiền nhà', amount: 0 },
      { name: 'Điện', amount: 0 },
      { name: 'Nước', amount: 0 },
      { name: 'Ăn uống', amount: 0 },
    ]

  const [cats, setCats] = useState(initial)

  // Reset cats khi dialog mở
  if (open && cats.length === 0 && initial.length > 0) {
    setCats(initial)
  }

  const total = cats.reduce((s, c) => s + (Number(c.amount) || 0), 0)

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (v) setCats(initial)
        onOpenChange(v)
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Chi chung gia đình tháng {summary.month}/{summary.year}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {cats.map((c, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 space-y-1">
                <Label className="text-xs">Danh mục</Label>
                <Input
                  value={c.name}
                  onChange={(e) => {
                    const next = [...cats]
                    next[i] = { ...next[i], name: e.target.value }
                    setCats(next)
                  }}
                />
              </div>
              <div className="w-36 space-y-1">
                <Label className="text-xs">Số tiền</Label>
                <Input
                  type="number"
                  min={0}
                  value={c.amount}
                  onChange={(e) => {
                    const next = [...cats]
                    next[i] = { ...next[i], amount: Number(e.target.value) }
                    setCats(next)
                  }}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setCats(cats.filter((_, idx) => idx !== i))}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setCats([...cats, { name: '', amount: 0 }])} className="gap-1">
            <Plus className="w-3.5 h-3.5" />Thêm danh mục
          </Button>
        </div>
        <p className="text-sm">
          Tổng: <span className="font-semibold">{formatCurrency(total)}</span>
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Hủy
          </Button>
          <Button
            onClick={() => onSubmit(cats.filter((c) => c.name.trim().length > 0))}
            disabled={loading}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
