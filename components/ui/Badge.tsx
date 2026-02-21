import { cn } from '@/lib/utils'

type Variant = 'success' | 'warning' | 'danger' | 'info' | 'default'

interface BadgeProps {
  label: string
  variant?: Variant
  className?: string
}

const variantMap: Record<Variant, string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-50 text-amber-700 border-amber-200',
  danger: 'bg-rose-50 text-rose-700 border-rose-200',
  info: 'bg-blue-50 text-blue-700 border-blue-200',
  default: 'bg-slate-100 text-slate-600 border-slate-200',
}

export default function Badge({ label, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border',
        variantMap[variant],
        className
      )}
    >
      {label}
    </span>
  )
}
