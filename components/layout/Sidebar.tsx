'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Boxes,
  ChevronRight,
  ClipboardList,
  Factory,
  FlaskConical,
  LayoutDashboard,
  LogOut,
  Package,
  PackagePlus,
  ScrollText,
  Settings,
  ShoppingCart,
  Truck,
  Users,
  Wheat,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import api from '@/lib/api'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import BrandMark from '@/components/ui/BrandMark'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

interface NavSection {
  label: string
  items: NavItem[]
}

const GERANT_NAV: NavSection[] = [
  {
    label: 'Espace de travail',
    items: [
      { label: 'Tableau de bord', href: '/', icon: LayoutDashboard },
      { label: 'Ventes', href: '/ventes', icon: ShoppingCart },
      { label: 'Production', href: '/production', icon: Factory },
    ],
  },
  {
    label: 'Gestion',
    items: [
      { label: 'Clients', href: '/clients', icon: Users },
      { label: 'Stocks', href: '/stocks', icon: Package },
    ],
  },
]

const SUPERVISEUR_NAV: NavSection[] = [
  {
    label: 'Opérations',
    items: [
      { label: 'Tableau de bord', href: '/', icon: LayoutDashboard },
      { label: 'Ventes', href: '/ventes', icon: ShoppingCart },
      { label: 'Production', href: '/production', icon: Factory },
      { label: 'Réceptions', href: '/lots-fournisseurs', icon: Truck },
    ],
  },
  {
    label: 'Catalogue & stocks',
    items: [
      { label: 'Matières premières', href: '/matieres-premieres', icon: Wheat },
      { label: 'Accessoires', href: '/accessoires', icon: PackagePlus },
      { label: 'Formules', href: '/formules', icon: FlaskConical },
      { label: 'Stocks', href: '/stocks', icon: Boxes },
      { label: 'Inventaire', href: '/inventaire', icon: ClipboardList },
    ],
  },
  {
    label: 'Pilotage',
    items: [
      { label: 'Clients', href: '/clients', icon: Users },
      { label: 'Rapports', href: '/rapports', icon: BarChart3 },
    ],
  },
  {
    label: 'Administration',
    items: [
      { label: 'Utilisateurs', href: '/utilisateurs', icon: Users },
      { label: "Journal d'audit", href: '/logs', icon: ScrollText },
      { label: 'Paramètres', href: '/parametres', icon: Settings },
    ],
  },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const hasSupervisorAccess = user?.role === 'superviseur' || user?.role === 'admin'
  const sections = hasSupervisorAccess ? SUPERVISEUR_NAV : GERANT_NAV
  const roleLabel = user?.role === 'admin' ? 'Administrateur' : hasSupervisorAccess ? 'Superviseur' : 'Gérant'
  const initials = user?.nom
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'PV'

  const handleLogout = async () => {
    try {
      await api.post('/auth/logout')
    } finally {
      logout()
      toast.success('Déconnexion réussie')
      router.replace('/login')
    }
  }

  const isActive = (href: string) => href === '/' ? pathname === '/' || pathname === '/dashboard' : pathname.startsWith(href)

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Fermer le menu"
          className="fixed inset-0 z-20 bg-slate-950/55 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        aria-label="Navigation principale"
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex w-[17.5rem] flex-col border-r border-white/5 bg-slate-950 text-white shadow-2xl shadow-slate-950/20 transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex min-h-16 items-center justify-between border-b border-white/10 px-5">
          <Link href="/" onClick={onClose} className="flex items-center gap-3 rounded-lg">
            <BrandMark className="h-9 w-9" />
            <div>
              <span className="block text-base font-bold tracking-[0.08em]">PROVENDIX</span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300/85">Gestion avicole</span>
            </div>
          </Link>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer le menu"
            className="rounded-lg p-2 text-slate-400 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mx-3 mt-3 flex items-center gap-3 rounded-xl border border-white/5 bg-white/[0.06] p-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/20">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">{user?.nom}</p>
            <p className="mt-0.5 text-[11px] font-medium text-emerald-400">{roleLabel}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {sections.map((section) => (
            <div key={section.label}>
              <p className="mb-1.5 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-slate-600">
                {section.label}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group flex min-h-10 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                        active
                          ? 'bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-lg shadow-emerald-950/20'
                          : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-100'
                      )}
                    >
                      <item.icon className={cn('h-[18px] w-[18px] shrink-0', active ? 'text-emerald-100' : 'text-slate-500 group-hover:text-slate-300')} />
                      <span className="flex-1">{item.label}</span>
                      {active && <ChevronRight className="h-3.5 w-3.5 text-emerald-200" />}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-white/10 p-3">
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
          >
            <LogOut className="h-[18px] w-[18px]" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}
