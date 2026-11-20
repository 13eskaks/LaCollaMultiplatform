// Punt d'entrada per a la funció serverless de Vercel (launcher Node).
import type { IncomingMessage, ServerResponse } from 'node:http'
import { handle } from './handler.js'
import { toWebRequest, sendWebResponse } from './node-adapter.js'

export default async function vercelHandler(req: IncomingMessage, res: ServerResponse) {
  const webReq = await toWebRequest(req, 'https://localhost')
  const webRes = await handle(webReq)
  await sendWebResponse(res, webRes)
}
