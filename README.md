# LaColla — Monorepo

App de gestió per a colles valencianes.

## Estructura

```
lacolla/
├── apps/
│   ├── mobile/          # Expo (React Native) — iOS + Android
│   ├── web/             # Next.js — landings públiques + SEO
│   └── admin/           # Next.js — panell superadmin
├── packages/
│   └── shared/          # Types, constants i utils compartits
└── supabase/
    ├── migrations/       # SQL schema + RLS
    └── functions/        # Edge Functions (Deno)
```

## Stack

| Capa | Tecnologia |
|------|-----------|
| Mobile | Expo 51 + React Native |
| Web pública | Next.js 14 App Router |
| Panel admin | Next.js 14 App Router |
| Backend | Supabase (PostgreSQL + Auth + Storage + Realtime) |
| Edge Functions | Deno (Supabase Functions) |
| Pagaments individuals | RevenueCat |
| Pagaments de colla | Stripe |
| Notificacions push | Expo Notifications |
| Monorepo | Turborepo |

---

## 1. Requisits previs

- Node.js >= 20
- npm >= 10
- Expo CLI: `npm install -g expo-cli eas-cli`
- Supabase CLI: `npm install -g supabase`
- Compte a [supabase.com](https://supabase.com)
- Compte a [stripe.com](https://stripe.com)
- Compte a [revenuecat.com](https://revenuecat.com)
- Compte a [expo.dev](https://expo.dev)

---

## 2. Configuració de Supabase

### 2.1 Crear projecte
1. Ves a [app.supabase.com](https://app.supabase.com)
2. Crea un nou projecte: `lacolla`
3. Guarda la URL i les claus (anon key + service role key)

### 2.2 Executar les migracions
```bash
# Des de la carpeta arrel del projecte
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# Executar les migracions en ordre
supabase db push
```

O manualment des del SQL Editor de Supabase:
1. Executa `supabase/migrations/001_schema.sql`
2. Executa `supabase/migrations/002_rls.sql`

### 2.3 Configurar Storage
Al panell de Supabase → Storage, crea els buckets:
- `fotos` (public: false)
- `colles` (public: true — avatars i portades)
- `profiles` (public: true — avatars)
- `anuncis` (public: true — banners)
- `events` (public: false)

### 2.4 Configurar Auth
Al panell de Supabase → Authentication → Providers:
- Email: activat ✓
- Google: afegir Client ID i Secret (des de Google Cloud Console)
- Apple: afegir Key ID, Team ID i Private Key (des de Apple Developer)

### 2.5 Desplegar Edge Functions
```bash
supabase functions deploy notify-solicitud
supabase functions deploy get-anunci
supabase functions deploy recalcular-tramo

# Variables d'entorn per a les funcions
supabase secrets set STRIPE_SECRET_KEY=sk_...
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_...
```

### 2.6 Configurar Webhooks de base de dades
Al panell → Database → Webhooks, crea:
- Nom: `on_solicitud_entrada`
- Taula: `colla_membres`
- Events: `INSERT`
- URL: `https://YOUR_PROJECT.supabase.co/functions/v1/notify-solicitud`

---

## 3. Variables d'entorn

### Web (`apps/web/.env.local`)
```bash
cp apps/web/.env.local.example apps/web/.env.local
# Edita amb les teues claus
```

### Admin (`apps/admin/.env.local`)
```bash
cp apps/admin/.env.local.example apps/admin/.env.local
```

### Mobile (`apps/mobile/.env.local`)
```bash
cp apps/mobile/.env.local.example apps/mobile/.env.local
```

---

## 4. Instal·lar dependències

```bash
# Des de la carpeta arrel
npm install
```

---

## 5. Desenvolupament local

```bash
# Web pública (port 3000)
npm run dev:web

# Panel admin (port 3001)
npm run dev:admin

# App mòbil
npm run dev:mobile
# Escanejar el QR amb Expo Go
```

---

## 6. Crear el primer superadmin

Registra't a l'app amb el teu email, després executa al SQL Editor de Supabase:

```sql
update profiles
set is_superadmin = true
where email = 'el_teu_email@exemple.com';
```

Ara pots accedir al panell admin a `http://localhost:3001`.

---

## 7. Configuració de Stripe (Premium de colla)

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

## 8. Configuració de RevenueCat (Premium individual)

1. Crea un projecte a [app.revenuecat.com](https://app.revenuecat.com)
2. Connecta App Store Connect i Google Play
3. Crea l'entitlement: `premium_individual`
4. Crea els productes:
   - `lacolla_premium_mensual` — 4,99€/mes
   - `lacolla_premium_anual` — 39,99€/any
5. Copia la Public API Key → `EXPO_PUBLIC_REVENUECAT_API_KEY`

---

## 9. Desplegament en producció

### Web + Admin (Vercel)
```bash
# Instal·lar Vercel CLI
npm install -g vercel

# Desplegar web
cd apps/web && vercel

# Desplegar admin (domini: admin.lacolla.app)
cd apps/admin && vercel
```

### Mobile (EAS Build)
```bash
cd apps/mobile

# Configurar EAS
eas build:configure

# Build de preview (per a proves internes)
eas build --profile preview --platform all

# Build de producció (per a App Store i Google Play)
eas build --profile production --platform all

# Publicar a les stores
eas submit --platform ios
eas submit --platform android
```

---

## 10. Ordre de desenvolupament recomanat

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

## 11. Seguretat — checklist pre-producció

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

## 12. Eines útils per al desenvolupament

```bash
# Veure logs de Supabase en temps real
supabase functions logs notify-solicitud --tail

# Reset de la base de dades en local
supabase db reset

# Generar tipus TypeScript des del schema de Supabase
supabase gen types typescript --linked > packages/shared/database.types.ts
```

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

- Web pública: `lacolla.app`
- Panel admin: `admin.lacolla.app`
- Supabase: configurat automàticament

Configura els DNS a Cloudflare apuntant a Vercel.
