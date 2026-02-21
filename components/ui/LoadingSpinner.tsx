import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface LoadingSpinnerProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizeMap = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
}

export default function LoadingSpinner({ className, size = 'md' }: LoadingSpinnerProps) {
  return (
    <div className={cn('flex items-center justify-center p-8', className)}>
      <Loader2 className={cn('animate-spin text-emerald-600', sizeMap[size])} />
    </div>
  )
}
