import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { join, extname, normalize } from 'node:path'
import { handle } from './handler.js'
import { toWebRequest, sendWebResponse } from './node-adapter.js'

const port = Number(process.env.PORT ?? 8787)
const staticDir = process.env.STATIC_DIR // opcional: serveix l'export web de l'app
const API_PREFIXES = ['/rest/', '/auth/', '/storage/', '/functions/', '/realtime/', '/admin/', '/health', '/api/']
const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.woff2': 'font/woff2',
}

createServer(async (req, res) => {
  const path = (req.url ?? '/').split('?')[0]
  if (staticDir && !API_PREFIXES.some(p => path.startsWith(p))) {
    let file = join(staticDir, normalize(decodeURIComponent(path)).replace(/^(\.\.[/\\])+/, ''))
    try {
      if (!(await stat(file)).isFile()) throw new Error()
    } catch {
      file = join(staticDir, 'index.html')
    }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream')
    res.end(await readFile(file))
    return
  }
  const webReq = await toWebRequest(req, `http://localhost:${port}`)
  const webRes = await handle(webReq)
  await sendWebResponse(res, webRes)
}).listen(port, () => console.log(`API a http://localhost:${port}${staticDir ? ` (web: ${staticDir})` : ''}`))
