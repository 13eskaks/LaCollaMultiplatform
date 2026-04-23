import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// IPs permeses per accedir al panel admin
// Afegeix la teua IP fixa aquí en producció
const ALLOWED_IPS = process.env.ADMIN_ALLOWED_IPS?.split(',') ?? []

export async function middleware(request: NextRequest) {
  // Bloqueig per IP en producció
  if (process.env.NODE_ENV === 'production' && ALLOWED_IPS.length > 0) {
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    if (!ip || !ALLOWED_IPS.includes(ip)) {
      return new NextResponse('Forbidden', { status: 403 })
    }
  }

  // Pàgina de login exclosa
  if (request.nextUrl.pathname === '/login') {
    return NextResponse.next()
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_superadmin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_superadmin) {
    return NextResponse.redirect(new URL('/login?error=unauthorized', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|login).*)'],
}
