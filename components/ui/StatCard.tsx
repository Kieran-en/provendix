import { cn } from '@/lib/utils'
import { LucideIcon } from 'lucide-react'

interface StatCardProps {
  label: string
  value: string | number
  icon: LucideIcon
  trend?: string
  color?: 'emerald' | 'blue' | 'amber' | 'rose'
}

const colorMap = {
  emerald: 'bg-emerald-50 text-emerald-600',
  blue: 'bg-blue-50 text-blue-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
}

export default function StatCard({ label, value, icon: Icon, trend, color = 'emerald' }: StatCardProps) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className={cn('p-2 rounded-lg', colorMap[color])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {trend && <p className="text-xs text-slate-400 mt-1">{trend}</p>}
    </div>
  )
}
