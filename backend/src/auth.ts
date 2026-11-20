/**
 * Subconjunt de l'API de Supabase Auth (GoTrue) que fa servir supabase-js:
 * signup, token (password / refresh_token), user (GET/PUT), logout,
 * recover, resend i verify. Usuaris a auth.users, contrasenyes amb bcrypt,
 * JWT HS256 signats amb JWT_SECRET.
 */
import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { randomBytes } from 'node:crypto'
import { adminQuery, type Claims } from './db.js'
import { sendMail } from './mail.js'

const ACCESS_TTL = 60 * 60 // 1 hora

function secret() {
  const s = process.env.JWT_SECRET
  if (!s || s.length < 32) throw new Error('JWT_SECRET no configurat (mínim 32 caràcters)')
  return new TextEncoder().encode(s)
}

export function appUrl() {
  return (process.env.APP_URL ?? 'http://localhost:8787').replace(/\/$/, '')
}

const autoconfirm = () => (process.env.AUTH_AUTOCONFIRM ?? 'true') !== 'false'

export class AuthError extends Error {
  constructor(public status: number, public errorCode: string, message: string) {
    super(message)
  }
  toJSON() {
    return { code: this.status, error_code: this.errorCode, msg: this.message, error: this.errorCode, error_description: this.message }
  }
}

export async function signJwt(claims: Record<string, unknown>, ttl = ACCESS_TTL) {
  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setIssuer('lacolla')
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttl)
    .sign(secret())
}

/** Llegeix el bearer token i retorna les claims (anon si no n'hi ha o és invàlid). */
export async function claimsFromRequest(req: Request): Promise<Claims> {
  const h = req.headers.get('authorization') ?? ''
  const token = h.toLowerCase().startsWith('bearer ') ? h.slice(7).trim() : ''
  if (!token) return { role: 'anon' }
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'lacolla' })
    const role = payload.role === 'authenticated' || payload.role === 'service_role' ? payload.role : 'anon'
    return { ...(payload as Record<string, unknown>), role } as Claims
  } catch {
    return { role: 'anon' }
  }
}

function userJson(u: any) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.email_confirmed_at,
    confirmed_at: u.email_confirmed_at,
    phone: '',
    last_sign_in_at: u.last_sign_in_at,
    app_metadata: { provider: 'email', providers: ['email'], ...(u.raw_app_meta_data ?? {}) },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.updated_at,
    is_anonymous: false,
  }
}

async function issueSession(u: any) {
  const now = Math.floor(Date.now() / 1000)
  const access_token = await signJwt({
    sub: u.id,
    email: u.email,
    role: 'authenticated',
    aud: 'authenticated',
    session_id: randomBytes(8).toString('hex'),
  })
  const refresh_token = randomBytes(32).toString('base64url')
  await adminQuery('insert into auth.refresh_tokens (token, user_id) values ($1, $2)', [refresh_token, u.id])
  await adminQuery('update auth.users set last_sign_in_at = now() where id = $1', [u.id])
  return {
    access_token,
    token_type: 'bearer',
    expires_in: ACCESS_TTL,
    expires_at: now + ACCESS_TTL,
    refresh_token,
    user: userJson(u),
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

async function findUserByEmail(email: string) {
  const r = await adminQuery('select * from auth.users where lower(email) = lower($1)', [email.trim()])
  return r.rows[0] ?? null
}

async function oneTimeToken(userId: string, kind: 'signup' | 'recovery') {
  const token = randomBytes(24).toString('base64url')
  await adminQuery('insert into auth.one_time_tokens (token, user_id, kind) values ($1, $2, $3)', [token, userId, kind])
  return token
}

async function sendConfirmation(u: any) {
  const token = await oneTimeToken(u.id, 'signup')
  const link = `${appUrl()}/auth/v1/verify?token=${token}`
  await sendMail(u.email, 'Confirma el teu compte de LaColla',
    `<p>Hola!</p><p>Fes clic per confirmar el teu correu a LaColla:</p><p><a href="${link}">${link}</a></p>`)
}

function json(status: number, body: unknown) {
  return new Response(body === null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function html(body: string, status = 200) {
  return new Response(`<!doctype html><html lang="ca"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>LaColla</title>
<style>body{font-family:system-ui,sans-serif;background:#f6f4f0;color:#1d1b18;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:16px}
.card{background:#fff;border-radius:16px;padding:28px;max-width:380px;width:100%;box-shadow:0 4px 24px rgba(0,0,0,.06)}
h1{font-size:20px;margin:0 0 12px}input{width:100%;box-sizing:border-box;padding:12px;border:1px solid #ddd;border-radius:10px;font-size:16px;margin:6px 0 12px}
button{width:100%;padding:12px;border:0;border-radius:10px;background:#c2410c;color:#fff;font-size:16px;font-weight:600}a{color:#c2410c}</style></head>
<body><div class="card">${body}</div></body></html>`, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } })
}

async function readJson(req: Request): Promise<any> {
  try {
    return await req.json()
  } catch {
    return {}
  }
}

export async function handleAuth(req: Request, sub: string): Promise<Response> {
  const url = new URL(req.url)
  const method = req.method

  if (sub === 'settings' || sub === 'health') {
    return json(200, { external: { email: true }, disable_signup: false, mailer_autoconfirm: autoconfirm() })
  }

  if (sub === 'signup' && method === 'POST') {
    const body = await readJson(req)
    const email = String(body.email ?? '').trim().toLowerCase()
    const password = String(body.password ?? '')
    if (!EMAIL_RE.test(email)) throw new AuthError(400, 'validation_failed', 'Unable to validate email address: invalid format')
    if (password.length < 6) throw new AuthError(422, 'weak_password', 'Password should be at least 6 characters.')
    if (await findUserByEmail(email)) throw new AuthError(422, 'user_already_exists', 'User already registered')
    const hash = await bcrypt.hash(password, 10)
    const meta = body.data && typeof body.data === 'object' ? body.data : {}
    const r = await adminQuery(
      `insert into auth.users (email, encrypted_password, raw_user_meta_data, email_confirmed_at)
       values ($1, $2, $3, case when $4 then now() else null end) returning *`,
      [email, hash, JSON.stringify(meta), autoconfirm()],
    )
    const u = r.rows[0]
    if (autoconfirm()) return json(200, await issueSession(u))
    await sendConfirmation(u).catch(e => console.error('mail error', e))
    return json(200, userJson(u))
  }

  if (sub === 'token' && method === 'POST') {
    const grant = url.searchParams.get('grant_type')
    const body = await readJson(req)
    if (grant === 'password') {
      const u = await findUserByEmail(String(body.email ?? ''))
      const ok = u?.encrypted_password && (await bcrypt.compare(String(body.password ?? ''), u.encrypted_password))
      if (!u || !ok) throw new AuthError(400, 'invalid_credentials', 'Invalid login credentials')
      if (!u.email_confirmed_at) throw new AuthError(400, 'email_not_confirmed', 'Email not confirmed')
      return json(200, await issueSession(u))
    }
    if (grant === 'refresh_token') {
      const token = String(body.refresh_token ?? '')
      const r = await adminQuery(
        `update auth.refresh_tokens set revoked = true where token = $1 and not revoked returning user_id`, [token])
      if (!r.rows[0]) throw new AuthError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found')
      const u = (await adminQuery('select * from auth.users where id = $1', [r.rows[0].user_id])).rows[0]
      if (!u) throw new AuthError(400, 'user_not_found', 'User not found')
      return json(200, await issueSession(u))
    }
    throw new AuthError(400, 'unsupported_grant_type', 'Unsupported grant type')
  }

  if (sub === 'user') {
    const claims = await claimsFromRequest(req)
    if (claims.role !== 'authenticated' || !claims.sub) throw new AuthError(401, 'bad_jwt', 'invalid JWT: unable to parse or verify signature')
    let u = (await adminQuery('select * from auth.users where id = $1', [claims.sub])).rows[0]
    if (!u) throw new AuthError(403, 'user_not_found', 'User from sub claim in JWT does not exist')
    if (method === 'PUT') {
      const body = await readJson(req)
      if (body.password !== undefined) {
        const pw = String(body.password)
        if (pw.length < 6) throw new AuthError(422, 'weak_password', 'Password should be at least 6 characters.')
        u = (await adminQuery('update auth.users set encrypted_password = $2, updated_at = now() where id = $1 returning *',
          [u.id, await bcrypt.hash(pw, 10)])).rows[0]
      }
      if (body.data && typeof body.data === 'object') {
        u = (await adminQuery(`update auth.users set raw_user_meta_data = raw_user_meta_data || $2::jsonb, updated_at = now() where id = $1 returning *`,
          [u.id, JSON.stringify(body.data)])).rows[0]
      }
      if (body.email && String(body.email).toLowerCase() !== u.email) {
        const email = String(body.email).trim().toLowerCase()
        if (!EMAIL_RE.test(email)) throw new AuthError(400, 'validation_failed', 'Unable to validate email address: invalid format')
        if (await findUserByEmail(email)) throw new AuthError(422, 'email_exists', 'A user with this email address has already been registered')
        u = (await adminQuery('update auth.users set email = $2, updated_at = now() where id = $1 returning *', [u.id, email])).rows[0]
        await adminQuery('update public.profiles set email = $2 where id = $1', [u.id, email]).catch(() => {})
      }
    }
    return json(200, userJson(u))
  }

  if (sub === 'logout' && method === 'POST') {
    const claims = await claimsFromRequest(req)
    if (claims.sub) await adminQuery('update auth.refresh_tokens set revoked = true where user_id = $1', [claims.sub])
    return new Response(null, { status: 204 })
  }

  if (sub === 'recover' && method === 'POST') {
    const body = await readJson(req)
    const u = await findUserByEmail(String(body.email ?? ''))
    if (u) {
      const token = await oneTimeToken(u.id, 'recovery')
      const link = `${appUrl()}/auth/v1/reset?token=${token}`
      await sendMail(u.email, 'Restableix la teua contrasenya de LaColla',
        `<p>Has demanat canviar la contrasenya de LaColla.</p><p><a href="${link}">Canvia la contrasenya</a></p><p>Si no has sigut tu, ignora aquest correu.</p>`)
        .catch(e => console.error('mail error', e))
    }
    return json(200, {})
  }

  if (sub === 'resend' && method === 'POST') {
    const body = await readJson(req)
    const u = await findUserByEmail(String(body.email ?? ''))
    if (u && !u.email_confirmed_at) await sendConfirmation(u).catch(e => console.error('mail error', e))
    return json(200, {})
  }

  if (sub === 'verify' && method === 'GET') {
    const token = url.searchParams.get('token') ?? ''
    const r = await adminQuery(
      `update auth.one_time_tokens set used = true
       where token = $1 and kind = 'signup' and not used and created_at > now() - interval '3 days' returning user_id`, [token])
    if (!r.rows[0]) return html('<h1>Enllaç no vàlid</h1><p>Aquest enllaç ha caducat o ja s\'ha fet servir.</p>', 400)
    await adminQuery('update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1', [r.rows[0].user_id])
    return html(`<h1>Correu confirmat ✅</h1><p>Ja pots tornar a l'app i iniciar sessió.</p><p><a href="${appUrl()}">Obrir LaColla</a></p>`)
  }

  if (sub === 'reset') {
    const token = method === 'GET' ? url.searchParams.get('token') ?? '' : ''
    if (method === 'GET') {
      const ok = (await adminQuery(`select 1 from auth.one_time_tokens where token = $1 and kind = 'recovery' and not used and created_at > now() - interval '1 day'`, [token])).rows[0]
      if (!ok) return html('<h1>Enllaç no vàlid</h1><p>Aquest enllaç ha caducat o ja s\'ha fet servir.</p>', 400)
      return html(`<h1>Nova contrasenya</h1><form method="post"><input type="hidden" name="token" value="${token.replace(/[^\w-]/g, '')}">
        <input type="password" name="password" minlength="6" required placeholder="Nova contrasenya (mín. 6)"><button>Guardar</button></form>`)
    }
    if (method === 'POST') {
      const form = await req.formData()
      const t = String(form.get('token') ?? '')
      const pw = String(form.get('password') ?? '')
      if (pw.length < 6) return html('<h1>Contrasenya massa curta</h1><p>Ha de tindre almenys 6 caràcters.</p>', 400)
      const r = await adminQuery(
        `update auth.one_time_tokens set used = true where token = $1 and kind = 'recovery' and not used and created_at > now() - interval '1 day' returning user_id`, [t])
      if (!r.rows[0]) return html('<h1>Enllaç no vàlid</h1>', 400)
      await adminQuery('update auth.users set encrypted_password = $2, updated_at = now(), email_confirmed_at = coalesce(email_confirmed_at, now()) where id = $1',
        [r.rows[0].user_id, await bcrypt.hash(pw, 10)])
      await adminQuery('update auth.refresh_tokens set revoked = true where user_id = $1', [r.rows[0].user_id])
      return html(`<h1>Contrasenya canviada ✅</h1><p>Ja pots iniciar sessió amb la nova contrasenya.</p><p><a href="${appUrl()}">Obrir LaColla</a></p>`)
    }
  }

  throw new AuthError(404, 'not_found', 'Not found')
}
