'use client'

import { Menu, Sun, Moon } from 'lucide-react'
import { usePathname } from 'next/navigation'
import { useThemeStore } from '@/store/theme.store'
import NotificationBell from '@/components/ui/NotificationBell'

const PAGE_TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/ventes': 'Ventes',
  '/ventes/nouvelle': 'Nouvelle vente',
  '/production': 'Production',
  '/production/nouvelle': 'Nouvelle production',
  '/clients': 'Clients',
  '/clients/nouveau': 'Nouveau client',
  '/stocks': 'Stocks',
  '/utilisateurs': 'Utilisateurs',
  '/matieres-premieres': 'Matières Premières',
  '/matieres-premieres/nouvelle': 'Nouvelle MP',
  '/lots-fournisseurs': 'Lots Fournisseurs',
  '/lots-fournisseurs/nouveau': 'Nouveau lot',
  '/formules': 'Formules',
  '/formules/nouvelle': 'Nouvelle formule',
  '/inventaire': 'Inventaire & Ajustements',
  '/rapports': 'Rapports',
  '/logs': 'Journal d\'audit',
  '/parametres': 'Paramètres',
}

interface HeaderProps {
  onMenuOpen: () => void
}

export default function Header({ onMenuOpen }: HeaderProps) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useThemeStore()

  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(
      ([key]) => pathname.startsWith(key) && key !== '/'
    )?.[1] ??
    'PROVENDIX'

  return (
    <header className="h-14 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex items-center px-4 gap-3 sticky top-0 z-10">
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-slate-200 transition"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-slate-800 dark:text-slate-100 font-semibold text-base flex-1">
        {title}
      </h1>

      {/* Toggle dark mode */}
      <button
        onClick={toggleTheme}
        className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-700 dark:hover:text-amber-300 transition"
        title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
      >
        {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
      </button>

      {/* Cloche notifications avec données réelles */}
      <NotificationBell />
    </header>
  )
}
