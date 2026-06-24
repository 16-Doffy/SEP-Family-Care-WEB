'use client'
import { Topbar } from '@/components/layout/Topbar'
import { Card, CardContent } from '@/components/ui/card'
import { BarChart3 } from 'lucide-react'

export default function RevenueAdminPage() {
  return (
    <div>
      <Topbar title="Thống kê doanh thu" backHref="/admin" />
      <div className="p-6">
        <Card>
          <CardContent className="pt-10 pb-10 flex flex-col items-center gap-4 text-center">
            <BarChart3 className="w-12 h-12 text-muted-foreground/40" />
            <div>
              <p className="font-medium text-muted-foreground">Chức năng đang phát triển</p>
              <p className="text-sm text-muted-foreground mt-1">
                Endpoint <code className="bg-muted px-1 rounded text-xs">/admin/revenue</code> chưa được triển khai trên backend.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
