import { Platform } from 'react-native'
import { supabase } from './supabase'
import { API_URL, ANON_KEY } from './config'

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/png': 'png', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
}

/** Extensió i MIME a partir de l'asset de l'image picker (funciona amb blob:/data: a la web). */
export function imageInfo(uri: string, mimeType?: string | null): { ext: string; mime: string } {
  if (mimeType && MIME_EXT[mimeType]) return { ext: MIME_EXT[mimeType], mime: mimeType }
  const dataMatch = uri.match(/^data:(image\/[\w+.-]+);/)
  if (dataMatch && MIME_EXT[dataMatch[1]]) return { ext: MIME_EXT[dataMatch[1]], mime: dataMatch[1] }
  const raw = uri.split('?')[0].split('#')[0].split('.').pop()?.toLowerCase() ?? ''
  const ext = raw === 'jpeg' ? 'jpg' : raw
  if (/^(jpg|png|gif|webp|heic|heif)$/.test(ext)) return { ext, mime: ext === 'jpg' ? 'image/jpeg' : `image/${ext}` }
  return { ext: 'jpg', mime: 'image/jpeg' }
}

export function publicUrl(bucket: string, path: string) {
  return supabase.storage.from(bucket).getPublicUrl(path).data.publicUrl
}

/**
 * Puja una imatge local (file://, content://, blob:, data:) al bucket indicat.
 * Retorna la URL pública. Llança error si falla.
 */
export async function uploadImage(bucket: string, path: string, uri: string, mime: string, upsert = true): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('No hi ha sessió')
  const form = new FormData()
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob()
    form.append('file', new Blob([blob], { type: mime || blob.type }), path.split('/').pop() ?? 'upload')
  } else {
    form.append('file', { uri, type: mime, name: path.split('/').pop() ?? 'upload' } as any)
  }
  const res = await fetch(`${API_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: ANON_KEY,
      'x-upsert': upsert ? 'true' : 'false',
    },
    body: form,
  })
  if (!res.ok) {
    let msg = `Error ${res.status}`
    try { msg = (await res.json()).message ?? msg } catch { /* ignore */ }
    throw new Error(msg)
  }
  return publicUrl(bucket, path)
}
