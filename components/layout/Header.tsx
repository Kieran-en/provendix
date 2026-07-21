'use client'

import { Menu, Moon, Sun } from 'lucide-react'
import { usePathname } from 'next/navigation'
import NotificationBell from '@/components/ui/NotificationBell'
import { useThemeStore } from '@/store/theme.store'

const PAGE_TITLES: Record<string, { title: string; eyebrow: string }> = {
  '/': { title: 'Tableau de bord', eyebrow: "Vue d'ensemble" },
  '/dashboard': { title: 'Tableau de bord', eyebrow: "Vue d'ensemble" },
  '/ventes': { title: 'Ventes', eyebrow: 'Opérations' },
  '/ventes/nouvelle': { title: 'Nouvelle vente', eyebrow: 'Opérations' },
  '/production': { title: 'Production', eyebrow: 'Opérations' },
  '/production/nouvelle': { title: 'Nouvelle production', eyebrow: 'Opérations' },
  '/clients': { title: 'Clients', eyebrow: 'Relation client' },
  '/clients/nouveau': { title: 'Nouveau client', eyebrow: 'Relation client' },
  '/stocks': { title: 'Stocks', eyebrow: 'Catalogue & stocks' },
  '/utilisateurs': { title: 'Utilisateurs', eyebrow: 'Administration' },
  '/matieres-premieres': { title: 'Matières premières', eyebrow: 'Catalogue & stocks' },
  '/matieres-premieres/nouvelle': { title: 'Nouvelle matière première', eyebrow: 'Catalogue & stocks' },
  '/accessoires': { title: 'Accessoires & suppléments', eyebrow: 'Catalogue & stocks' },
  '/accessoires/nouveau': { title: 'Nouvel accessoire', eyebrow: 'Catalogue & stocks' },
  '/lots-fournisseurs': { title: 'Réceptions fournisseurs', eyebrow: 'Opérations' },
  '/lots-fournisseurs/nouveau': { title: 'Nouvelle réception', eyebrow: 'Opérations' },
  '/formules': { title: 'Formules', eyebrow: 'Catalogue & stocks' },
  '/formules/nouvelle': { title: 'Nouvelle formule', eyebrow: 'Catalogue & stocks' },
  '/inventaire': { title: 'Inventaire & ajustements', eyebrow: 'Catalogue & stocks' },
  '/rapports': { title: 'Rapports', eyebrow: 'Pilotage' },
  '/logs': { title: "Journal d'audit", eyebrow: 'Administration' },
  '/parametres': { title: 'Paramètres', eyebrow: 'Administration' },
}

interface HeaderProps {
  onMenuOpen: () => void
}

export default function Header({ onMenuOpen }: HeaderProps) {
  const pathname = usePathname()
  const { theme, toggleTheme } = useThemeStore()

  const page = PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .sort(([a], [b]) => b.length - a.length)
      .find(([key]) => key !== '/' && pathname.startsWith(`${key}/`))?.[1] ??
    { title: 'PROVENDIX', eyebrow: 'Gestion avicole' }

  return (
    <header className="sticky top-0 z-10 flex min-h-16 items-center gap-3 border-b border-slate-200/80 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 md:px-6">
      <button
        type="button"
        onClick={onMenuOpen}
        aria-label="Ouvrir le menu"
        className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-100 lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>

      <div className="min-w-0 flex-1">
        <p className="hidden text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-600 sm:block dark:text-emerald-400">
          {page.eyebrow}
        </p>
        <h1 className="truncate text-base font-bold tracking-tight text-slate-900 dark:text-slate-100 md:text-lg">
          {page.title}
        </h1>
      </div>

      <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          title={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          className="rounded-lg p-2 text-slate-500 transition hover:bg-white hover:text-slate-800 hover:shadow-sm dark:hover:bg-slate-800 dark:hover:text-amber-300"
        >
          {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
        </button>
        <NotificationBell />
      </div>
    </header>
  )
}
