'use client'

import { useState, useRef, useEffect } from 'react'
import { Bell, AlertTriangle, Info, X, Package } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '@/lib/api'
import Link from 'next/link'
import { cn } from '@/lib/utils'

interface Notification {
  id: string
  type: 'warning' | 'danger' | 'info'
  module: string
  titre: string
  message: string
  lien: string
}

interface NotificationsResponse {
  count: number
  notifications: Notification[]
}

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data } = useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: async () => {
      const res = await api.get<NotificationsResponse>('/notifications')
      return res.data
    },
    refetchInterval: 60_000, // Rafraîchit toutes les minutes
    staleTime: 30_000,
  })

  const count = data?.count ?? 0
  const notifications = data?.notifications ?? []

  // Fermer si clic extérieur
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-1.5 rounded-md text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-700 dark:hover:text-slate-200 transition"
      >
        <Bell className="w-5 h-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">
              Notifications {count > 0 && <span className="text-rose-500">({count})</span>}
            </span>
            <button
              onClick={() => setOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                <Bell className="w-8 h-8 opacity-30" />
                <span className="text-sm">Aucune notification</span>
              </div>
            ) : (
              notifications.map((notif) => (
                <Link
                  key={notif.id}
                  href={notif.lien}
                  onClick={() => setOpen(false)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <div className={cn(
                    'mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0',
                    notif.type === 'danger' && 'bg-rose-100 dark:bg-rose-900/30',
                    notif.type === 'warning' && 'bg-amber-100 dark:bg-amber-900/30',
                    notif.type === 'info' && 'bg-blue-100 dark:bg-blue-900/30',
                  )}>
                    {notif.type === 'danger' && <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />}
                    {notif.type === 'warning' && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                    {notif.type === 'info' && <Info className="w-3.5 h-3.5 text-blue-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {notif.titre}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {notif.message}
                    </p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
