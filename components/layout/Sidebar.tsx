'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Wheat,
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Users,
  Package,
  Truck,
  FlaskConical,
  ClipboardList,
  BarChart3,
  LogOut,
  X,
  ChevronRight,
  ScrollText,
  Settings,
} from 'lucide-react'
import { useAuthStore } from '@/store/auth.store'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const GERANT_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Ventes', href: '/ventes', icon: ShoppingCart },
  { label: 'Production', href: '/production', icon: Factory },
  { label: 'Clients', href: '/clients', icon: Users },
  { label: 'Stocks', href: '/stocks', icon: Package },
]

const SUPERVISEUR_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Utilisateurs', href: '/utilisateurs', icon: Users },
  { label: 'Matières Premières', href: '/matieres-premieres', icon: Wheat },
  { label: 'Lots Fournisseurs', href: '/lots-fournisseurs', icon: Truck },
  { label: 'Formules', href: '/formules', icon: FlaskConical },
  { label: 'Production', href: '/production', icon: Factory },
  { label: 'Inventaire', href: '/inventaire', icon: ClipboardList },
  { label: 'Rapports', href: '/rapports', icon: BarChart3 },
  { label: 'Journal d\'audit', href: '/logs', icon: ScrollText },
  { label: 'Paramètres', href: '/parametres', icon: Settings },
]

interface SidebarProps {
  open: boolean
  onClose: () => void
}

export default function Sidebar({ open, onClose }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()

  const navItems = user?.role === 'superviseur' ? SUPERVISEUR_NAV : GERANT_NAV
  const roleLabel = user?.role === 'superviseur' ? 'Superviseur' : 'Gérant'

  const handleLogout = () => {
    logout()
    toast.success('Déconnexion réussie')
    router.push('/login')
  }

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed top-0 left-0 h-full w-64 bg-slate-900 flex flex-col z-30 transition-transform duration-200',
          'lg:translate-x-0 lg:static lg:z-auto',
          open ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Wheat className="w-4 h-4 text-white" />
            </div>
            <span className="text-white font-bold text-lg tracking-tight">PROVENDIX</span>
          </div>
          <button onClick={onClose} className="lg:hidden text-slate-400 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User badge */}
        <div className="px-4 py-3 border-b border-slate-800">
          <div className="bg-slate-800 rounded-lg px-3 py-2.5">
            <p className="text-white text-sm font-medium truncate">{user?.nom}</p>
            <span className="text-xs text-emerald-400 font-medium">{roleLabel}</span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors group',
                  active
                    ? 'bg-emerald-600 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                )}
              >
                <item.icon className="w-4.5 h-4.5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {active && <ChevronRight className="w-3.5 h-3.5 opacity-70" />}
              </Link>
            )
          })}
        </nav>

        {/* Logout */}
        <div className="px-3 py-4 border-t border-slate-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition-colors w-full"
          >
            <LogOut className="w-4.5 h-4.5" />
            Déconnexion
          </button>
        </div>
      </aside>
    </>
  )
}
