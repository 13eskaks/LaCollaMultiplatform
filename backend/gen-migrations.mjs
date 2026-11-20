// Genera src/migrations.generated.ts amb totes les migracions SQL en ordre.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const sources = [
  { dir: join(here, 'sql'), filter: f => f.startsWith('000_') },
  { dir: join(here, '../supabase/migrations'), filter: () => true },
  { dir: join(here, 'sql'), filter: f => !f.startsWith('000_') },
]
const list = []
for (const s of sources) {
  for (const f of readdirSync(s.dir).filter(f => f.endsWith('.sql') && s.filter(f)).sort()) {
    list.push({ name: f, sql: readFileSync(join(s.dir, f), 'utf8') })
  }
}
writeFileSync(join(here, 'src/migrations.generated.ts'),
  '// Fitxer generat per gen-migrations.mjs. No editar a mà.\nexport const MIGRATIONS: { name: string; sql: string }[] = ' + JSON.stringify(list, null, 1) + '\n')
console.log(`migrations: ${list.length}`)
