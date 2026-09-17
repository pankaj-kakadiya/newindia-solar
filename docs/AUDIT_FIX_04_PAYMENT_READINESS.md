# Step 04A — Payment request and webhook protection

## Scope

This is a protective code release, not approval to activate the gateway. At review time the production payment integration was disabled and configured for sandbox. No credentials were inspected, no payment was initiated, and no integration settings were changed.

Changes:
- Strict 64-character SHA-256 HMAC validation; malformed hex no longer passes through Buffer truncation.
- Invalid webhook signatures rejected before writing deduplication receipts.
- Failed/interrupted webhook deliveries can retry; completed matching deliveries are acknowledged. A changed payload for an authenticated delivery ID is rejected.
- Database processing errors return HTTP 503 instead of reporting success. A missing payment row remains retryable.
- Payment identity, INR currency, integer paise, amount and webhook status are checked.
- Late authorization cannot change a paid/refunded payment row to pending.
- Creation rejects closed, paid and partially-paid orders, invalid totals and invalid provider responses. A provider order already marked paid cannot open a fresh checkout.
- Payment creation and public availability require webhook configuration and matching Razorpay test/live key mode. Only a boolean availability value is public.
- Provider requests have timeouts; create/verify return a JSON failure on unexpected errors. Database persistence failures do not return verified success.

## Validation

20 new offline tests cover guards and execute the actual API route code with mocked database/provider boundaries. All 298 tests passed, and the production build passed before publishing. These do not replace a real sandbox integration test or simultaneous database-session testing.

Production database read-only inspection confirmed the webhook unique index is `(integration_key, dedupe_key)` with non-null dedupe keys. No schema or production records were modified for this release.

## Open activation gates — do not mark payments production-ready

- Serialize concurrent provider-order creation per application order. Existing query-then-create logic can produce more than one provider order under simultaneous requests.
- Make payment/order/invoice reconciliation a single locked database transaction; current checked sequential writes can still race or partially complete. Retry support improves recovery but does not provide transaction atomicity.
- Complete refund reconciliation, including out-of-order captured/refunded events and manual-finance changes.
- Configure and validate Razorpay test credentials/webhook on an isolated staging environment, without mixing test transactions into the production database.
- Exercise success, failure, cancellation, duplicate delivery, delayed delivery, browser-close recovery, and simultaneous attempts in sandbox.
- Confirm live merchant readiness and server-only live secrets in Hostinger, then activate after the gates above pass. Do not paste secrets into chat or public integration configuration.

Reference: Razorpay documents duplicate and out-of-order webhook delivery and raw-body HMAC validation at https://razorpay.com/docs/webhooks/validate-test .
