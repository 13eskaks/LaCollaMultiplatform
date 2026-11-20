/**
 * Implementació compacta del protocol PostgREST (el que fa servir supabase-js
 * per a `.from()` i `.rpc()`), traduïda a SQL parametritzat sobre Postgres.
 *
 * Suporta: select amb columnes, àlies, embeds (many-to-one, one-to-many,
 * `!hint`, `!inner`, `(count)`), filtres (eq, neq, gt, gte, lt, lte, like,
 * ilike, is, in, cs, cd, ov, not.*), or/and niuats, order, limit, offset,
 * filtres/ordre/límit sobre recursos embeguts, Prefer: count=exact,
 * return=representation, resolution=merge|ignore-duplicates, on_conflict,
 * Accept: application/vnd.pgrst.object+json (single) i RPC.
 *
 * Els identificadors es validen contra l'esquema introspectat i els valors
 * sempre van com a paràmetres, així que no hi ha injecció SQL possible.
 */
import type pg from 'pg'
import { getSchema, type Schema, type Table, type ForeignKey, type Column } from './schema.js'

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details: string | null = null,
    public hint: string | null = null,
  ) {
    super(message)
  }
  toJSON() {
    return { code: this.code, message: this.message, details: this.details, hint: this.hint }
  }
}

// ---------------------------------------------------------------------------
// Parsing de select
// ---------------------------------------------------------------------------

type SelectItem =
  | { kind: 'star' }
  | { kind: 'col'; name: string; alias?: string; jsonPath?: string[]; asText?: boolean }
  | { kind: 'count' }
  | { kind: 'embed'; name: string; alias?: string; hint?: string; inner: boolean; items: SelectItem[] }

function splitTop(s: string, sep = ','): string[] {
  const out: string[] = []
  let depth = 0
  let inQ = false
  let cur = ''
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]
    if (ch === '"' && s[i - 1] !== '\\') inQ = !inQ
    if (!inQ) {
      if (ch === '(') depth++
      else if (ch === ')') depth--
      else if (ch === sep && depth === 0) {
        out.push(cur)
        cur = ''
        continue
      }
    }
    cur += ch
  }
  if (cur.length) out.push(cur)
  return out.map(x => x.trim()).filter(x => x.length)
}

export function parseSelect(raw: string): SelectItem[] {
  const s = raw.replace(/\s+/g, '')
  if (!s) return [{ kind: 'star' }]
  return splitTop(s).map(parseSelectItem)
}

function parseSelectItem(item: string): SelectItem {
  if (item === '*') return { kind: 'star' }
  if (item === 'count()' || item === 'count') return { kind: 'count' }
  const paren = item.indexOf('(')
  if (paren > 0 && item.endsWith(')')) {
    let head = item.slice(0, paren)
    const inner = item.slice(paren + 1, -1)
    let alias: string | undefined
    const colon = head.indexOf(':')
    if (colon >= 0) {
      alias = head.slice(0, colon)
      head = head.slice(colon + 1)
    }
    const parts = head.split('!')
    const name = parts[0]
    let hint: string | undefined
    let innerJoin = false
    for (const p of parts.slice(1)) {
      if (p === 'inner') innerJoin = true
      else if (p === 'left') { /* default */ }
      else hint = p
    }
    return { kind: 'embed', name, alias, hint, inner: innerJoin, items: inner ? parseSelect(inner) : [{ kind: 'star' }] }
  }
  let alias: string | undefined
  let rest = item
  const colon = rest.indexOf(':')
  if (colon >= 0 && rest[colon + 1] !== ':') {
    alias = rest.slice(0, colon)
    rest = rest.slice(colon + 1)
  }
  rest = rest.replace(/::\w+$/, '') // ignorem casts
  // camins JSON: col->a->>b
  const m = rest.match(/^([\w]+)((?:->>?[\w]+)*)$/)
  if (!m) throw new ApiError(400, 'PGRST100', `"failed to parse select parameter (${item})"`)
  const name = m[1]
  if (m[2]) {
    const segs = m[2].match(/->>?[\w]+/g) ?? []
    const path = segs.map(sg => sg.replace(/^->>?/, ''))
    const asText = segs.length > 0 && segs[segs.length - 1].startsWith('->>')
    return { kind: 'col', name, alias: alias ?? path[path.length - 1], jsonPath: path, asText }
  }
  return { kind: 'col', name, alias }
}

// ---------------------------------------------------------------------------
// Parsing de filtres
// ---------------------------------------------------------------------------

type Cond =
  | { kind: 'cmp'; path: string[]; col: string; op: string; neg: boolean; value: string }
  | { kind: 'logic'; op: 'and' | 'or'; neg: boolean; children: Cond[] }

const OPS = new Set(['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'match', 'imatch', 'is', 'in', 'cs', 'cd', 'ov', 'isdistinct', 'fts', 'plfts', 'phfts', 'wfts'])

function parseOpValue(path: string[], col: string, v: string): Cond {
  let neg = false
  let rest = v
  if (rest.startsWith('not.')) {
    neg = true
    rest = rest.slice(4)
  }
  const dot = rest.indexOf('.')
  let op = dot >= 0 ? rest.slice(0, dot) : rest
  let value = dot >= 0 ? rest.slice(dot + 1) : ''
  // fts(config).value
  const ftsM = op.match(/^(\w+)\((\w+)\)$/)
  if (ftsM) op = ftsM[1]
  if (!OPS.has(op)) throw new ApiError(400, 'PGRST100', `"failed to parse filter (${v})"`)
  return { kind: 'cmp', path, col, op, neg, value }
}

function parseLogic(op: 'and' | 'or', neg: boolean, inner: string, basePath: string[]): Cond {
  // inner sense parèntesis exteriors
  const children = splitTop(inner).map(part => parseLogicItem(part, basePath))
  return { kind: 'logic', op, neg, children }
}

function parseLogicItem(part: string, basePath: string[]): Cond {
  const lm = part.match(/^(not\.)?(and|or)\((.*)\)$/)
  if (lm) return parseLogic(lm[2] as 'and' | 'or', !!lm[1], lm[3], basePath)
  const dot = part.indexOf('.')
  if (dot < 0) throw new ApiError(400, 'PGRST100', `"failed to parse logic tree (${part})"`)
  const field = part.slice(0, dot)
  return parseOpValue(basePath, field, part.slice(dot + 1))
}

interface ParsedQuery {
  select: SelectItem[]
  // per camí d'embed ('' = arrel)
  conds: Map<string, Cond[]>
  order: Map<string, { col: string; desc: boolean; nulls?: 'first' | 'last' }[]>
  limit: Map<string, number>
  offset: Map<string, number>
  onConflict?: string[]
  columns?: string[]
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns', 'or', 'and', 'not.or', 'not.and'])

export function parseQuery(params: URLSearchParams): ParsedQuery {
  const q: ParsedQuery = {
    select: parseSelect(params.get('select') ?? '*'),
    conds: new Map(),
    order: new Map(),
    limit: new Map(),
    offset: new Map(),
  }
  const push = <T>(m: Map<string, T[]>, k: string, v: T) => {
    const arr = m.get(k) ?? []
    arr.push(v)
    m.set(k, arr)
  }
  for (const [key, value] of params.entries()) {
    if (key === 'select') continue
    if (key === 'on_conflict') {
      q.onConflict = value.split(',').map(s => s.trim()).filter(Boolean)
      continue
    }
    if (key === 'columns') {
      q.columns = value.split(',').map(s => s.trim().replace(/^"|"$/g, '')).filter(Boolean)
      continue
    }
    const segs = key.split('.')
    const last = segs[segs.length - 1]
    // or / and (possiblement amb camí i not.)
    let logicKey = last
    let negLogic = false
    let pathSegs = segs.slice(0, -1)
    if (segs.length >= 2 && segs[segs.length - 2] === 'not' && (last === 'or' || last === 'and')) {
      negLogic = true
      pathSegs = segs.slice(0, -2)
    }
    const path = pathSegs.join('.')
    if (logicKey === 'or' || logicKey === 'and') {
      const inner = value.replace(/^\(/, '').replace(/\)$/, '')
      push(q.conds, path, parseLogic(logicKey, negLogic, inner, pathSegs))
      continue
    }
    if (last === 'order') {
      const items = splitTop(value).map(o => {
        const p = o.split('.')
        const col = p[0]
        let desc = false
        let nulls: 'first' | 'last' | undefined
        for (const x of p.slice(1)) {
          if (x === 'desc') desc = true
          else if (x === 'asc') desc = false
          else if (x === 'nullsfirst') nulls = 'first'
          else if (x === 'nullslast') nulls = 'last'
        }
        return { col, desc, nulls }
      })
      q.order.set(path, [...(q.order.get(path) ?? []), ...items])
      continue
    }
    if (last === 'limit') {
      q.limit.set(path, Math.max(0, parseInt(value, 10) || 0))
      continue
    }
    if (last === 'offset') {
      q.offset.set(path, Math.max(0, parseInt(value, 10) || 0))
      continue
    }
    if (RESERVED.has(key)) continue
    push(q.conds, path, parseOpValue(pathSegs, last, value))
  }
  return q
}

// ---------------------------------------------------------------------------
// Generació SQL
// ---------------------------------------------------------------------------

const qi = (id: string) => '"' + id.replace(/"/g, '""') + '"'

class Ctx {
  params: unknown[] = []
  aliasN = 0
  constructor(public schema: Schema) {}
  p(v: unknown): string {
    this.params.push(v)
    return '$' + this.params.length
  }
  nextAlias() {
    return 't' + ++this.aliasN
  }
}

function getTable(schema: Schema, name: string): Table {
  const t = schema.tables.get(name)
  if (!t) {
    throw new ApiError(404, '42P01', `relation "public.${name}" does not exist`, null,
      `Could not find the table 'public.${name}' in the schema cache`)
  }
  return t
}

function getCol(t: Table, name: string): Column {
  const c = t.columns.get(name)
  if (!c) throw new ApiError(400, '42703', `column ${t.name}.${name} does not exist`)
  return c
}

interface Rel {
  target: string
  fk: ForeignKey
  toOne: boolean // many-to-one (el pare té la FK)
}

function resolveRel(schema: Schema, parent: string, name: string, hint?: string): Rel {
  const candidates: Rel[] = []
  const parentTable = getTable(schema, parent)
  // embed per nom de columna FK del pare: conductor_id(...)
  const asCol = parentTable.columns.has(name)
  for (const fk of schema.fks) {
    if (fk.table === parent && (fk.refTable === name || (asCol && fk.columns.length === 1 && fk.columns[0] === name))) {
      candidates.push({ target: fk.refTable, fk, toOne: true })
    }
    if (fk.refTable === parent && fk.table === name && !(fk.table === parent)) {
      candidates.push({ target: fk.table, fk, toOne: false })
    }
  }
  let filtered = candidates
  if (hint) {
    filtered = candidates.filter(c => c.fk.name === hint || (c.fk.columns.length === 1 && c.fk.columns[0] === hint))
    if (!filtered.length) {
      // el hint també pot ser el nom de la taula destí quan `name` és una columna
      filtered = candidates.filter(c => c.target === hint)
    }
  }
  if (filtered.length > 1) {
    // si totes apunten igual (duplicats), quedem-nos amb la primera
    const toOne = filtered.filter(c => c.toOne)
    if (toOne.length === 1) filtered = toOne
  }
  if (filtered.length === 0) {
    throw new ApiError(400, 'PGRST200',
      `Could not find a relationship between '${parent}' and '${name}' in the schema cache`)
  }
  if (filtered.length > 1) {
    throw new ApiError(300, 'PGRST201',
      `Could not embed because more than one relationship was found for '${parent}' and '${name}'`,
      filtered.map(f => f.fk.name).join(', '),
      `Try changing '${name}' to one of the following: ${filtered.map(f => `'${name}!${f.fk.name}'`).join(', ')}`)
  }
  return filtered[0]
}

function joinCond(rel: Rel, parentAlias: string, childAlias: string): string {
  const parts = rel.fk.columns.map((c, i) => {
    const rc = rel.fk.refColumns[i]
    return rel.toOne
      ? `${childAlias}.${qi(rc)} = ${parentAlias}.${qi(c)}`
      : `${childAlias}.${qi(c)} = ${parentAlias}.${qi(rc)}`
  })
  return parts.join(' and ')
}

function parseList(value: string): string[] {
  const inner = value.replace(/^\(/, '').replace(/\)$/, '')
  const out: string[] = []
  let cur = ''
  let inQ = false
  for (let i = 0; i < inner.length; i++) {
    const ch = inner[i]
    if (ch === '"') { inQ = !inQ; continue }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out.map(x => x.trim()).filter(x => x !== '' || inner === '')
}

function unquote(v: string) {
  return v.length >= 2 && v.startsWith('"') && v.endsWith('"') ? v.slice(1, -1) : v
}

function condSql(ctx: Ctx, cond: Cond, table: Table, alias: string): string {
  if (cond.kind === 'logic') {
    const parts = cond.children.map(c => condSql(ctx, c, table, alias))
    const s = '(' + (parts.length ? parts.join(cond.op === 'and' ? ' and ' : ' or ') : cond.op === 'and' ? 'true' : 'false') + ')'
    return cond.neg ? `not ${s}` : s
  }
  // columna amb possible camí json (col->>key)
  let colExpr: string
  const jm = cond.col.match(/^([\w]+)((?:->>?[\w]+)*)$/)
  if (!jm) throw new ApiError(400, 'PGRST100', `"failed to parse filter (${cond.col})"`)
  getCol(table, jm[1])
  colExpr = `${alias}.${qi(jm[1])}`
  if (jm[2]) {
    for (const seg of jm[2].match(/->>?[\w]+/g) ?? []) {
      const isText = seg.startsWith('->>')
      const key = seg.replace(/^->>?/, '')
      colExpr = `${colExpr}${isText ? '->>' : '->'}${ctx.p(key)}::text`
    }
  }
  const v = unquote(cond.value)
  let sql: string
  switch (cond.op) {
    case 'eq': sql = `${colExpr} = ${ctx.p(v)}`; break
    case 'neq': sql = `${colExpr} <> ${ctx.p(v)}`; break
    case 'gt': sql = `${colExpr} > ${ctx.p(v)}`; break
    case 'gte': sql = `${colExpr} >= ${ctx.p(v)}`; break
    case 'lt': sql = `${colExpr} < ${ctx.p(v)}`; break
    case 'lte': sql = `${colExpr} <= ${ctx.p(v)}`; break
    case 'like': sql = `${colExpr}::text like ${ctx.p(v.replace(/\*/g, '%'))}`; break
    case 'ilike': sql = `${colExpr}::text ilike ${ctx.p(v.replace(/\*/g, '%'))}`; break
    case 'match': sql = `${colExpr}::text ~ ${ctx.p(v)}`; break
    case 'imatch': sql = `${colExpr}::text ~* ${ctx.p(v)}`; break
    case 'isdistinct': sql = `${colExpr} is distinct from ${ctx.p(v)}`; break
    case 'is': {
      const lv = v.toLowerCase()
      if (lv === 'null') sql = `${colExpr} is null`
      else if (lv === 'not_null') sql = `${colExpr} is not null`
      else if (lv === 'true') sql = `${colExpr} is true`
      else if (lv === 'false') sql = `${colExpr} is false`
      else if (lv === 'unknown') sql = `${colExpr} is unknown`
      else throw new ApiError(400, 'PGRST100', `"failed to parse filter (is.${v})"`)
      break
    }
    case 'in': {
      const items = parseList(cond.value)
      sql = items.length ? `${colExpr} in (${items.map(i => ctx.p(i)).join(', ')})` : 'false'
      break
    }
    case 'cs': sql = `${colExpr} @> ${ctx.p(v)}`; break
    case 'cd': sql = `${colExpr} <@ ${ctx.p(v)}`; break
    case 'ov': {
      // ov.(a,b) → array literal
      const val = v.startsWith('(') ? '{' + parseList(v).join(',') + '}' : v
      sql = `${colExpr} && ${ctx.p(val)}`
      break
    }
    case 'fts': sql = `${colExpr} @@ to_tsquery(${ctx.p(v)})`; break
    case 'plfts': sql = `${colExpr} @@ plainto_tsquery(${ctx.p(v)})`; break
    case 'phfts': sql = `${colExpr} @@ phraseto_tsquery(${ctx.p(v)})`; break
    case 'wfts': sql = `${colExpr} @@ websearch_to_tsquery(${ctx.p(v)})`; break
    default: throw new ApiError(400, 'PGRST100', `unsupported operator ${cond.op}`)
  }
  return cond.neg ? `not (${sql})` : sql
}

function orderSql(items: { col: string; desc: boolean; nulls?: 'first' | 'last' }[] | undefined, table: Table, alias: string) {
  if (!items?.length) return ''
  return ' order by ' + items.map(o => {
    getCol(table, o.col)
    return `${alias}.${qi(o.col)}${o.desc ? ' desc' : ' asc'}${o.nulls ? ` nulls ${o.nulls}` : ''}`
  }).join(', ')
}

/** Construeix la llista de columnes (incloent embeds) per a una taula. */
function selectList(ctx: Ctx, q: ParsedQuery, tableName: string, items: SelectItem[], alias: string, path: string[]): { cols: string; innerConds: string[] } {
  const table = getTable(ctx.schema, tableName)
  const cols: string[] = []
  const innerConds: string[] = []
  for (const it of items) {
    if (it.kind === 'star') cols.push(`${alias}.*`)
    else if (it.kind === 'count') cols.push('count(*) as "count"')
    else if (it.kind === 'col') {
      getCol(table, it.name)
      if (it.jsonPath) {
        let e = `${alias}.${qi(it.name)}`
        it.jsonPath.forEach((k, i) => {
          const last = i === it.jsonPath!.length - 1
          e = `${e}${last && it.asText ? '->>' : '->'}${ctx.p(k)}::text`
        })
        cols.push(`${e} as ${qi(it.alias ?? it.name)}`)
      } else {
        cols.push(`${alias}.${qi(it.name)}${it.alias ? ` as ${qi(it.alias)}` : ''}`)
      }
    } else {
      const rel = resolveRel(ctx.schema, tableName, it.name, it.hint)
      const childAlias = ctx.nextAlias()
      const outName = it.alias ?? it.name
      const childPath = [...path, outName]
      const pathKey = childPath.join('.')
      // filtres d'aquest embed: per àlies o per nom
      const altKey = [...path, it.name].join('.')
      const embedConds = [...(q.conds.get(pathKey) ?? []), ...(pathKey !== altKey ? q.conds.get(altKey) ?? [] : [])]
      const targetTable = getTable(ctx.schema, rel.target)
      const whereParts = [joinCond(rel, alias, childAlias), ...embedConds.map(c => condSql(ctx, c, targetTable, childAlias))]
      const isCountOnly = it.items.length === 1 && it.items[0].kind === 'count'
      if (isCountOnly) {
        const where = whereParts.join(' and ')
        cols.push(`(select json_build_array(json_build_object('count', count(*))) from public.${qi(rel.target)} ${childAlias} where ${where}) as ${qi(outName)}`)
        if (it.inner) innerConds.push(`exists (select 1 from public.${qi(rel.target)} ${childAlias} where ${where})`)
        continue
      }
      const sub = selectList(ctx, q, rel.target, it.items, childAlias, childPath)
      const where = [...whereParts, ...sub.innerConds].join(' and ')
      const ord = orderSql(q.order.get(pathKey) ?? q.order.get(altKey), targetTable, childAlias)
      const lim = q.limit.get(pathKey) ?? q.limit.get(altKey)
      const off = q.offset.get(pathKey) ?? q.offset.get(altKey)
      const limSql = (lim !== undefined ? ` limit ${lim}` : '') + (off ? ` offset ${off}` : '')
      if (rel.toOne) {
        cols.push(`(select row_to_json(_e) from (select ${sub.cols} from public.${qi(rel.target)} ${childAlias} where ${where} limit 1) _e) as ${qi(outName)}`)
      } else {
        cols.push(`(select coalesce(json_agg(_e), '[]'::json) from (select ${sub.cols} from public.${qi(rel.target)} ${childAlias} where ${where}${ord}${limSql}) _e) as ${qi(outName)}`)
      }
      if (it.inner || embedConds.length && false) {
        innerConds.push(`exists (select 1 from public.${qi(rel.target)} ${childAlias} where ${[...whereParts, ...sub.innerConds].join(' and ')})`)
      }
    }
  }
  return { cols: cols.length ? cols.join(', ') : `${alias}.*`, innerConds }
}

function rootWhere(ctx: Ctx, q: ParsedQuery, table: Table, alias: string, extra: string[] = []) {
  const parts = [...(q.conds.get('') ?? []).map(c => condSql(ctx, c, table, alias)), ...extra]
  return parts.length ? ' where ' + parts.join(' and ') : ''
}

// ---------------------------------------------------------------------------
// Execució
// ---------------------------------------------------------------------------

export interface PgRequest {
  method: string
  table: string
  params: URLSearchParams
  prefer: string
  accept: string
  body: unknown
}

export interface PgResponse {
  status: number
  body: unknown
  headers: Record<string, string>
}

function wantsSingle(accept: string) {
  return accept.includes('application/vnd.pgrst.object+json')
}

function shapeResult(rows: unknown[], accept: string, status: number, headers: Record<string, string>, method: string): PgResponse {
  if (wantsSingle(accept)) {
    if (rows.length !== 1) {
      throw new ApiError(406, 'PGRST116', 'JSON object requested, multiple (or no) rows returned',
        `The result contains ${rows.length} rows`)
    }
    return { status, body: rows[0], headers }
  }
  return { status, body: method === 'HEAD' ? null : rows, headers }
}

function paramValue(col: Column, v: unknown): unknown {
  if (v === null || v === undefined) return null
  if (col.dataType === 'json' || col.dataType === 'jsonb') return JSON.stringify(v)
  if (col.dataType === 'ARRAY') return Array.isArray(v) ? v : v
  if (typeof v === 'object') return JSON.stringify(v)
  return v
}

export async function handlePostgrest(client: pg.PoolClient, req: PgRequest): Promise<PgResponse> {
  const schema = await getSchema()
  const table = getTable(schema, req.table)
  const q = parseQuery(req.params)
  const ctx = new Ctx(schema)
  const prefer = req.prefer
  const wantCount = /count=(exact|planned|estimated)/.test(prefer)
  const returnRep = /return=representation/.test(prefer)
  const headers: Record<string, string> = {}

  if (req.method === 'GET' || req.method === 'HEAD') {
    const sel = selectList(ctx, q, table.name, q.select, 't0', [])
    const where = rootWhere(ctx, q, table, 't0', sel.innerConds)
    const ord = orderSql(q.order.get(''), table, 't0')
    const lim = q.limit.get('')
    const off = q.offset.get('')
    const limSql = (lim !== undefined ? ` limit ${lim}` : '') + (off ? ` offset ${off}` : '')
    const isAggregate = q.select.length === 1 && q.select[0].kind === 'count'
    const sql = isAggregate
      ? `select coalesce(json_agg(_r), '[]'::json) as body from (select count(*) as "count" from public.${qi(table.name)} t0${where}) _r`
      : `select coalesce(json_agg(_r), '[]'::json) as body from (select ${sel.cols} from public.${qi(table.name)} t0${where}${ord}${limSql}) _r`
    const params = [...ctx.params]
    const res = req.method === 'HEAD' && !wantsSingle(req.accept) ? { rows: [{ body: [] }] } : await client.query(sql, params)
    const rows = (res.rows[0]?.body ?? []) as unknown[]
    if (wantCount) {
      const cctx = new Ctx(schema)
      const csel = selectList(cctx, q, table.name, q.select, 't0', [])
      const cwhere = rootWhere(cctx, q, table, 't0', csel.innerConds)
      const cres = await client.query(`select count(*)::int as n from public.${qi(table.name)} t0${cwhere}`, cctx.params)
      const total = cres.rows[0].n as number
      const start = off ?? 0
      headers['Content-Range'] = rows.length ? `${start}-${start + rows.length - 1}/${total}` : `*/${total}`
    } else {
      const start = off ?? 0
      headers['Content-Range'] = rows.length ? `${start}-${start + rows.length - 1}/*` : '*/*'
    }
    return shapeResult(rows, req.accept, 200, headers, req.method)
  }

  // Mutacions -------------------------------------------------------------
  let mutation: string
  if (req.method === 'POST') {
    const rowsIn = Array.isArray(req.body) ? req.body : [req.body]
    if (!rowsIn.length) return { status: 201, body: returnRep ? [] : null, headers }
    const keys: string[] = []
    for (const r of rowsIn) {
      if (!r || typeof r !== 'object') throw new ApiError(400, 'PGRST102', 'Empty or invalid json')
      for (const k of Object.keys(r)) if (!keys.includes(k)) keys.push(k)
    }
    const cols = keys.map(k => {
      const c = table.columns.get(k)
      if (!c) throw new ApiError(400, 'PGRST204', `Could not find the '${k}' column of '${table.name}' in the schema cache`)
      return c
    })
    const values = rowsIn.map((r: any) =>
      '(' + cols.map(c => (Object.prototype.hasOwnProperty.call(r, c.name) ? ctx.p(paramValue(c, r[c.name])) : 'default')).join(', ') + ')')
    let conflict = ''
    const resolution = prefer.match(/resolution=(merge|ignore)-duplicates/)?.[1]
    if (resolution) {
      const target = q.onConflict?.length ? q.onConflict : table.pk
      target.forEach(c => getCol(table, c))
      if (resolution === 'ignore') conflict = ` on conflict (${target.map(qi).join(', ')}) do nothing`
      else {
        const upd = cols.filter(c => !target.includes(c.name))
        conflict = upd.length
          ? ` on conflict (${target.map(qi).join(', ')}) do update set ${upd.map(c => `${qi(c.name)} = excluded.${qi(c.name)}`).join(', ')}`
          : ` on conflict (${target.map(qi).join(', ')}) do nothing`
      }
    }
    mutation = keys.length
      ? `insert into public.${qi(table.name)} as t0 (${cols.map(c => qi(c.name)).join(', ')}) values ${values.join(', ')}${conflict} returning t0.*`
      : `insert into public.${qi(table.name)} as t0 default values returning t0.*`
  } else if (req.method === 'PATCH') {
    const body = req.body as Record<string, unknown>
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'PGRST102', 'Empty or invalid json')
    const sets = Object.keys(body).map(k => {
      const c = table.columns.get(k)
      if (!c) throw new ApiError(400, 'PGRST204', `Could not find the '${k}' column of '${table.name}' in the schema cache`)
      return `${qi(k)} = ${ctx.p(paramValue(c, body[k]))}`
    })
    if (!sets.length) return { status: 204, body: null, headers }
    const where = rootWhere(ctx, q, table, 't0')
    mutation = `update public.${qi(table.name)} as t0 set ${sets.join(', ')}${where} returning t0.*`
  } else if (req.method === 'DELETE') {
    const where = rootWhere(ctx, q, table, 't0')
    mutation = `delete from public.${qi(table.name)} as t0${where} returning t0.*`
  } else {
    throw new ApiError(405, 'PGRST117', `Unsupported HTTP method: ${req.method}`)
  }

  const status = req.method === 'POST' ? 201 : returnRep ? 200 : 204
  if (!returnRep) {
    // Sense RETURNING: igual que PostgREST amb return=minimal, així no cal
    // que la fila nova siga visible per la política SELECT.
    const r = await client.query(mutation.replace(/ returning t0\.\*$/, ''), ctx.params)
    if (wantCount) headers['Content-Range'] = `*/${r.rowCount ?? 0}`
    return { status, body: null, headers }
  }
  // Retorn amb select (embeds referenciant la fila mutada com a t0)
  const sel = selectList(ctx, q, table.name, q.select, 't0', [])
  const sql = `with _m as (${mutation}) select coalesce(json_agg(_r), '[]'::json) as body from (select ${sel.cols} from _m t0) _r`
  const r = await client.query(sql, ctx.params)
  const rows = (r.rows[0]?.body ?? []) as unknown[]
  if (wantCount) headers['Content-Range'] = `*/${rows.length}`
  return shapeResult(rows, req.accept, status, headers, req.method)
}

export async function handleRpc(client: pg.PoolClient, fnName: string, args: Record<string, unknown>, accept: string, params: URLSearchParams): Promise<PgResponse> {
  const schema = await getSchema()
  const fn = schema.fns.get(fnName)
  if (!fn) throw new ApiError(404, 'PGRST202', `Could not find the function public.${fnName} in the schema cache`)
  const ctx = new Ctx(schema)
  const argSql = Object.entries(args ?? {}).map(([k, v]) => {
    if (!/^\w+$/.test(k)) throw new ApiError(400, 'PGRST100', `invalid argument ${k}`)
    return `${qi(k)} => ${ctx.p(v !== null && typeof v === 'object' ? JSON.stringify(v) : v)}`
  }).join(', ')
  const call = `public.${qi(fnName)}(${argSql})`
  if (fn.returnsScalar) {
    const r = await client.query(`select to_json(${call}) as body`, ctx.params)
    return { status: 200, body: r.rows[0]?.body ?? null, headers: {} }
  }
  const r = await client.query(`select coalesce(json_agg(_r), '[]'::json) as body from ${call} _r`, ctx.params)
  const rows = r.rows[0]?.body ?? []
  if (!fn.returnsSet) {
    return { status: 200, body: rows[0] ?? null, headers: {} }
  }
  return shapeResult(rows, accept, 200, {}, 'POST')
}

/** Converteix errors de Postgres en respostes estil PostgREST. */
export function pgErrorToApi(e: any, authenticated: boolean): ApiError {
  if (e instanceof ApiError) return e
  const code: string = e?.code ?? 'PGRST000'
  const message: string = e?.message ?? 'Internal error'
  const details = e?.detail ?? null
  const hint = e?.hint ?? null
  let status = 400
  if (code === '42501') status = authenticated ? 403 : 401
  else if (code === '23505') status = 409
  else if (code === '23503') status = 409
  else if (code === 'P0001') status = 400
  else if (code.startsWith('08') || code === 'PGRST000') status = 503
  else if (code === '42883' || code === '42P01') status = 404
  return new ApiError(status, code, message, details, hint)
}
