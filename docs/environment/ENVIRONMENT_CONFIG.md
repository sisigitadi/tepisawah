# TEPI SAWAH RESTO & CAFE
## ENVIRONMENT CONFIGURATION v1.0

**Status:** Pre-Implementation Environment Blueprint  
**Version:** 1.0  
**Date:** 2026-09-27  
**Primary Tool:** Cline + VS Code  
**Architecture:** React + TypeScript + Vite + Supabase + PostgreSQL + RLS + Realtime  
**Repository:** `tepisawah`

---

# 1. Purpose

Dokumen ini menetapkan konfigurasi environment untuk development, preview/staging, dan production.

Tujuan:

- memisahkan environment
- mencegah secret bocor
- memastikan aplikasi mengetahui backend yang benar
- memastikan deployment Vercel konsisten
- memastikan Supabase project dan domain tidak tertukar
- memberikan konfigurasi yang dapat digunakan Cline tanpa mengarang nilai

Environment:

```text
LOCAL DEVELOPMENT
      ↓
PREVIEW / STAGING
      ↓
PRODUCTION
```

Jangan menggunakan credential production untuk automated development/testing.

---

# 2. Environment Model

## 2.1 Local Development

Digunakan developer dan Cline.

Contoh:

```text
localhost
127.0.0.1
```

Tujuan:

- coding
- unit test
- integration test
- local UI testing
- development migration
- controlled seed data

Local environment tidak boleh memakai service-role key di browser.

---

## 2.2 Preview / Staging

Digunakan untuk:

- pull request
- integration test
- E2E
- QA
- UAT
- stakeholder review

Contoh domain:

```text
preview.tepisawah.id
```

Catatan:

Domain staging di atas adalah konfigurasi usulan dan belum merupakan fakta bahwa DNS tersebut sudah tersedia.

---

## 2.3 Production

Domain utama:

```text
tepisawah.id
order.tepisawah.id
pos.tepisawah.id
kitchen.tepisawah.id
waiter.tepisawah.id
admin.tepisawah.id
```

Domain tersebut mengikuti deployment architecture yang telah ditetapkan.

Production hanya menggunakan:

- production Supabase project
- production environment variables
- production deployment
- production credentials

---

# 3. Environment Separation

Minimum:

```text
LOCAL
  ├── local Supabase / development project
  ├── local credentials
  └── test data

PREVIEW
  ├── staging Supabase project
  ├── staging credentials
  └── non-production data

PRODUCTION
  ├── production Supabase project
  ├── production credentials
  └── real operational data
```

Jangan mencampurkan database antar-environment.

---

# 4. Vercel Environment Mapping

Recommended:

| Vercel Environment | Purpose | Database |
|---|---|---|
| Development | local development | development Supabase |
| Preview | PR / staging | staging Supabase |
| Production | live system | production Supabase |

Environment variables harus dikonfigurasi per environment.

Jangan menganggap satu variable value cocok untuk semua environment.

---

# 5. Required Public Environment Variables

Frontend hanya boleh menerima public configuration.

Contoh:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Catatan:

`VITE_` variables akan tersedia pada browser bundle.

Karena itu:

```text
VITE_* ≠ secret storage
```

Nilai public tetap harus dilindungi oleh:

- Supabase Auth
- RLS
- authorization
- backend validation

---

# 6. Server-Side Secrets

Secret tidak boleh menggunakan prefix:

```text
VITE_
```

Contoh kategori secret:

```env
SUPABASE_SERVICE_ROLE_KEY=
PAYMENT_PROVIDER_SECRET=
PAYMENT_WEBHOOK_SECRET=
INTERNAL_API_SECRET=
```

Nilai aktual tidak boleh ditulis ke:

- source code
- Git
- README
- prompt Cline
- screenshot
- browser bundle
- frontend environment

Service-role key hanya boleh digunakan server-side / trusted environment.

---

# 7. `.env.example`

Repository harus menyediakan:

```env
# Public Supabase configuration
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=

# Server-side only
SUPABASE_SERVICE_ROLE_KEY=

# Optional payment integration
PAYMENT_PROVIDER_SECRET=
PAYMENT_WEBHOOK_SECRET=

# Application
APP_ENV=development
APP_BASE_URL=http://localhost:5173
```

`.env.example` hanya berisi nama variable dan placeholder.

Tidak boleh berisi credential nyata.

---

# 8. `.gitignore`

Minimum:

```gitignore
.env
.env.local
.env.development.local
.env.test.local
.env.production.local
.env.*.local

node_modules/
dist/
coverage/

*.log

.DS_Store
```

Jangan menggunakan:

```text
git add . --force
```

untuk memasukkan environment secret.

---

# 9. Secret Management

Hierarchy:

```text
Local
  → local .env files

Preview
  → Vercel Preview Environment Variables

Production
  → Vercel Production Environment Variables
```

Secret management tidak boleh menggunakan:

- source code
- database table biasa
- frontend localStorage
- GitHub repository
- public documentation

---

# 10. Supabase Project Configuration

Setiap environment harus memiliki project identity yang jelas.

Recommended naming:

```text
Tepi Sawah Development
Tepi Sawah Staging
Tepi Sawah Production
```

Nama tersebut merupakan rekomendasi dan harus dikonfirmasi saat project Supabase dibuat.

Jangan membuat migration terhadap production sebelum:

1. migration reviewed
2. test pass
3. staging validation pass
4. backup/recovery readiness verified

---

# 11. Supabase URL Configuration

Setiap environment memiliki:

```env
VITE_SUPABASE_URL=
```

Cline tidak boleh:

- hard-code URL Supabase
- mengganti URL secara otomatis
- mengambil URL dari production saat local development
- menyimpan URL production dalam source code sebagai fallback

Environment variable menjadi source konfigurasi.

---

# 12. Supabase Auth URL Configuration

Auth redirect harus dipisahkan berdasarkan environment.

Contoh:

### Local

```text
http://localhost:5173
```

### Preview

```text
https://preview.tepisawah.id
```

### Production

```text
https://tepisawah.id
https://pos.tepisawah.id
https://kitchen.tepisawah.id
https://waiter.tepisawah.id
https://admin.tepisawah.id
```

Actual callback configuration harus mengikuti URL yang benar-benar digunakan oleh deployment.

Jangan menambahkan wildcard callback tanpa alasan.

---

# 13. Application Base URLs

Frontend apps:

```text
WEB
https://tepisawah.id

ORDER
https://order.tepisawah.id

POS
https://pos.tepisawah.id

KITCHEN
https://kitchen.tepisawah.id

WAITER
https://waiter.tepisawah.id

ADMIN
https://admin.tepisawah.id
```

Local development dapat menggunakan port berbeda.

Contoh:

```text
web     → localhost:5173
order   → localhost:5174
pos     → localhost:5175
kitchen → localhost:5176
waiter  → localhost:5177
admin   → localhost:5178
```

Port tersebut adalah contoh development mapping, bukan requirement absolut.

---

# 14. Cross-App Configuration

Application harus memiliki konfigurasi terpusat untuk mengetahui URL app lain.

Contoh:

```env
VITE_PUBLIC_WEB_URL=
VITE_ORDER_APP_URL=
VITE_POS_APP_URL=
VITE_KITCHEN_APP_URL=
VITE_WAITER_APP_URL=
VITE_ADMIN_APP_URL=
```

Gunakan hanya jika aplikasi benar-benar membutuhkan cross-app navigation.

Jangan menyimpan URL sebagai literal berulang di banyak file.

---

# 15. QR Configuration

QR customer harus menghasilkan URL customer ordering.

Production pattern:

```text
https://order.tepisawah.id/?table=<table_identifier>
```

Identifier table bukan secret.

Namun QR tidak boleh menjadi satu-satunya security boundary untuk:

- payment
- admin data
- employee data
- audit log
- sensitive customer data

---

# 16. Runtime Configuration Rules

Frontend configuration harus:

```text
centralized
typed
validated
environment-aware
```

Contoh struktur:

```text
packages/config/
├── env.ts
├── urls.ts
└── constants.ts
```

`env.ts` bertugas:

- membaca environment variables
- validate required variables
- fail fast jika configuration invalid

Jangan menyebarkan:

```ts
import.meta.env.VITE_...
```

secara bebas ke seluruh aplikasi.

---

# 17. Environment Validation

Application startup harus memeriksa minimal:

```text
SUPABASE URL tersedia
PUBLIC SUPABASE KEY tersedia
APP ENV valid
BASE URL valid
```

Jika required configuration hilang:

```text
FAIL FAST
```

Jangan menjalankan aplikasi dalam keadaan configuration ambigu.

---

# 18. Build-Time vs Runtime

Vite environment variables adalah build-time configuration.

Karena itu:

```text
build preview
```

dan

```text
build production
```

harus menggunakan environment variables yang benar.

Jangan melakukan:

```text
build once
→ deploy ke semua environment
```

jika build tersebut membutuhkan environment-specific VITE values.

---

# 19. Cline Environment Rules

Cline boleh:

- membaca `.env.example`
- membaca variable names
- menggunakan local development environment
- menjalankan test dengan test credentials yang disediakan
- memeriksa konfigurasi non-secret

Cline tidak boleh:

- meminta user menempelkan secret ke chat
- menulis secret ke source code
- commit secret
- mencetak secret ke log
- memasukkan secret ke prompt
- menampilkan service-role key
- menggunakan production credential untuk eksperimen

Jika secret belum tersedia:

```text
STOP
REPORT MISSING CONFIGURATION
DO NOT INVENT VALUE
```

---

# 20. Supabase CLI

Jika Supabase CLI digunakan:

```text
supabase/
├── migrations/
├── functions/
└── seed/
```

Migration harus:

- versioned
- reviewed
- deterministic
- repeatable
- committed

Jangan melakukan perubahan schema production secara manual tanpa migration.

---

# 21. Database Migration Environment

Recommended workflow:

```text
Local migration
      ↓
Local test
      ↓
Commit migration
      ↓
Preview/Staging
      ↓
Integration + RLS tests
      ↓
UAT
      ↓
Production migration
```

Migration production harus menggunakan migration yang sama dengan yang telah diuji.

---

# 22. Seed Data

Seed dibagi:

```text
development seed
test seed
production-safe seed
```

Development/test dapat berisi:

- test users
- test roles
- sample categories
- sample products
- sample tables

Production seed tidak boleh memasukkan data dummy tanpa persetujuan.

Jangan membuat fake transaction history di production.

---

# 23. Logging

Application log harus menghindari:

- password
- access token
- refresh token
- service-role key
- payment secret
- webhook secret
- unnecessary customer sensitive data

Log sebaiknya menggunakan:

```text
requestId
eventId
entityId
actorId
action
status
duration
errorCode
```

---

# 24. Error Handling

Production error response tidak boleh membocorkan:

- SQL query
- stack trace internal
- environment variables
- secret
- database credentials
- internal service credentials

User-facing error:

```text
Terjadi kesalahan.
Silakan coba lagi.
```

Developer log dapat menyimpan detail yang diperlukan secara aman.

---

# 25. Browser Storage

Do not store sensitive credentials in:

```text
localStorage
sessionStorage
URL query string
```

Customer QR table identifier boleh berada di URL karena QR memang membutuhkan table context.

Namun jangan menaruh:

```text
payment secret
admin token
service-role credential
```

di URL.

---

# 26. Production Domain Strategy

Production mapping:

```text
tepisawah.id
    ↓
Public Website

order.tepisawah.id
    ↓
Customer Ordering

pos.tepisawah.id
    ↓
Cashier

kitchen.tepisawah.id
    ↓
KDS

waiter.tepisawah.id
    ↓
Waiter Service

admin.tepisawah.id
    ↓
Administration
```

Setiap app harus memiliki route protection yang sesuai role.

---

# 27. DNS / Hosting Boundary

Deployment model:

```text
GitHub
   ↓
Vercel
   ↓
Applications
   ↓
Supabase
   ↓
PostgreSQL
```

Domain DNS harus diarahkan sesuai konfigurasi provider yang benar.

Jangan mengubah DNS production sebelum deployment target dan SSL readiness diverifikasi.

---

# 28. GitHub Configuration

Repository:

```text
tepisawah
```

GitHub Actions dapat menggunakan secrets untuk:

- deployment
- CI
- test integration
- Supabase migration automation jika nanti diperlukan

Jangan menyimpan secret sebagai plain text repository variable yang tidak diperlukan.

---

# 29. Pull Request Environment

Setiap PR yang membutuhkan frontend preview sebaiknya menggunakan:

```text
Vercel Preview
```

Testing:

```text
PR
 ↓
Preview deployment
 ↓
Smoke test
 ↓
Integration/E2E
 ↓
Review
```

Production domain tidak digunakan untuk PR testing.

---

# 30. Environment Naming

Recommended:

```text
development
preview
production
```

Hindari terlalu banyak environment sebelum ada kebutuhan operasional.

Jangan membuat:

```text
dev2
dev-final
testing-final
staging-new
production2
```

tanpa alasan arsitektural yang jelas.

---

# 31. Configuration Ownership

| Configuration | Owner |
|---|---|
| Brand content | Product/Admin |
| Menu | Admin/Owner |
| Operating hours | Admin/Owner |
| Table configuration | Admin |
| User roles | Admin/Owner |
| Supabase credentials | Technical Owner |
| Vercel env | Technical Owner |
| Payment credentials | Authorized Technical/Finance Owner |
| Production DNS | Technical Owner |
| Security policy | Technical Owner |
| Database migration | Development + Technical Review |

---

# 32. Missing Configuration Decisions

Sebelum production implementation, nilai berikut masih harus diisi berdasarkan fakta:

```text
SUPABASE DEVELOPMENT URL
SUPABASE DEVELOPMENT ANON KEY

SUPABASE STAGING URL
SUPABASE STAGING ANON KEY

SUPABASE PRODUCTION URL
SUPABASE PRODUCTION ANON KEY

PRODUCTION SERVICE ROLE KEY
PAYMENT PROVIDER
PAYMENT SECRET
PAYMENT WEBHOOK SECRET

ACTUAL DNS CONFIGURATION
ACTUAL VERCEL PROJECT MAPPING
ACTUAL AUTH REDIRECT URL
```

Jangan mengarang nilai.

---

# 33. Configuration Readiness Checklist

## Local

- [ ] Node/pnpm tersedia
- [ ] repository cloned
- [ ] dependencies install
- [ ] `.env.local` configured
- [ ] Supabase development configured
- [ ] local app starts
- [ ] typecheck passes
- [ ] lint passes
- [ ] tests pass

## Preview

- [ ] Vercel Preview configured
- [ ] staging Supabase configured
- [ ] preview env variables configured
- [ ] Auth redirect configured
- [ ] integration tests pass
- [ ] E2E passes

## Production

- [ ] production Supabase created
- [ ] production Vercel env configured
- [ ] production domains configured
- [ ] Auth redirects configured
- [ ] SSL verified
- [ ] RLS verified
- [ ] backups/recovery reviewed
- [ ] production smoke test passed

---

# 34. Security Gate

Before any production deployment:

```text
NO SECRET IN GIT
        +
NO SECRET IN FRONTEND
        +
NO SERVICE ROLE IN BROWSER
        +
RLS ENABLED
        +
AUTH CONFIGURED
        +
ROLE/PERMISSION SERVER-SIDE
        +
ENVIRONMENT SEPARATED
```

Jika salah satu critical condition gagal:

```text
STOP RELEASE
```

---

# 35. Cline Prompt — Environment Setup

Gunakan prompt berikut untuk Cline:

```text
You are setting up the Tepi Sawah Resto & Cafe development environment.

Read these documents first:

- docs/project/PROJECT_RULES.md
- docs/design/DESIGN_FREEZE.md
- docs/architecture/TECHNICAL_ARCHITECTURE.md
- docs/architecture/REPOSITORY_STRUCTURE.md
- docs/implementation/CLINE_IMPLEMENTATION_PLAN.md
- docs/qa/TESTING_STRATEGY.md
- docs/environment/ENVIRONMENT_CONFIG.md

Task:

1. Inspect the repository.
2. Create or verify environment configuration structure.
3. Create `.env.example` with placeholders only.
4. Verify `.gitignore` protects environment files.
5. Create typed environment configuration.
6. Validate required public configuration.
7. Do not create fake Supabase credentials.
8. Do not invent production configuration.
9. Do not place secrets in source code.
10. Do not expose service-role credentials to browser code.
11. Do not create production database connections unless explicitly configured.
12. Do not implement business features yet.

After implementation run:

- typecheck
- lint
- relevant tests
- production build

Report:

A. Files created/changed
B. Environment variables required
C. Variables successfully detected
D. Missing configuration
E. Security findings
F. Validation results
G. Blocking issues

If required credentials are missing, STOP after preparing the configuration structure.

Do not invent credentials.
Do not continue to the next implementation phase.
```

---

# 36. Final Environment Rule

Environment configuration must never be treated as an implementation detail.

It is part of the production architecture:

```text
Code
+
Database
+
Auth
+
RLS
+
Secrets
+
Domains
+
Deployment
=
Production Environment
```

**Status:** READY FOR ENVIRONMENT SETUP.

The actual credential values are intentionally not included in this document.
