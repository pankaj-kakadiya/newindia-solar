# Audit fix 01: server-owned custom configuration pricing

Audit reference: F01 / SEC01, with the inactive-template checkout guard from BLD02.

## Change

Customer-owned configuration rows previously allowed direct edits to trusted prices and BOMs. Checkout used those saved totals without rebuilding them from the component catalogue. This change removes direct client writes to configurations and selection snapshots, including any individual column grants. Read access and existing RLS remain in place.

Both `save_visual_configuration` and the legacy `save_custom_configuration` now use one private pricing function. It checks authentication, staff create permission where relevant, template activity and quotation mode, required options, valid IDs, duplicates, single/multi-select rules, numeric integer quantities, active linked parts, positive prices, AC/DC categories, enclosure support, applicable compatibility rules and the current technical layout approval fingerprint. The existing fingerprint-based approval must exist; buyer preview JSON cannot create it.

Only the server sets `pricing_version = 1`. Existing rows default to version 0 and must be rebuilt before checkout. Preflight found zero saved configurations, both templates inactive and no layout approvals. The migration does not activate templates, approve assemblies or change catalogue prices/stock.

Custom checkout locks the owned cart, loads the owned configuration and recalculates it from current records. Changed totals or BOMs require a rebuild and review rather than a silent charge. Unknown, unapproved, inactive, incomplete, tampered and old-version configurations fail transactionally. Standard product pricing remains in its existing branch; its separate stock/MOQ/zero-price defects are not closed by this step.

Buyer-facing BOMs no longer carry internal cost prices. The existing production trigger obtains internal costs directly from component/enclosure records into staff production costing fields. Public standard-variant cost exposure remains F02 and is the next repair item.

## Implementation and validation

- Versioned migration: `supabase/migrations/20260917024057_secure_custom_configuration_pricing.sql`. Created with the Supabase CLI, then aligned to the actual applied migration version returned by the database.
- Isolated PostgreSQL tests: `npm run test:custom-pricing`. Uses pinned PGlite 0.5.8, schema column types/defaults from the reviewed database, synthetic fixtures and real PostgreSQL roles/permissions.
- 53 scenario checks pass, reported as 54 test results including the enclosing test. Cases include valid ACDB/DCDB saves, legacy RPC, table and column write rejection, selection protection, authentication, scoped staff permission, missing/invalid inputs, quantity limits, AC/DC mismatch, revoked approvals, stale prices/BOM, buyer isolation, custom order totals, transactional rollback, retained admin costing and standard checkout regression.
- Existing catalogue/builder/asset suites: 134 tests pass.
- Full Next.js production build and type checking pass on Node 22.23.2.
- CI: `.github/workflows/custom-pricing-security.yml` runs the isolated SQL checks on relevant pull requests and main/fix-branch pushes.

The local fixture includes the real production-job creation trigger, but does not reproduce every live cross-module trigger, provider integration or complete staff RBAC implementation. These tests do not certify stock concurrency, payment capture, visual/physical assembly fit or all admin workflows. No real buyer order, payment, production job or outbound message is needed for this step's live rejection checks.

## Release and recovery

Applied to the existing live database on 17 September 2026 as migration `20260917024057`, after all four replaced function definitions matched the captured preflight hashes. Post-deployment checks confirmed no authenticated direct configuration/selection writes, no anonymous save/order RPC execution, no authenticated private helper access, and retained authenticated SELECT/save access. A rolled-back transaction under the authenticated role confirmed direct INSERT/UPDATE rejection and inactive-template rejection. Configuration count remains zero and both templates remain inactive.

The immediate security-advisor response reported no new findings compared with the captured baseline. Existing callable-function, mutable-search-path, no-policy and password-protection findings remain tracked separately; this is not a clean-project security certification.

This is a database-only security release: existing UI/RPC signatures remain compatible, and no Hostinger application, Vercel deployment, DNS, payment setting or public template activation is required. The wider application staging/cutover gates remain in force for later UI/commerce releases.

Catalogue SHARE locks keep approval and pricing inputs consistent for the short transaction; catalogue edits may wait while a custom configuration is priced. Review contention before enabling substantial custom-commerce traffic.

Emergency containment is in `scripts/disable-custom-checkout.sql`: pause custom save/checkout through the normal migration process while retaining write protections and standard checkout. Never restore the vulnerable buyer grants as a rollback. Restore the reviewed pricing helper only after resolving the incident.

Current verification/deployment evidence is recorded in `docs/AUDIT_FIX_PROGRESS.md`.

References: [Supabase column privileges](https://supabase.com/docs/guides/database/postgres/column-level-security), [database functions and function permissions](https://supabase.com/docs/guides/database/functions). The current Supabase changelog was checked before implementation; no relevant breaking change altered these PostgreSQL controls.
