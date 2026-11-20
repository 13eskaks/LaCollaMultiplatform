import type { IncomingMessage, ServerResponse } from 'node:http'

export async function toWebRequest(req: IncomingMessage, base: string): Promise<Request> {
  const chunks: Buffer[] = []
  for await (const c of req) chunks.push(c as Buffer)
  const body = chunks.length ? Buffer.concat(chunks) : undefined
  const headers = new Headers()
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach(x => headers.append(k, x))
    else if (v !== undefined) headers.set(k, v)
  }
  const proto = (req.headers['x-forwarded-proto'] as string) ?? new URL(base).protocol.replace(':', '')
  const host = req.headers['x-forwarded-host'] ?? req.headers.host
  const url = host ? `${proto}://${host}${req.url}` : new URL(req.url ?? '/', base).toString()
  return new Request(url, {
    method: req.method,
    headers,
    body: body && req.method !== 'GET' && req.method !== 'HEAD' ? body : undefined,
  })
}

export async function sendWebResponse(res: ServerResponse, webRes: Response) {
  res.statusCode = webRes.status
  webRes.headers.forEach((v, k) => res.setHeader(k, v))
  if (webRes.body) res.end(Buffer.from(await webRes.arrayBuffer()))
  else res.end()
}
