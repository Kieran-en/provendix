import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d)
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

export type CurrencyCode = 'XAF' | 'XOF'

const DEFAULT_CURRENCY: CurrencyCode = 'XAF'

export function getCurrencyCode(): CurrencyCode {
  if (typeof window === 'undefined') return DEFAULT_CURRENCY
  const stored = localStorage.getItem('provendix_currency_code')
  return stored === 'XOF' ? 'XOF' : 'XAF'
}

export function setCurrencyCode(code: string): void {
  if (typeof window !== 'undefined' && (code === 'XAF' || code === 'XOF')) {
    localStorage.setItem('provendix_currency_code', code)
  }
}

export function getCurrencyLabel(): string {
  return 'FCFA'
}

export function formatCurrency(amount: number): string {
  const currency = getCurrencyCode()
  const locale = currency === 'XOF' ? 'fr-SN' : 'fr-CM'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg == null || isNaN(kg)) return '—'
  if (kg >= 1000) return `${(kg / 1000).toFixed(2)} t`
  return `${kg.toFixed(2)} kg`
}
