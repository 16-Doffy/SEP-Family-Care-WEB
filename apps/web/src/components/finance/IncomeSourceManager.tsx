/**
 * @file IncomeSourceManager.tsx
 * @description Quản lý nguồn thu nhập (IncomeSource) của một thành viên.
 * Dùng trong trang `/family` chi tiết member và trong dialog cài đặt cá nhân.
 */
'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Trash2, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCurrency } from '@/lib/utils'
import {
  useCreateIncomeSource,
  useDeleteIncomeSource,
  useIncomeSources,
  type IncomeSource,
} from '@/hooks/useFinance'

const SOURCE_LABELS: Record<IncomeSource['sourceType'], string> = {
  SALARY: 'Lương',
  BUSINESS: 'Kinh doanh',
  INVESTMENT: 'Đầu tư',
  ALLOWANCE: 'Trợ cấp / Lương hưu',
  RENTAL: 'Cho thuê',
  FREELANCE: 'Freelance',
  OTHER: 'Khác',
}

export function IncomeSourceManager({ memberId, canEdit }: { memberId: string; canEdit: boolean }) {
  const { data: sources = [] } = useIncomeSources(memberId)
  const create = useCreateIncomeSource(memberId)
  const del = useDeleteIncomeSource()

  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<{ label: string; sourceType: IncomeSource['sourceType']; amountPerMonth: string }>({
    label: '',
    sourceType: 'SALARY',
    amountPerMonth: '',
  })

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium">Nguồn thu nhập</p>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={() => setOpen(!open)} className="gap-1">
            <Plus className="w-3.5 h-3.5" />Thêm
          </Button>
        )}
      </div>

      {open && canEdit && (
        <div className="border rounded-lg p-3 space-y-2 bg-gray-50">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Mô tả</Label>
              <Input
                placeholder="Lương cty ABC"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Loại</Label>
              <Select
                value={form.sourceType}
                onValueChange={(v) => setForm({ ...form, sourceType: v as IncomeSource['sourceType'] })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(SOURCE_LABELS) as [IncomeSource['sourceType'], string][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Bình quân / tháng (VND)</Label>
            <Input
              type="number"
              min={0}
              value={form.amountPerMonth}
              onChange={(e) => setForm({ ...form, amountPerMonth: e.target.value })}
              placeholder="15000000"
            />
          </div>
          <Button
            size="sm"
            disabled={!form.label || !form.amountPerMonth || create.isPending}
            onClick={async () => {
              await create.mutateAsync({
                label: form.label,
                sourceType: form.sourceType,
                amountPerMonth: Number(form.amountPerMonth),
              })
              toast.success('Đã thêm nguồn thu')
              setForm({ label: '', sourceType: 'SALARY', amountPerMonth: '' })
              setOpen(false)
            }}
          >
            {create.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Lưu
          </Button>
        </div>
      )}

      {sources.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Chưa có nguồn thu. {canEdit ? 'Bấm "Thêm" để bắt đầu.' : ''}
        </p>
      ) : (
        <div className="space-y-1">
          {sources.map((s) => (
            <div key={s.id} className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{s.label}</p>
                <p className="text-xs text-muted-foreground">{SOURCE_LABELS[s.sourceType]}</p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-green-600">{formatCurrency(Number(s.amountPerMonth))}/tháng</p>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
