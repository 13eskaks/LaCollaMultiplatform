import pg from 'pg'

// Retornem els timestamps i dates tal com els dona Postgres (strings),
// igual que fa PostgREST, en lloc de convertir-los a Date de JS.
for (const oid of [1082, 1114, 1184, 1083, 1266]) pg.types.setTypeParser(oid, (v: string) => v)
// numeric / bigint com a number (PostgREST els retorna com a número JSON)
pg.types.setTypeParser(1700, (v: string) => (v === null ? null : Number(v)))
pg.types.setTypeParser(20, (v: string) => (v === null ? null : Number(v)))

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) throw new Error('DATABASE_URL no configurada')
    pool = new pg.Pool({
      connectionString,
      max: Number(process.env.PG_POOL_MAX ?? 5),
      idleTimeoutMillis: 10_000,
      ssl: /sslmode=require|neon\.tech/.test(connectionString) ? { rejectUnauthorized: false } : undefined,
    })
  }
  return pool
}

export interface Claims {
  sub?: string
  role: 'anon' | 'authenticated' | 'service_role'
  email?: string
  [k: string]: unknown
}

/**
 * Executa `fn` dins d'una transacció amb el rol i les claims indicades,
 * de manera que les polítiques RLS (auth.uid()) s'apliquen igual que a Supabase.
 */
export async function withClaims<T>(claims: Claims, fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    await client.query(
      `select set_config('request.jwt.claims', $1, true),
              set_config('request.jwt.claim.sub', $2, true),
              set_config('request.jwt.claim.role', $3, true)`,
      [JSON.stringify(claims), claims.sub ?? '', claims.role],
    )
    if (claims.role !== 'service_role') {
      await client.query(`set local role ${claims.role === 'authenticated' ? 'authenticated' : 'anon'}`)
    }
    const result = await fn(client)
    await client.query('commit')
    return result
  } catch (e) {
    try { await client.query('rollback') } catch { /* ignore */ }
    throw e
  } finally {
    client.release()
  }
}

/** Consulta directa amb el rol propietari (sense RLS). Només per a codi intern. */
export async function adminQuery<T extends pg.QueryResultRow = any>(text: string, params: unknown[] = []) {
  return getPool().query<T>(text, params)
}
