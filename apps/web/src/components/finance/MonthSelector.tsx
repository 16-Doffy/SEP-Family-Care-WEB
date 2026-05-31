/**
 * @file MonthSelector.tsx
 * @description Thanh chọn tháng dùng chung cho tab tài chính (summary,
 * budget, expense log). Cho phép điều hướng ←/→ và quay về tháng hiện tại.
 */
'use client'

import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'

interface Props {
  year: number
  month: number
  onChange: (year: number, month: number) => void
}

export function MonthSelector({ year, month, onChange }: Props) {
  const now = new Date()
  const isCurrent = year === now.getFullYear() && month === now.getMonth() + 1

  const shift = (delta: number) => {
    const d = new Date(year, month - 1 + delta, 1)
    onChange(d.getFullYear(), d.getMonth() + 1)
  }

  return (
    <div className="inline-flex items-center gap-1 bg-white border rounded-lg px-2 py-1">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(-1)}>
        <ChevronLeft className="w-4 h-4" />
      </Button>
      <span className="text-sm font-medium min-w-[110px] text-center flex items-center justify-center gap-1.5">
        <CalendarDays className="w-3.5 h-3.5 text-muted-foreground" />
        Tháng {month}/{year}
      </span>
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => shift(1)} disabled={isCurrent}>
        <ChevronRight className="w-4 h-4" />
      </Button>
      {!isCurrent && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs text-blue-600"
          onClick={() => onChange(now.getFullYear(), now.getMonth() + 1)}
        >
          Hôm nay
        </Button>
      )}
    </div>
  )
}
