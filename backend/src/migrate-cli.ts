// S'executa durant el build de Vercel: aplica les migracions pendents a Neon.
import { runMigrations } from './migrate.js'
import { getPool } from './db.js'

const result = await runMigrations()
console.log('[migrate]', JSON.stringify(result))
await getPool().end()
if (!result.ok) process.exit(1)
