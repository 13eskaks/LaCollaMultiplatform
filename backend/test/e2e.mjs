// Prova d'integració: supabase-js contra el backend propi.
// Ús: API_URL=http://localhost:8787 node backend/test/e2e.mjs
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'node:crypto'

const URL = process.env.API_URL ?? 'http://localhost:8787'
const ANON = process.env.ANON_KEY ?? 'anon'
let fails = 0
const ok = (name, cond, extra) => {
  if (cond) console.log('  ✓', name)
  else { fails++; console.log('  ✗', name, extra !== undefined ? JSON.stringify(extra).slice(0, 400) : '') }
}
const mk = () => createClient(URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } })

const tag = Date.now()
const a = mk(), b = mk()
console.log('auth')
let r = await a.auth.signUp({ email: `a${tag}@test.dev`, password: 'secret123', options: { data: { nom: 'Anna', cognoms: 'Test' } } })
ok('signup A', !r.error && r.data.session, r.error)
r = await a.auth.signUp({ email: `a${tag}@test.dev`, password: 'secret123' })
ok('signup duplicate fails', !!r.error, r)
r = await b.auth.signUp({ email: `b${tag}@test.dev`, password: 'secret123', options: { data: { nom: 'Biel' } } })
ok('signup B', !r.error, r.error)
r = await b.auth.signInWithPassword({ email: `b${tag}@test.dev`, password: 'wrong' })
ok('bad password rejected', r.error?.message === 'Invalid login credentials', r.error)
r = await b.auth.signInWithPassword({ email: `B${tag}@test.dev`, password: 'secret123' })
ok('login B (case-insensitive)', !r.error && r.data.session, r.error)
const { data: { user: ua } } = await a.auth.getUser()
const { data: { user: ub } } = await b.auth.getUser()
ok('getUser', ua?.id && ub?.id && ua.email_confirmed_at)
r = await a.auth.refreshSession()
ok('refresh session', !r.error && r.data.session, r.error)

console.log('profiles')
r = await a.from('profiles').select('*').eq('id', ua.id).single()
ok('profile created by trigger', r.data?.nom === 'Anna', r)

console.log('colla')
const collaId = randomUUID()
r = await a.from('colles').insert({ id: collaId, nom: 'Colla Prova', slug: 'colla-prova-' + tag, localitat: 'Alzira', estat: 'activa' })
ok('insert colla', !r.error, r.error)
r = await a.from('colla_membres').insert({ colla_id: collaId, user_id: ua.id, estat: 'actiu', rol: 'president' })
ok('insert president', !r.error, r.error)
r = await a.from('colla_config').upsert({ colla_id: collaId, aprovacio_manual: true, perfil_public: true })
ok('upsert config', !r.error, r.error)
r = await a.from('colla_config').upsert({ colla_id: collaId, aprovacio_manual: false })
ok('upsert config again (merge)', !r.error, r.error)
r = await a.from('colles').select('id, nom, localitat, comarca, latitud, longitud').eq('id', collaId).single()
ok('select colla with latitud', r.data?.nom === 'Colla Prova', r)
r = await b.from('colles').select('id, nom').eq('estat', 'activa').ilike('nom', '%prova%')
ok('B can search colla', r.data?.some(c => c.id === collaId), r)
r = await b.from('colla_membres').insert({ colla_id: collaId, user_id: ub.id, estat: 'pendent', rol: 'membre' })
ok('B requests join', !r.error, r.error)
r = await a.from('colla_membres').select('id, user_id, created_at, profiles!user_id(nom, avatar_url)').eq('colla_id', collaId).eq('estat', 'pendent').order('created_at', { ascending: true })
ok('A sees pending with embed', r.data?.[0]?.profiles?.nom === 'Biel', r)
r = await a.from('colla_membres').update({ estat: 'actiu' }).eq('colla_id', collaId).eq('user_id', ub.id).select()
ok('A approves B', r.data?.length === 1, r)
r = await a.from('colla_membres').select('*, colles(*)').eq('user_id', ua.id)
ok('embed colles(*)', r.data?.[0]?.colles?.nom === 'Colla Prova', r)
r = await a.rpc('get_colla_membres_count', { p_colla_id: collaId })
ok('rpc count', r.data === 2, r)

console.log('events')
r = await a.from('events').insert({ colla_id: collaId, titol: 'Sopar', data_inici: new Date(Date.now() + 86400e3).toISOString(), created_by: ua.id }).select().single()
ok('insert event + select single', r.data?.titol === 'Sopar', r.error)
const ev = r.data
if (ev) {
  r = await b.from('event_rsvp').upsert({ event_id: ev.id, user_id: ub.id, estat: 'apuntat' }, { onConflict: 'event_id,user_id' })
  ok('rsvp upsert', !r.error, r.error)
  const now = new Date().toISOString()
  r = await b.from('events').select('id, titol, data_inici, data_fi, lloc, color, limit_places, event_rsvp(estat)').eq('colla_id', collaId)
    .or(`data_fi.gte.${now},and(data_fi.is.null,data_inici.gte.${now.slice(0, 10)})`).order('data_inici')
  ok('events with or/and + embed', r.data?.[0]?.event_rsvp?.length === 1, r)
  r = await b.from('events').select('id', { count: 'exact', head: true }).eq('colla_id', collaId)
  ok('count head', r.count === 1, r)
  r = await b.from('events').select('*').eq('id', ev.id).maybeSingle()
  ok('maybeSingle', r.data?.id === ev.id, r)
  r = await b.from('events').select('*').eq('id', randomUUID()).maybeSingle()
  ok('maybeSingle none', r.data === null && !r.error, r)
  r = await b.from('events').select('*').eq('id', randomUUID()).single()
  ok('single none → PGRST116', r.error?.code === 'PGRST116', r)
}

console.log('forum')
r = await a.from('forum_fils').insert({ colla_id: collaId, titol: 'Hola', creador_id: ua.id }).select().single()
ok('insert fil', !r.error, r.error)
if (r.data) {
  const fil = r.data
  r = await b.from('forum_missatges').insert({ fil_id: fil.id, user_id: ub.id, text: 'bon dia' })
  ok('insert missatge', !r.error, r.error)
  r = await a.from('forum_fils').select('*, profiles(nom, avatar_url), forum_missatges(count)').eq('colla_id', collaId)
  ok('embed count', r.data?.[0]?.forum_missatges?.[0]?.count === 1, r)
}

console.log('security')
const anon = mk()
r = await anon.from('colla_membres').select('*').eq('colla_id', collaId)
ok('anon cannot read members', !r.error && r.data.length === 0, r)
r = await anon.from('colles').insert({ nom: 'x' })
ok('anon cannot insert colla', !!r.error, r)
r = await b.from('colles').update({ nom: 'hack' }).eq('id', collaId).select()
ok('B (membre) cannot rename colla', (r.data?.length ?? 0) === 0, r)
r = await a.from('nonexistent').select('*')
ok('unknown table errors', !!r.error, r)
r = await a.from('colles').select('nope')
ok('unknown column errors', r.error?.code === '42703', r)
r = await a.from('colles').select('*').eq('nom', "x'; drop table colles; --")
ok('injection-safe filter', !r.error && r.data.length === 0, r)

console.log('storage')
const png = Buffer.from('89504e470d0a1a0a0000000d4948445200000001000000010806000000', 'hex')
r = await a.storage.from('avatars').upload(`${ua.id}/avatar.png`, png, { contentType: 'image/png', upsert: true })
ok('upload avatar', !r.error, r.error)
r = await a.storage.from('avatars').upload(`${ua.id}/avatar.png`, png, { contentType: 'image/png', upsert: true })
ok('upload avatar upsert', !r.error, r.error)
r = await b.storage.from('avatars').upload(`${ua.id}/evil.png`, png, { contentType: 'image/png' })
ok('B cannot write A folder', !!r.error, r)
const pub = a.storage.from('avatars').getPublicUrl(`${ua.id}/avatar.png`).data.publicUrl
const res = await fetch(pub)
ok('public download', res.ok && res.headers.get('content-type') === 'image/png', res.status)
r = await a.storage.from('colla-fotos').upload(`${collaId}/x.png`, new Blob([png], { type: 'image/png' }))
ok('upload colla-fotos (multipart blob)', !r.error, r.error)
r = await a.storage.from('imatges').upload(`anunci/${randomUUID()}/1.png`, png, { contentType: 'image/png', upsert: true })
ok('upload imatges with non-uuid folder', !r.error, r.error)
r = await a.storage.from('colla-fotos').remove([`${collaId}/x.png`])
ok('remove', r.data?.length === 1, r)

console.log('auth update/logout')
r = await a.auth.updateUser({ password: 'newpass123' })
ok('update password', !r.error, r.error)
r = await mk().auth.signInWithPassword({ email: `a${tag}@test.dev`, password: 'newpass123' })
ok('login with new password', !r.error, r.error)
r = await a.auth.signOut()
ok('signOut', !r.error, r.error)

console.log('cleanup')
const a2 = mk()
await a2.auth.signInWithPassword({ email: `a${tag}@test.dev`, password: 'newpass123' })
r = await a2.from('colles').delete().eq('id', collaId).select()
ok('president deletes colla', r.data?.length === 1, r)
for (const c of [a2, b]) {
  const { data: { session } } = await c.auth.getSession()
  const res = await fetch(`${URL}/auth/v1/user`, { method: 'DELETE', headers: { Authorization: `Bearer ${session?.access_token}` } })
  ok('delete account', res.status === 204, res.status)
}
r = await mk().auth.signInWithPassword({ email: `b${tag}@test.dev`, password: 'secret123' })
ok('deleted account cannot login', !!r.error, r)

console.log(fails ? `\n${fails} FALLADES` : '\nTOT OK')
process.exit(fails ? 1 : 0)
