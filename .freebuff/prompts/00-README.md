# TEPI SAWAH — AI CODING AGENT PROMPT SEQUENCE v1.0

Gunakan prompt secara berurutan. Jangan mengirim seluruh prompt sekaligus.

## Cara penggunaan

1. Buka repository `tepisawah` di Freebuff workspace.
2. Pastikan Master Project Pack sudah berada di repository/workspace.
3. Letakkan screenshot Stitch pada `docs/design/references/`.
4. Jalankan Prompt 00.
5. Setelah selesai, jalankan Prompt 01 sebagai gate.
6. Lanjutkan satu phase per session.
7. Setelah phase selesai, gunakan Prompt 24 untuk review.
8. Jika ada bug, gunakan Prompt 25.
9. Gunakan Prompt 27 untuk checkpoint Git.
10. Setelah semua phase selesai, Prompt 26 menjadi audit akhir.
11. Prompt 22 digunakan sebagai production release gate.

## Urutan

00 Master Bootstrap
01 Phase 0 Review
02 Phase 1 Supabase Foundation
03 Phase 2 Auth + Profiles
04 Phase 3 RBAC + RLS
05 Phase 4 Restaurant Configuration
06 Phase 5 Catalog
07 Phase 6 Tables + QR
08 Phase 7 Table Sessions
09 Phase 8A Order Creation
10 Phase 8B Order Submission
11 Phase 8C Order Transition
12 Phase 9 Customer Ordering
13 Phase 10 Cashier POS
14 Phase 11 Kitchen KDS
15 Phase 12 Waiter
16 Phase 13 Payments
17 Phase 14 Service Requests
18 Phase 15 Realtime
19 Phase 16 Admin
20 Phase 17 Audit + Dashboard
21 Phase 18 Production Hardening
22 Phase 19 Production Release
23 Visual Design Implementation
24 Phase Review / Gate
25 Debug and Recovery
26 Final Project Audit
27 Git Release Discipline

## Aturan utama

- Satu prompt = satu bounded task.
- Jangan meminta "build everything".
- Jangan melewati phase tanpa gate.
- Jangan menerima asumsi bisnis yang tidak terdokumentasi.
- Jangan menggunakan screenshot sebagai source of truth untuk business logic.
- Jangan menggunakan kode Stitch sebagai production architecture.
- Jangan menjadikan localStorage/mock workflow sebagai production backend.
- PostgreSQL adalah source of truth.
- Realtime adalah signal, bukan authority.
- Frontend authorization adalah UX, bukan security.
- RLS/backend adalah security boundary.
- Semua critical mutation harus authorized, atomic, idempotent, dan auditable.
- Jangan memilih payment provider tanpa keputusan eksplisit.
- Jangan mengembangkan fitur di luar MVP tanpa change approval.

## Pola setiap session

INSPECT
→ PLAN
→ IMPLEMENT
→ VALIDATE
→ SECURITY REVIEW
→ TEST
→ REPORT
→ COMMIT
→ STOP

## Jika terjadi gap

Tulis:

REQUIREMENT GAP

Lalu jelaskan:
- requirement yang hilang
- bagian yang terdampak
- keputusan yang diperlukan
- alternatif teknis bila relevan

Jangan menebak.
