'use client'

import { Menu, Bell } from 'lucide-react'
import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
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
}

interface HeaderProps {
  onMenuOpen: () => void
}

export default function Header({ onMenuOpen }: HeaderProps) {
  const pathname = usePathname()

  const title =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES).find(([key]) => pathname.startsWith(key) && key !== '/dashboard')?.[1] ??
    'PROVENDIX'

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center px-4 gap-3 sticky top-0 z-10">
      <button
        onClick={onMenuOpen}
        className="lg:hidden p-1.5 rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
      >
        <Menu className="w-5 h-5" />
      </button>

      <h1 className="text-slate-800 font-semibold text-base flex-1">{title}</h1>

      <button className="relative p-1.5 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition">
        <Bell className="w-5 h-5" />
      </button>
    </header>
  )
}
