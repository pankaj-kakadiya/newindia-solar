# New India Solar — Step 23 Production Cutover & Monitoring Runbook

Target production domain: `https://newindiasolar.com`

Step 23 does not treat a successful build as a launch. The cutover is complete only when the Step 22 release gate is clear, the final release is deployed, DNS/SSL are verified, Supabase Auth URLs and provider webhooks are confirmed, and production smoke tests pass.

## 1. Release candidate gate

Before touching DNS:

1. Open `/admin/readiness` and run the Step 22 audit.
2. Resolve every blocker.
3. Complete every required manual sign-off with evidence.
4. Confirm the exact release commit and deployment that will receive production traffic.
5. Keep a known-good deployment/reference available for rollback.

The `/admin/cutover` Start Cutover action refuses to start while Step 22 still has blockers or required pending sign-offs.

## 2. Production hosting configuration

The production host must use Node 22 and must contain the same server/client environment configuration required by staging. Never expose server-only secrets through `NEXT_PUBLIC_*` variables.

Required public variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Server-only variables used by production features include:

- `SUPABASE_SERVICE_ROLE_KEY`
- Razorpay keys/webhook secret when online payments are enabled
- Meta WhatsApp token, phone-number ID, app secret and verify token when WhatsApp is enabled
- `RESEND_API_KEY` when transactional email is enabled
- MSG91 credentials when SMS is enabled
- Shiprocket credentials when shipping integration is enabled
- `NIS_WEBHOOK_SIGNING_SECRET` when the custom webhook is enabled

Do not enable a provider in Admin until the matching production credentials are actually present and tested.

## 3. DNS and SSL cutover

Make DNS changes in the provider that currently controls `newindiasolar.com`. Use the exact DNS target shown by the production host; do not copy an old IP or guess an A record.

After changing DNS:

1. Wait for the domain to resolve to the intended production host.
2. Confirm `https://newindiasolar.com` loads without a certificate warning.
3. Confirm the production host redirects/handles the preferred `www`/non-`www` form consistently.
4. Use `/admin/cutover` → **Verify DNS + SSL + health**.
5. Do not mark DNS/SSL complete manually when the live probe is failing.

## 4. Supabase Auth production URLs

Before customer login is considered production-ready, configure Supabase Auth to use the final HTTPS domain.

Set the primary Site URL to:

`https://newindiasolar.com`

Allow the production redirect pattern required by the app, including:

`https://newindiasolar.com/**`

If `www.newindiasolar.com` will be accepted, add its equivalent redirect URL or permanently redirect it to the canonical domain. Keep the Vercel staging callback only while staging login testing is still required.

After saving the Supabase Auth configuration, test login, logout, password reset and any email-link flow on the production domain. Then record the evidence in `/admin/cutover` before confirming Supabase Auth URLs.

## 5. Production webhook URLs

Provider callbacks must point to the production domain before those integrations are treated as live.

Expected application endpoints:

- Razorpay: `https://newindiasolar.com/api/webhooks/razorpay`
- Meta WhatsApp: `https://newindiasolar.com/api/webhooks/whatsapp`
- Custom signed webhook: `https://newindiasolar.com/api/webhooks/custom`

Do not change provider webhook secrets during DNS cutover unless intentionally rotating them. After updating callback URLs, send/provider-test a signed event where possible and confirm it is logged correctly before marking webhooks confirmed.

## 6. Production smoke test

After DNS/SSL, Auth and webhooks are configured, run `/admin/cutover` → **Run production smoke**. The automated smoke verifies the core public routes and `/api/health`.

The automated smoke is not a substitute for one controlled end-to-end commercial test. Before launch completion, perform a real login/cart/checkout flow and, when live credentials are enabled, one controlled payment/shipment lifecycle with a known test order.

## 7. Monitoring window

Keep Step 23 in **Monitoring** after the first successful production smoke. Watch:

- `/api/health`
- HTTP/SSL reachability
- failed signed webhooks
- failed outbound communication jobs
- payment reconciliation
- login/reset-password behavior
- order creation
- admin/RBAC access

The cutover page stores recent smoke/domain checks and a permanent cutover event log.

## 8. Rollback

Rollback is required when production traffic exposes a critical issue in login, checkout, payment integrity, database access, security/RBAC or order creation.

Rollback sequence:

1. Stop or redirect new production traffic to the last known-good release/host.
2. Record **Rollback** in `/admin/cutover` with the incident reason.
3. Preserve Razorpay/webhook/message logs for the incident window.
4. Reconcile any payment/provider events that happened before or during rollback.
5. Do not delete orders/payments to make the system appear clean.
6. Repair and retest on staging, rerun Step 22, then begin a new controlled cutover.

## Final completion rule

`/admin/cutover` will not allow **Complete Cutover** until all of the following are true:

- Step 22 has no blockers.
- Required Step 22 sign-offs are complete.
- DNS is verified.
- HTTPS/SSL is verified.
- Supabase Auth production URLs are confirmed.
- Production webhook URLs are confirmed.
- Production smoke test has passed.

Only then should the production cutover be recorded as completed.
