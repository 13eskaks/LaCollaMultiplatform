import { createServer } from 'node:http'
import { handle } from './handler.js'
import { toWebRequest, sendWebResponse } from './node-adapter.js'

const port = Number(process.env.PORT ?? 8787)
createServer(async (req, res) => {
  const webReq = await toWebRequest(req, `http://localhost:${port}`)
  const webRes = await handle(webReq)
  await sendWebResponse(res, webRes)
}).listen(port, () => console.log(`API a http://localhost:${port}`))
