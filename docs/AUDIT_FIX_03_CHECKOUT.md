# Step 3 — standard checkout integrity

Database migration 20260917162249_secure_standard_checkout is applied to production.

Changes:
- Standard checkout validates positive finite catalogue prices, GST, MOQ, quantity increments and stock after subtracting active reservations.
- Product rows are locked in deterministic order. Each successful standard order reserves stock in the existing inventory ledger. Confirmation does not reserve it twice; shipment consumes it and cancellation/refund releases it.
- Pending bank-transfer orders now hold standard stock until cancellation or shipment. There is no automatic expiry in this release; staff must cancel abandoned pending orders to release holds.
- Atomic cart preparation, a private per-cart checkout receipt, and a browser submit latch prevent repeated submissions of the same checkout attempt from creating duplicate orders. A session-scoped digest/cart ID supports retry after response loss. This does not deduplicate intentionally separate carts or guarantee payment-provider idempotency.
- Cart-item changes and checkout lock the same parent cart. Checked-out carts cannot be repopulated.
- Restrictive RLS policies close legacy permissive non-staff mutations on orders, order items, payments, inventory reservations and catalogue price/stock tables. Buyers retain own-order/payment reads. Staff remain subject to module permissions.
- Checkout GST estimates use each standard product's published rate rather than a fixed 18%. Final order amounts are calculated server-side. Custom estimates without a confirmed quote are not fabricated.

Validation:
- 278 automated results passed, including 40 new scenarios plus their parent test result, and the production build passed.
- Isolated PostgreSQL tests cover low stock, duplicate lines, MOQ, non-finite/zero/negative prices, measured quantities, zero GST, retry recovery, another buyer's receipt, failed-order rollback, competing carts, confirmation/cancellation/shipment and direct data-API policy bypasses.
- Competing-cart tests use a single isolated PGlite database; true multi-connection load testing was not performed. Deterministic PostgreSQL row locks provide the production serialization mechanism.
- Live database verification does not create real customer orders or payments. Paid gateway and authenticated end-to-end browser ordering remain separate acceptance checks.

Deployment: GitHub main auto-deploys through Hostinger. Verify public/checkout-integrity-release.json on the live domain before calling the frontend release complete.
