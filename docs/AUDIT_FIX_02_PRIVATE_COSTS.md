# Step 2 — Internal catalogue cost access

Audit finding: F02 / SEC02. Reviewed 17 September 2026.

**Status: partially deployed. Phase A is live; phase B is pending the compatible website release. Public cost exposure is not closed yet.**

## Changes

- Add `admin_catalogue_costs(text, uuid[], text)`, a bounded, read-only endpoint. It checks the current authenticated identity, active staff/admin status, an allowed item/module combination, and that module's view permission. Anonymous execution is revoked. Its security-definer search path is empty.
- Admin products, components, enclosures, pricing, inventory, purchasing and workflows now query explicit non-cost fields, then request costs through that endpoint. Missing/denied costs stop editable rows from loading; they are not replaced with zero.
- The current staging buyer product page already uses `PUBLIC_PRODUCT_SELECT`, an explicit projection without costs. Preserve its Step 28 page, cart and builder changes. Staging and `main` have diverged; do not replace the release with the older `main` tree.
- Phase B revokes table-wide and explicit cost-column SELECT grants from PUBLIC, anonymous and authenticated roles on `product_variants`, `components` and `enclosures`. It grants explicit non-cost columns back. Row-level policies remain in force. Direct cost, wildcard, whole-row JSON, filter, sort and aggregate reads are denied.
- Costs remain in their original tables. Existing guarded database pricing, purchase receipt, import, report and production functions retain access. No catalogue cost values are moved, erased or changed.

## Deployment order — required

1. **Done:** phase A migration `20260917025748_admin_catalogue_cost_access.sql` applied to the existing database.
2. Build and test the release based on staging commit `de0de349dc4bc69ae270d458c82d6fec52a1e011`. Publish one controlled staging preview and check the buyer product page and admin access. The PR/checks hold the current deployment evidence.
3. Deploy that compatible website release to Hostinger, preserving its production environment. Verify products, components, enclosures, pricing, inventory, purchasing and workflow pages with authorized accounts. Reload previously open admin tabs.
4. **Pending:** apply `20260917025825_restrict_catalogue_cost_reads.sql` only after step 3 is verified. Do not run an indiscriminate production `db push` before website compatibility is established.
5. Run `node scripts/verify-catalogue-cost-access.mjs`. Supply test buyer/admin JWTs through environment variables for signed-in HTTP checks; the script never prints costs or tokens and never writes business records. Missing authenticated test tokens are explicitly reported as NOT RUN.
6. Recheck buyer product, catalogue, cart and builder flows, plus admin costing and one controlled costing workflow. Record evidence before closing F02.

## Verification

- Final staging-based release: all 168 automated test results pass, including 37 database access scenarios, 11 client/projection checks, the Step 1 suite and the existing staging catalogue/product/asset tests. Production build and TypeScript checks pass on Node 22.23.2.
- PostgreSQL/PGlite tests use synthetic data, actual reviewed profile permission functions and equivalent policies for the three affected tables. They test anonymous and buyer denial, active staff/admin access, module denial, explicit overrides, suspension, permission revocation, bounded requests, direct authorized writes and preservation of costs.
- Client tests cover nested variants, batching, zero/null preservation, missing rows, permission failures and failed partial batches. A source guard rejects new wildcard/direct-cost catalogue queries.
- The Step 1 checkout and production-snapshot suite also runs after the new permissions. It verifies that buyer snapshots omit costs while internal production snapshots retain authoritative costs.
- Live phase A checks: anonymous EXECUTE denied; unrecognized authenticated identity rejected; existing active admin successfully read three variant cost rows. Checks used rolled-back session settings; no cost values or account IDs were exported.
- Security-advisor categories before/after phase A remain the same five existing categories. This is not a clean-project certification.
- Local browser preview access was blocked by the browser environment. This does not count as a browser pass; hosted staging and authenticated UI checks remain release gates.

## Recovery

Before phase B, roll back the website if required; phase A is additive and compatible with the older site. After phase B, keep the cost restrictions in place and forward-fix the website or use the last compatible build. Restoring public SELECT permissions would reopen F02. No data restoration is needed because stored cost values are unchanged.

Reference: [Supabase column-level security](https://supabase.com/docs/guides/database/postgres/column-level-security). Restricted roles must use explicit columns; row policies alone do not hide columns.
