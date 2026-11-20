/**
 * Subconjunt de l'API de Supabase Storage: upload (POST/PUT), remove,
 * list i descàrrega pública. Els fitxers es guarden a storage.objects (bytea)
 * i les polítiques RLS de storage.objects de les migracions s'apliquen.
 */
import { adminQuery, withClaims, type Claims } from './db.js'

const MAX_BYTES = Number(process.env.STORAGE_MAX_BYTES ?? 8 * 1024 * 1024)

export class StorageError extends Error {
  constructor(public status: number, public error: string, message: string) {
    super(message)
  }
  toJSON() {
    return { statusCode: String(this.status), error: this.error, message: this.message }
  }
}

function json(status: number, body: unknown, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...extra } })
}

function cleanPath(p: string) {
  const parts = p.split('/').filter(Boolean)
  if (parts.some(x => x === '..' || x === '.')) throw new StorageError(400, 'InvalidKey', 'Invalid key')
  return parts.join('/')
}

async function readUpload(req: Request): Promise<{ bytes: Buffer; contentType: string }> {
  const ct = req.headers.get('content-type') ?? ''
  if (ct.startsWith('multipart/form-data')) {
    const form = await req.formData()
    let file: File | null = null
    for (const [, v] of form.entries()) {
      if (typeof v !== 'string') { file = v as File; break }
    }
    if (!file) throw new StorageError(400, 'InvalidRequest', 'No file in form data')
    return { bytes: Buffer.from(await file.arrayBuffer()), contentType: file.type || 'application/octet-stream' }
  }
  const buf = Buffer.from(await req.arrayBuffer())
  return { bytes: buf, contentType: ct || 'application/octet-stream' }
}

function sniffType(bytes: Buffer, given: string) {
  if (given && given !== 'application/octet-stream' && !given.startsWith('text/plain')) return given
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return 'image/jpeg'
  if (bytes[0] === 0x89 && bytes[1] === 0x50) return 'image/png'
  if (bytes.slice(0, 4).toString() === 'GIF8') return 'image/gif'
  if (bytes.slice(8, 12).toString() === 'WEBP') return 'image/webp'
  if (bytes.slice(4, 12).toString().includes('ftyphei')) return 'image/heic'
  return given || 'application/octet-stream'
}

export async function handleStorage(req: Request, sub: string, claims: Claims): Promise<Response> {
  const method = req.method
  const segs = sub.split('/').filter(Boolean).map(decodeURIComponent)

  // Descàrrega pública: object/public/<bucket>/<path> o render/image/public/...
  if ((method === 'GET' || method === 'HEAD') && ((segs[0] === 'object' && segs[1] === 'public') || (segs[0] === 'render' && segs[2] === 'public'))) {
    const rest = segs[0] === 'object' ? segs.slice(2) : segs.slice(3)
    const bucket = rest[0]
    const name = cleanPath(rest.slice(1).join('/'))
    const r = await adminQuery(
      `select o.data, o.content_type, o.updated_at, b.public from storage.objects o
       join storage.buckets b on b.id = o.bucket_id where o.bucket_id = $1 and o.name = $2`, [bucket, name])
    const row = r.rows[0]
    if (!row || !row.public) return json(404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
    return new Response(method === 'HEAD' ? null : new Uint8Array(row.data), {
      status: 200,
      headers: {
        'Content-Type': row.content_type ?? 'application/octet-stream',
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Last-Modified': new Date(row.updated_at).toUTCString(),
      },
    })
  }

  // Descàrrega autenticada: object/authenticated/<bucket>/<path> o object/<bucket>/<path> (GET)
  if (method === 'GET' && segs[0] === 'object') {
    const rest = segs[1] === 'authenticated' ? segs.slice(2) : segs.slice(1)
    const bucket = rest[0]
    const name = cleanPath(rest.slice(1).join('/'))
    const row = await withClaims(claims, async c =>
      (await c.query('select data, content_type from storage.objects where bucket_id = $1 and name = $2', [bucket, name])).rows[0])
    if (!row) return json(404, { statusCode: '404', error: 'not_found', message: 'Object not found' })
    return new Response(new Uint8Array(row.data), { headers: { 'Content-Type': row.content_type ?? 'application/octet-stream' } })
  }

  // Pujada: POST/PUT object/<bucket>/<path>
  if ((method === 'POST' || method === 'PUT') && segs[0] === 'object' && segs.length >= 3) {
    if (claims.role === 'anon') throw new StorageError(403, 'Unauthorized', 'new row violates row-level security policy')
    const bucket = segs[1]
    const name = cleanPath(segs.slice(2).join('/'))
    const { bytes, contentType } = await readUpload(req)
    if (bytes.length > MAX_BYTES) throw new StorageError(413, 'Payload too large', 'The object exceeded the maximum allowed size')
    const type = sniffType(bytes, contentType)
    const upsert = method === 'PUT' || req.headers.get('x-upsert') === 'true'
    const exists = (await adminQuery('select 1 from storage.buckets where id = $1', [bucket])).rows[0]
    if (!exists) throw new StorageError(404, 'Bucket not found', 'Bucket not found')
    const row = await withClaims(claims, async c => {
      if (upsert) {
        const upd = await c.query(
          `update storage.objects set data = $3, content_type = $4, size = $5, updated_at = now()
           where bucket_id = $1 and name = $2 returning id`, [bucket, name, bytes, type, bytes.length])
        if (upd.rows[0]) return upd.rows[0]
      }
      try {
        const ins = await c.query(
          `insert into storage.objects (bucket_id, name, owner, data, content_type, size)
           values ($1, $2, $3, $4, $5, $6) returning id`, [bucket, name, claims.sub ?? null, bytes, type, bytes.length])
        return ins.rows[0]
      } catch (e: any) {
        if (e.code === '23505') throw new StorageError(409, 'Duplicate', 'The resource already exists')
        throw e
      }
    })
    return json(200, { Id: row.id, Key: `${bucket}/${name}` })
  }

  // Esborrat: DELETE object/<bucket> { prefixes: [...] }
  if (method === 'DELETE' && segs[0] === 'object') {
    let bucket = segs[1]
    let names: string[]
    if (segs.length > 2) names = [segs.slice(2).join('/')]
    else {
      const body = await req.json().catch(() => ({}))
      names = Array.isArray(body.prefixes) ? body.prefixes.map(String) : []
    }
    names = names.map(cleanPath)
    if (!names.length) return json(200, [])
    const rows = await withClaims(claims, async c =>
      (await c.query(`delete from storage.objects where bucket_id = $1 and name = any($2::text[])
                      returning id, name, bucket_id, created_at, updated_at`, [bucket, names])).rows)
    return json(200, rows)
  }

  // Llistat: POST object/list/<bucket> { prefix, limit, offset }
  if (method === 'POST' && segs[0] === 'object' && segs[1] === 'list') {
    const bucket = segs[2]
    const body = await req.json().catch(() => ({}))
    const prefix = cleanPath(String(body.prefix ?? ''))
    const limit = Math.min(Number(body.limit ?? 100), 1000)
    const offset = Number(body.offset ?? 0)
    const rows = await withClaims(claims, async c =>
      (await c.query(
        `select id, name, created_at, updated_at, json_build_object('size', size, 'mimetype', content_type) as metadata
         from storage.objects where bucket_id = $1 and ($2 = '' or name like $2 || '/%')
         order by name limit $3 offset $4`, [bucket, prefix, limit, offset])).rows)
    return json(200, rows.map((r: any) => ({ ...r, name: prefix ? r.name.slice(prefix.length + 1) : r.name })))
  }

  throw new StorageError(404, 'not_found', 'Not found')
}
