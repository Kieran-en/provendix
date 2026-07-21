import type { Metadata } from 'next'
import './globals.css'
import Providers from './providers'

export const metadata: Metadata = {
  title: {
    default: 'PROVENDIX',
    template: '%s | PROVENDIX',
  },
  description: 'Pilotage des ventes, stocks et productions de provenderie',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
