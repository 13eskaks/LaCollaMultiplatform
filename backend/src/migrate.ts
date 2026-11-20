import { getPool } from './db.js'
import { invalidateSchema } from './schema.js'
import { MIGRATIONS } from './migrations.generated.js'

/** Aplica, en ordre, les migracions encara no aplicades (cadascuna en una transacció). */
export async function runMigrations() {
  const client = await getPool().connect()
  const applied: string[] = []
  try {
    const has = await client.query(`select to_regclass('public._migrations') is not null as ok`)
    let done = new Set<string>()
    if (has.rows[0].ok) {
      done = new Set((await client.query('select name from public._migrations')).rows.map((r: any) => r.name))
    }
    for (const m of MIGRATIONS) {
      if (done.has(m.name)) continue
      try {
        await client.query('begin')
        await client.query(m.sql)
        await client.query('insert into public._migrations (name) values ($1) on conflict do nothing', [m.name])
        await client.query('commit')
        applied.push(m.name)
      } catch (e: any) {
        await client.query('rollback').catch(() => {})
        return { ok: false, applied, failed: m.name, error: e.message, detail: e.detail ?? null }
      }
    }
    return { ok: true, applied, total: MIGRATIONS.length }
  } finally {
    client.release()
    invalidateSchema()
  }
}
