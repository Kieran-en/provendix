import { Wheat } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BrandMarkProps {
  className?: string
  iconClassName?: string
}

export default function BrandMark({ className, iconClassName }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex items-center justify-center overflow-hidden rounded-[0.9rem] bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-800 text-white shadow-[0_10px_24px_-12px_rgba(5,150,105,0.9)]',
        className
      )}
    >
      <span className="absolute -right-2 -top-3 h-8 w-8 rounded-full bg-amber-300/30" />
      <Wheat className={cn('relative h-5 w-5', iconClassName)} strokeWidth={2.2} />
    </span>
  )
}
