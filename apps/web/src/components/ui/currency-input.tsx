'use client'
import { forwardRef, useState } from 'react'
import { cn } from '@/lib/utils'

interface CurrencyInputProps {
  value: string
  onChange: (raw: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  id?: string
}

/** Input nhập số tiền VND — hiển thị định dạng 10.000.000, trả về chuỗi số thuần (không dấu chấm). */
const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, placeholder = '0', className, disabled, id }, ref) => {
    const [focused, setFocused] = useState(false)

    const raw = value.replace(/\D/g, '')
    const formatted = raw ? Number(raw).toLocaleString('vi-VN') : ''

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '')
      onChange(digits)
    }

    return (
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type="text"
          inputMode="numeric"
          disabled={disabled}
          value={focused ? raw : formatted}
          onChange={handleChange}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm',
            'placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            'disabled:cursor-not-allowed disabled:opacity-50',
            className,
          )}
        />
        {!focused && raw && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
            đ
          </span>
        )}
      </div>
    )
  },
)
CurrencyInput.displayName = 'CurrencyInput'
export { CurrencyInput }
