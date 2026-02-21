import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import Providers from './providers'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'PROVENDIX',
  description: 'Gestion de provenderie',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className={`${geist.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
