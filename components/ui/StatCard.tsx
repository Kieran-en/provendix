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
  emerald: { icon: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400', accent: 'bg-emerald-500' },
  blue: { icon: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400', accent: 'bg-blue-500' },
  amber: { icon: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400', accent: 'bg-amber-500' },
  rose: { icon: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400', accent: 'bg-rose-500' },
}

export default function StatCard({ label, value, icon: Icon, trend, color = 'emerald' }: StatCardProps) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:-translate-y-0.5 hover:shadow-lg hover:shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:hover:shadow-none sm:p-5">
      <span className={cn('absolute inset-x-0 top-0 h-0.5 opacity-80', colorMap[color].accent)} />
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400 sm:text-sm">{label}</span>
        <div className={cn('shrink-0 rounded-xl p-2', colorMap[color].icon)}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <p className="tabular-nums text-xl font-extrabold tracking-tight text-slate-950 dark:text-white sm:text-2xl">{value}</p>
      {trend && <p className="mt-1 text-[11px] leading-4 text-slate-400 dark:text-slate-500 sm:text-xs">{trend}</p>}
    </div>
  )
}
