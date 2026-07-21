import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login']

const SUPERVISOR_ONLY_PREFIXES = [
  '/utilisateurs',
  '/matieres-premieres',
  '/accessoires',
  '/lots-fournisseurs',
  '/formules',
  '/inventaire',
  '/rapports',
  '/logs',
  '/parametres',
]

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const token = request.cookies.get('access_token')?.value
  const role = request.cookies.get('user_role')?.value

  if (PUBLIC_ROUTES.includes(pathname)) {
    return token
      ? NextResponse.redirect(new URL('/dashboard', request.url))
      : NextResponse.next()
  }

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const isSupervisorRoute = SUPERVISOR_ONLY_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (isSupervisorRoute && role !== 'superviseur' && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
