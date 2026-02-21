import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login']

// Routes accessibles uniquement par le superviseur
const SUPERVISOR_ONLY_PREFIXES = [
  '/utilisateurs',
  '/matieres-premieres',
  '/lots-fournisseurs',
  '/formules',
  '/inventaire',
  '/rapports',
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const token = request.cookies.get('access_token')?.value
  const role = request.cookies.get('user_role')?.value

  // Routes publiques
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
    return NextResponse.next()
  }

  // Routes protégées : rediriger vers login si pas de token
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Routes superviseur uniquement
  const isSupervisorRoute = SUPERVISOR_ONLY_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  )
  if (isSupervisorRoute && role !== 'superviseur') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
