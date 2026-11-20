// Construeix .vercel/output (Build Output API v3): web estàtica + funció API.
import { build } from 'esbuild'
import { execSync } from 'node:child_process'
import { mkdirSync, rmSync, writeFileSync, cpSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const out = join(root, '.vercel/output')
const webDist = process.env.WEB_DIST ?? join(root, 'apps/mobile/dist')

execSync('node gen-migrations.mjs', { cwd: here, stdio: 'inherit' })
if (!process.env.SKIP_WEB) {
  execSync(`npx expo export -p web --output-dir ${webDist}`, { cwd: join(root, 'apps/mobile'), stdio: 'inherit' })
}
if (!existsSync(join(webDist, 'index.html'))) throw new Error(`No hi ha export web a ${webDist}`)

rmSync(out, { recursive: true, force: true })
mkdirSync(join(out, 'static'), { recursive: true })
cpSync(webDist, join(out, 'static'), { recursive: true })

const fn = join(out, 'functions/api.func')
mkdirSync(fn, { recursive: true })
await build({
  entryPoints: [join(here, 'src/vercel.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  outfile: join(fn, 'index.js'),
  external: ['pg-native'],
  minify: false,
  sourcemap: false,
})
writeFileSync(join(fn, '.vc-config.json'), JSON.stringify({
  runtime: 'nodejs22.x',
  handler: 'index.js',
  launcherType: 'Nodejs',
  shouldAddHelpers: false,
  maxDuration: 30,
  regions: ['fra1'],
}, null, 2))

// Script de migracions per al pas de build remot de Vercel
await build({
  entryPoints: [join(here, 'src/migrate-cli.ts')],
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  outfile: join(root, '.vercel/migrate-cli.mjs'),
  external: ['pg-native'],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
})

const API = '(rest|auth|storage|functions|realtime|admin)'
writeFileSync(join(out, 'config.json'), JSON.stringify({
  version: 3,
  routes: [
    { src: `^/${API}(/.*)?$`, dest: '/api?__path=/$1$2' },
    { src: '^/health$', dest: '/api?__path=/health' },
    { src: '^/_expo/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { src: '^/assets/(.*)$', headers: { 'Cache-Control': 'public, max-age=31536000, immutable' }, continue: true },
    { handle: 'filesystem' },
    { src: '^/(.*)$', dest: '/index.html' },
  ],
}, null, 2))
console.log('Build Output llest a', out)
