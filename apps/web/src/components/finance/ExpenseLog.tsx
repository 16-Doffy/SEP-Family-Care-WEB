/**
 * @file ExpenseLog.tsx
 * @description Tab "Ghi chép" — form ghi chi tiêu cá nhân (mọi member) và chi
 * chung gia đình (PARENT) + danh sách 30 mục gần nhất.
 */
'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { Loader2, Receipt } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  useCreateFamilyExpense,
  useCreatePersonalExpense,
  useFamilyExpenses,
  usePersonalExpenses,
} from '@/hooks/useFinance'

const PERSONAL_CATEGORIES = ['Ăn vặt', 'Đi chơi', 'Mua sắm', 'Đi lại', 'Khác']
const FAMILY_CATEGORIES = ['Tiền nhà', 'Điện', 'Nước', 'Ăn uống', 'Internet', 'Khác']

export function ExpenseLog({ isParent }: { isParent: boolean }) {
  const [pAmount, setPAmount] = useState('')
  const [pCat, setPCat] = useState(PERSONAL_CATEGORIES[0])
  const [pNote, setPNote] = useState('')

  const [fAmount, setFAmount] = useState('')
  const [fCat, setFCat] = useState(FAMILY_CATEGORIES[0])
  const [fNote, setFNote] = useState('')

  const createPersonal = useCreatePersonalExpense()
  const createFamily = useCreateFamilyExpense()

  const { data: personal = [] } = usePersonalExpenses()
  const { data: family = [] } = useFamilyExpenses()

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Ghi chi cá nhân</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Số tiền (VND)</Label>
                <Input
                  type="number"
                  min={0}
                  value={pAmount}
                  onChange={(e) => setPAmount(e.target.value)}
                  placeholder="50000"
                />
              </div>
              <div className="space-y-1">
                <Label>Danh mục</Label>
                <Select value={pCat} onValueChange={setPCat}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PERSONAL_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Ghi chú</Label>
              <Input value={pNote} onChange={(e) => setPNote(e.target.value)} placeholder="Trà sữa..." />
            </div>
            <Button
              className="w-full"
              disabled={!pAmount || createPersonal.isPending}
              onClick={async () => {
                await createPersonal.mutateAsync({
                  amount: Number(pAmount),
                  category: pCat,
                  note: pNote || undefined,
                })
                toast.success('Đã ghi chi tiêu cá nhân')
                setPAmount('')
                setPNote('')
              }}
            >
              {createPersonal.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ghi
            </Button>
          </CardContent>
        </Card>

        {isParent && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Ghi chi chung gia đình</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label>Số tiền (VND)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={fAmount}
                    onChange={(e) => setFAmount(e.target.value)}
                    placeholder="5000000"
                  />
                </div>
                <div className="space-y-1">
                  <Label>Danh mục</Label>
                  <Select value={fCat} onValueChange={setFCat}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FAMILY_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label>Ghi chú</Label>
                <Input value={fNote} onChange={(e) => setFNote(e.target.value)} placeholder="Hoá đơn điện tháng 5..." />
              </div>
              <Button
                className="w-full"
                disabled={!fAmount || createFamily.isPending}
                onClick={async () => {
                  await createFamily.mutateAsync({
                    amount: Number(fAmount),
                    category: fCat,
                    note: fNote || undefined,
                  })
                  toast.success('Đã ghi chi chung gia đình')
                  setFAmount('')
                  setFNote('')
                }}
              >
                {createFamily.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}Ghi
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Nhật ký chi tiêu</CardTitle>
        </CardHeader>
        <CardContent>
          {personal.length === 0 && family.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              <Receipt className="w-8 h-8 mx-auto opacity-30" />
              <p className="text-sm mt-2">Chưa có khoản chi nào</p>
            </div>
          ) : (
            <div className="space-y-2">
              {[
                ...personal.map((e) => ({ ...e, kind: 'personal' as const })),
                ...family.map((e) => ({ ...e, kind: 'family' as const })),
              ]
                .sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
                .slice(0, 30)
                .map((e) => (
                  <div key={`${e.kind}-${e.id}`} className="flex items-start justify-between py-2 border-b last:border-0">
                    <div className="flex items-start gap-2">
                      <span
                        className={
                          e.kind === 'personal'
                            ? 'inline-block px-1.5 py-0.5 text-[10px] rounded bg-blue-50 text-blue-600 font-medium'
                            : 'inline-block px-1.5 py-0.5 text-[10px] rounded bg-amber-50 text-amber-600 font-medium'
                        }
                      >
                        {e.kind === 'personal' ? 'Cá nhân' : 'Gia đình'}
                      </span>
                      <div>
                        <p className="text-sm font-medium">{e.category}</p>
                        {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                        <p className="text-[10px] text-muted-foreground">{formatDateTime(e.occurredAt)}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-red-600">
                      -{formatCurrency(Number(e.amount))}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
