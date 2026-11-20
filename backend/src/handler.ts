import { withClaims } from './db.js'
import { ApiError, handlePostgrest, handleRpc, pgErrorToApi } from './postgrest.js'
import { AuthError, claimsFromRequest, handleAuth } from './auth.js'
import { StorageError, handleStorage } from './storage.js'
import { runMigrations } from './migrate.js'

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS',
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, range, x-client-info, x-upsert, x-supabase-api-version, cache-control, x-metadata',
  'Access-Control-Expose-Headers': 'content-range, content-type, x-total-count',
  'Access-Control-Max-Age': '86400',
}

function withCors(res: Response): Response {
  const h = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS)) h.set(k, v)
  return new Response(res.body, { status: res.status, statusText: res.statusText, headers: h })
}

function json(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(body === null || body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers },
  })
}

async function readBody(req: Request): Promise<unknown> {
  const text = await req.text()
  if (!text) return undefined
  try {
    return JSON.parse(text)
  } catch {
    throw new ApiError(400, 'PGRST102', 'Empty or invalid json')
  }
}

export async function handle(req: Request): Promise<Response> {
  let url = new URL(req.url)
  // A Vercel, les rutes reescriuen a /api?__path=/rest/v1/...; recuperem el camí original
  const forwarded = url.searchParams.get('__path')
  if (forwarded !== null) {
    url.searchParams.delete('__path')
    url = new URL(forwarded + (url.search || ''), url.origin)
    req = new Request(url, req)
  }
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  const path = url.pathname.replace(/^\/api(?=\/)/, '')

  try {
    if (path === '/health') return withCors(json(200, { ok: true }))

    if (path === '/admin/migrate') {
      const token = url.searchParams.get('token') ?? req.headers.get('x-admin-token')
      if (!process.env.ADMIN_TOKEN || token !== process.env.ADMIN_TOKEN) return json(401, { error: 'unauthorized' })
      const result = await runMigrations()
      return json(result.ok ? 200 : 500, result)
    }

    if (path.startsWith('/auth/v1/')) {
      return withCors(await handleAuth(req, path.slice('/auth/v1/'.length)))
    }

    if (path.startsWith('/storage/v1/')) {
      const claims = await claimsFromRequest(req)
      return withCors(await handleStorage(req, path.slice('/storage/v1/'.length), claims))
    }

    if (path.startsWith('/rest/v1/')) {
      const claims = await claimsFromRequest(req)
      const resource = decodeURIComponent(path.slice('/rest/v1/'.length)).replace(/\/$/, '')
      const accept = req.headers.get('accept') ?? ''
      const prefer = req.headers.get('prefer') ?? ''
      try {
        if (resource.startsWith('rpc/')) {
          const fn = resource.slice(4)
          const args = req.method === 'GET'
            ? Object.fromEntries(url.searchParams.entries())
            : ((await readBody(req)) as Record<string, unknown>) ?? {}
          const out = await withClaims(claims, c => handleRpc(c, fn, args, accept, url.searchParams))
          return withCors(json(out.status, out.body, out.headers))
        }
        if (!/^\w+$/.test(resource)) throw new ApiError(404, 'PGRST125', 'Invalid path specified in request URL')
        const body = req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE' ? undefined : await readBody(req)
        const out = await withClaims(claims, c =>
          handlePostgrest(c, { method: req.method, table: resource, params: url.searchParams, prefer, accept, body }))
        return withCors(json(out.status, out.body, out.headers))
      } catch (e) {
        const err = pgErrorToApi(e, claims.role === 'authenticated')
        if (err.status >= 500) console.error('[rest]', req.method, url.pathname + url.search, e)
        return withCors(json(err.status, err.toJSON()))
      }
    }

    if (path.startsWith('/functions/v1/') || path.startsWith('/realtime/v1/')) {
      return withCors(json(501, { message: 'Not available on this deployment' }))
    }

    return withCors(json(404, { message: 'Not found' }))
  } catch (e: any) {
    if (e instanceof AuthError) return withCors(json(e.status, e.toJSON()))
    if (e instanceof StorageError) return withCors(json(e.status, e.toJSON()))
    if (e instanceof ApiError) return withCors(json(e.status, e.toJSON()))
    if (e?.code && typeof e.code === 'string' && /^[0-9A-Z]{5}$/.test(e.code)) {
      const err = pgErrorToApi(e, true)
      if (path.startsWith('/storage/')) {
        return withCors(json(err.status === 401 ? 403 : err.status, { statusCode: String(err.status), error: err.code, message: err.message }))
      }
      return withCors(json(err.status, err.toJSON()))
    }
    console.error('[api] unhandled', req.method, url.pathname, e)
    return withCors(json(500, { message: 'Internal server error', code: 'internal_error', msg: 'Internal server error' }))
  }
}
