import { adminQuery } from './db.js'

export interface Column {
  name: string
  dataType: string // information_schema data_type: 'jsonb', 'ARRAY', 'uuid', ...
  hasDefault: boolean
}

export interface Table {
  name: string
  columns: Map<string, Column>
  pk: string[]
}

export interface ForeignKey {
  name: string
  table: string
  columns: string[]
  refTable: string
  refColumns: string[]
}

export interface RpcFn {
  name: string
  returnsSet: boolean
  returnsScalar: boolean
}

export interface Schema {
  tables: Map<string, Table>
  fks: ForeignKey[]
  fns: Map<string, RpcFn>
  loadedAt: number
}

let cache: Schema | null = null
const TTL = 60_000

export function invalidateSchema() {
  cache = null
}

export async function getSchema(): Promise<Schema> {
  if (cache && Date.now() - cache.loadedAt < TTL) return cache

  const [colsRes, pkRes, fkRes, fnRes] = await Promise.all([
    adminQuery(`
      select c.table_name, c.column_name, c.data_type, c.column_default is not null or c.is_identity = 'YES' as has_default
      from information_schema.columns c
      join information_schema.tables t on t.table_schema = c.table_schema and t.table_name = c.table_name
      where c.table_schema = 'public' and t.table_type in ('BASE TABLE', 'VIEW') and c.table_name not like '\\_%'
      order by c.table_name, c.ordinal_position`),
    adminQuery(`
      select tc.table_name, kcu.column_name
      from information_schema.table_constraints tc
      join information_schema.key_column_usage kcu
        on kcu.constraint_name = tc.constraint_name and kcu.table_schema = tc.table_schema
      where tc.table_schema = 'public' and tc.constraint_type = 'PRIMARY KEY'
      order by kcu.ordinal_position`),
    adminQuery(`
      select con.conname as name,
             cl.relname as table,
             rcl.relname as ref_table,
             array(select a.attname from unnest(con.conkey) with ordinality k(n, o)
                   join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n order by k.o)::text[] as columns,
             array(select a.attname from unnest(con.confkey) with ordinality k(n, o)
                   join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n order by k.o)::text[] as ref_columns
      from pg_constraint con
      join pg_class cl on cl.oid = con.conrelid
      join pg_namespace ns on ns.oid = cl.relnamespace
      join pg_class rcl on rcl.oid = con.confrelid
      join pg_namespace rns on rns.oid = rcl.relnamespace
      where con.contype = 'f' and ns.nspname = 'public' and rns.nspname = 'public'`),
    adminQuery(`
      select p.proname, p.proretset, t.typtype
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      join pg_type t on t.oid = p.prorettype
      where n.nspname = 'public'`),
  ])

  const tables = new Map<string, Table>()
  for (const r of colsRes.rows) {
    let t = tables.get(r.table_name)
    if (!t) tables.set(r.table_name, (t = { name: r.table_name, columns: new Map(), pk: [] }))
    t.columns.set(r.column_name, { name: r.column_name, dataType: r.data_type, hasDefault: r.has_default })
  }
  for (const r of pkRes.rows) tables.get(r.table_name)?.pk.push(r.column_name)

  const fks: ForeignKey[] = fkRes.rows.map((r: any) => ({
    name: r.name,
    table: r.table,
    columns: r.columns,
    refTable: r.ref_table,
    refColumns: r.ref_columns,
  }))

  const fns = new Map<string, RpcFn>()
  for (const r of fnRes.rows) {
    fns.set(r.proname, { name: r.proname, returnsSet: r.proretset, returnsScalar: !r.proretset && r.typtype !== 'c' })
  }

  cache = { tables, fks, fns, loadedAt: Date.now() }
  return cache
}
