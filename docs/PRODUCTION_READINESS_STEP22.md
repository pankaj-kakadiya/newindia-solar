# New India Solar — Step 22 Production Readiness Runbook

This runbook is for the final staging-to-production cutover. Do not point the production domain until the required checklist in `/admin/readiness` is signed off.

## Automated gate

Run **Admin → Production Readiness → Run Readiness Audit** after every release candidate. Resolve every blocker before DNS cutover. Warnings need an explicit operational decision but do not automatically change data.

Automated checks cover database connectivity, RLS coverage, webhook/payment idempotency guards, communication queue locking, server credential presence, legal/GST master completeness, catalogue baseline, integration readiness, failed webhooks/outbox health, security headers and launch checklist status.

## Required human tests

1. Verify legal name, GSTIN, registered address and invoice numbering against company records.
2. Run one controlled Razorpay payment only after real credentials are configured. Confirm create → checkout → capture → webhook → ERP paid status → finance reconciliation.
3. Force/abandon one payment and confirm retry reuses the existing order and does not double-charge or create duplicate provider records.
4. Create one Shiprocket shipment with real package dimensions, assign AWB, refresh tracking and confirm the order/shipment record remains consistent.
5. Test storefront, cart, checkout, account and core admin workflows on mobile and desktop.
6. Test representative Sales, Finance, Production, Inventory and Content accounts. Confirm permitted routes work and denied routes/data remain unavailable.
7. Verify the Supabase backup/restore capability that applies to the current plan. Record who owns restore execution and the target recovery procedure.
8. Immediately before cutover, update Supabase Auth Site URL and redirects to the final HTTPS domain.
9. After DNS/SSL cutover, repeat homepage/login/checkout/admin/health/payment callback/webhook smoke tests.

## Security controls added in Step 22

- Browser security headers: CSP, HSTS, frame denial, no-sniff, restrictive referrer and permissions policies.
- Admin routes carry `X-Robots-Tag: noindex` and robots rules exclude sensitive application routes.
- Signed webhook ingestion uses provider-aware dedupe keys so repeated deliveries are idempotent while distinct lifecycle events such as authorized/captured or delivered/read can still process.
- Razorpay webhook processing validates the signed event amount against the ERP payment record before changing payment state.
- Razorpay browser verification independently rechecks provider payment status, amount and capture state before marking an order paid.
- Payment provider order/payment IDs are protected by unique database indexes.
- Communication workers claim outbox rows atomically with `FOR UPDATE SKIP LOCKED`, lock tokens and stale-lock recovery to reduce duplicate sends under concurrent workers.
- Failed online payment recovery reuses the existing ERP order and retry-safe Razorpay order flow.
- `/api/health` exposes only non-sensitive application/database health state for post-cutover monitoring.

## Cutover rollback rule

If a post-cutover smoke test finds a critical issue in login, checkout, payments, database access or admin security, stop new traffic to the release before attempting data repair. Restore routing to the last known-good deployment, preserve payment/webhook logs, reconcile any provider transactions created during the incident window, and only then prepare a corrected release.

## Current staging principle

Vercel is the staging/testing environment until New India Solar intentionally points the production domain. A successful Vercel build alone is not production cutover approval; the readiness checklist is the final gate.
