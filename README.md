# LaColla — Monorepo

App de gestió per a colles valencianes.

## En producció

| | |
|---|---|
| **Web (app completa)** | https://lacolla-omega.vercel.app |
| Backend (mateix domini) | `/rest/v1`, `/auth/v1`, `/storage/v1` |
| Base de dades | Neon Postgres (projecte `lacolla`, Frankfurt) |
| Hosting | Vercel (projecte `lacolla`) |

La mateixa app Expo funciona a la web, iOS i Android i parla amb el mateix backend.

## Estructura

```
lacolla/
├── apps/
│   ├── mobile/          # Expo (React Native) — iOS + Android + Web
│   ├── web/             # Next.js — landings SEO (antic, encara apunta a Supabase)
│   └── admin/           # Next.js — panell superadmin (antic, encara apunta a Supabase)
├── backend/             # API pròpia (Vercel Functions) sobre Postgres/Neon
│   ├── src/             # postgrest.ts, auth.ts, storage.ts, handler.ts...
│   ├── sql/             # 000_compat.sql + migracions noves (038+)
│   ├── test/e2e.mjs     # prova d'integració amb supabase-js
│   ├── build.mjs        # genera .vercel/output (web + funció)
│   └── deploy.mjs       # desplega a Vercel (aplica migracions al build)
├── packages/shared/     # Types, constants i utils compartits
└── supabase/migrations/ # Esquema original (s'aplica tal qual a Neon)
```

## Arquitectura

L'app fa servir `@supabase/supabase-js` però **ja no depèn de Supabase**:
el backend propi implementa el mateix protocol, així que el codi de l'app no ha canviat.

- **Dades** (`/rest/v1`): traductor del protocol PostgREST a SQL parametritzat
  (select amb embeds, filtres, or/and, upsert, count, single, rpc). Cada petició
  s'executa amb `SET ROLE authenticated|anon` i `auth.uid()`, així que **totes
  les polítiques RLS de les migracions s'apliquen igual**.
- **Auth** (`/auth/v1`): registre, login, refresc de sessió, canvi de contrasenya,
  recuperació per correu (Resend), eliminació de compte. JWT HS256 + bcrypt.
- **Storage** (`/storage/v1`): imatges guardades a Postgres (`storage.objects`)
  amb les polítiques de les migracions. Límit 8 MB per fitxer.
- **Temps real**: substituït per consulta periòdica (`lib/realtime.ts`).

### Variables d'entorn (Vercel)

| Variable | Ús |
|---|---|
| `DATABASE_URL` | Connexió a Neon (pooler) |
| `JWT_SECRET` | Signatura de sessions |
| `APP_URL` | URL pública (enllaços de correus) |
| `ADMIN_TOKEN` | Protegeix `/admin/migrate` |
| `AUTH_AUTOCONFIRM` | `true`: no cal confirmar el correu |
| `RESEND_API_KEY`, `MAIL_FROM` | Correus de recuperació |

## Desenvolupament local

```bash
npm install
# Postgres local i variables
export DATABASE_URL=postgres://user:pass@localhost:5432/lacolla
export JWT_SECRET=$(openssl rand -hex 32)
(cd backend && node gen-migrations.mjs && npx tsx src/migrate-cli.ts)   # aplica migracions
npm run dev -w @lacolla/backend          # API a http://localhost:8787
API_URL=http://localhost:8787 node backend/test/e2e.mjs

# App
cd apps/mobile
EXPO_PUBLIC_API_URL=http://localhost:8787 npx expo start      # web, iOS, Android
```

## Desplegar

```bash
cd backend
node build.mjs     # export web + funció API + script de migracions
node deploy.mjs    # puja a Vercel; el build remot aplica les migracions a Neon
```

Les migracions noves van a `backend/sql/NNN_nom.sql` (s'apliquen en ordre i només un cop).

## iOS i Android

`eas.json` ja apunta al backend (`EXPO_PUBLIC_API_URL`). Per publicar:

```bash
cd apps/mobile
eas build --profile production --platform all
eas submit --platform ios
eas submit --platform android
```

---

## Crear el primer superadmin

Registra't a l'app amb el teu email, després executa a l'editor SQL de Neon:

```sql
update profiles
set is_superadmin = true
where email = 'el_teu_email@exemple.com';
```



---

## Configuració de Stripe (Premium de colla)

### 7.1 Crear productes a Stripe
Al dashboard de Stripe → Products, crea:
- **LaColla Premium Colla — Tramo 1 (fins 20 membres)**
  - Preu mensual: 9,99€/mes → copia `price_id` → `STRIPE_PRICE_COLLA_MENSUAL_TRAMO1`
  - Preu anual: 89,99€/any → copia `price_id` → `STRIPE_PRICE_COLLA_ANUAL_TRAMO1`
- Repeteix per a cada tramo (21-60, 61-100, 101-200)

### 7.2 Configurar Webhook de Stripe
```bash
# En local (per a proves)
stripe listen --forward-to localhost:3000/api/stripe/webhook

# En producció, configura el webhook a dashboard.stripe.com
# Event: invoice.upcoming, customer.subscription.updated
# URL: https://lacolla.app/api/stripe/webhook
```

---

## Configuració de RevenueCat (Premium individual)

1. Crea un projecte a [app.revenuecat.com](https://app.revenuecat.com)
2. Connecta App Store Connect i Google Play
3. Crea l'entitlement: `premium_individual`
4. Crea els productes:
   - `lacolla_premium_mensual` — 4,99€/mes
   - `lacolla_premium_anual` — 39,99€/any
5. Copia la Public API Key → `EXPO_PUBLIC_REVENUECAT_API_KEY`

---

## Ordre de desenvolupament recomanat

**Fase 1 — MVP (8-10 setmanes)**
- [ ] Auth (login, registre, verificació email)
- [ ] Onboarding (crear colla, unir-se a colla)
- [ ] Home screen
- [ ] Events (RSVP bàsic)
- [ ] Anuncis de colla
- [ ] Membres
- [ ] Landing pública de colla (SEO)
- [ ] Panel admin bàsic (aprovar colles)

**Fase 2 — Engagement (6-8 setmanes)**
- [ ] Fòrum
- [ ] Votacions
- [ ] Torns de neteja
- [ ] Fotos + àlbums
- [ ] Notificacions push

**Fase 3 — Monetització (4-6 setmanes)**
- [ ] Caixa compartida
- [ ] Carpooling
- [ ] Connexió entre colles
- [ ] Quotes
- [ ] Actes de reunió

**Fase 4 — Premium (4 setmanes)**
- [ ] RevenueCat (premium individual)
- [ ] Stripe (premium de colla per tramos)
- [ ] Anunciants comercials
- [ ] Estadístiques avançades
- [ ] Panel admin complet

---

## Seguretat — checklist pre-producció

- [ ] RLS activat a totes les taules ✓ (fet a 002_rls.sql)
- [ ] Email verification obligatori activat a Supabase Auth
- [ ] Rate limiting activat (Supabase Auth settings)
- [ ] Webhooks de Stripe verificats amb `constructEvent`
- [ ] Panel admin protegit per IP (`ADMIN_ALLOWED_IPS`)
- [ ] 2FA activat al compte de Supabase i Stripe
- [ ] Política de privacitat i GDPR implementats
- [ ] Endpoint d'exportació de dades (GDPR)
- [ ] Soft delete implementat per a usuaris
- [ ] Storage buckets amb polítiques correctes

---

## Preus LaColla

| Pla | Preu |
|-----|------|
| Free | Gratuït (2 colles màx.) |
| Premium Individual | 4,99€/mes · 39,99€/any |
| Premium Colla (fins 20) | 9,99€/mes · 89,99€/any |
| Premium Colla (21-60) | 17,99€/mes · 161,99€/any |
| Premium Colla (61-100) | 27,99€/mes · 251,99€/any |
| Premium Colla (101-200) | 44,99€/mes · 404,99€/any |

---

## Domini

- Ara: `https://lacolla-omega.vercel.app`
- Per fer servir un domini propi (p. ex. `lacolla.app`): afegeix-lo al projecte
  `lacolla` de Vercel, actualitza `APP_URL` a Vercel i `EXPO_PUBLIC_API_URL` a `apps/mobile/eas.json`.
