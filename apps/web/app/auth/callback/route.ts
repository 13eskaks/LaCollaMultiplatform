import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const collaId = requestUrl.searchParams.get('colla')

  if (code) {
    const supabase = createClient()
    await supabase.auth.exchangeCodeForSession(code)
  }

  if (collaId) {
    return NextResponse.redirect(new URL(`/colla-redirect?id=${collaId}`, requestUrl.origin))
  }

  return NextResponse.redirect(new URL('/', requestUrl.origin))
}
