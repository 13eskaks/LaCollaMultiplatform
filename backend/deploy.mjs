// Desplega a Vercel: puja l'output precompilat i, al build remot, aplica migracions.
// Ús: node backend/deploy.mjs   (després de node backend/build.mjs)
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, cpSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const stage = process.env.STAGE_DIR ?? join(root, '.vercel/stage')
rmSync(stage, { recursive: true, force: true })
mkdirSync(join(stage, '.vercel'), { recursive: true })
cpSync(join(root, '.vercel/output'), join(stage, 'prebuilt'), { recursive: true })
cpSync(join(root, '.vercel/migrate-cli.mjs'), join(stage, 'migrate-cli.mjs'))
cpSync(join(root, '.vercel/project.json'), join(stage, '.vercel/project.json'))
writeFileSync(join(stage, 'package.json'), JSON.stringify({ name: 'lacolla-deploy', private: true, type: 'module' }))
writeFileSync(join(stage, 'vercel.json'), JSON.stringify({
  framework: null,
  installCommand: 'echo "sense dependències"',
  buildCommand: 'node migrate-cli.mjs && rm -rf .vercel/output && cp -r prebuilt .vercel/output',
  outputDirectory: '.vercel/output',
}, null, 2))
const token = process.env.VERCEL_TOKEN ?? 'dummytoken123'
execSync(`npx -y vercel@latest deploy --prod --yes --token ${token}`, { cwd: stage, stdio: 'inherit' })
