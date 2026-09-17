# Buyer account release — 17 September 2026

Requested features:
- Profile editing: name, contact mobile, company and GSTIN. Only customer fields can be updated; contact mobile is separate from verified Auth phone.
- Saved addresses: add/edit/delete, select at checkout, and automatically retain shipping addresses when an order is successfully created. Duplicate matching addresses are not inserted by repeat orders. The address write is part of the order transaction; failed orders roll it back. Existing historical orders are not backfilled.
- Checkout fills name/contact, saved address and business GST details from the account, without overwriting fields already edited during loading.
- Mobile OTP sign-in/signup and verified phone linking for existing email accounts. These use Supabase Auth's OTP APIs, six-digit input and resend cooldown. Redirects are restricted to local paths.
- Buyer-owned order details, dated order milestones, courier/AWB and HTTPS tracking links, refresh, issued invoices and repeat orders.
- Download order summaries and issued invoice documents as HTML; View/Print opens the document with the browser's Save as PDF option. Draft/void invoices are excluded. Order summaries are clearly distinguished from tax invoices.
- Repeat order uses current product availability, MOQ, increment, stock and selling price. Available items are added to the existing cart; unavailable items are reported. Custom builds must pass current server-side configuration pricing/approval. Checkout remains necessary to place the new order.

Database migration: `20260917170928_buyer_account_features.sql`.
Restrictive invoice/invoice-item RLS closes legacy permissive policies. Buyer document access goes through authenticated server endpoints with explicit order ownership and field allowlists; internal notes and configuration cost snapshots are excluded.

Verification: automated unit, route-boundary and isolated Postgres tests; production build; production trigger existence and anonymous invoice denial checked. Full test suite: 307 passed. No real order, invoice, SMS or payment was created for verification. Authenticated browser acceptance with a real buyer is still required for SMS delivery, order document printing and shipping provider data.

## OTP activation blocker

Production Supabase Auth public settings report `external.phone = false` (17 September 2026). The UI therefore reports mobile OTP unavailable and preserves working email sign-in. Configure a supported SMS provider in Supabase Authentication → Providers → Phone, including applicable sender/template setup, then enable Phone Auth and perform a controlled delivery/linking test. No secrets belong in chat or public environment variables. The feature checks provider availability dynamically and does not need a frontend rebuild after activation.

Reference: https://supabase.com/docs/guides/auth/phone-login

Payment activation remains disabled and outside this release. The open payment concurrency/reconciliation gates in AUDIT_FIX_04_PAYMENT_READINESS.md are unchanged.
