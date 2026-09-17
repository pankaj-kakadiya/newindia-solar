# Audit fixing progress

| Step | Status | Evidence |
| --- | --- | --- |
| 01. Custom pricing integrity | Live | Migration 20260917024057; see AUDIT_FIX_01_CUSTOM_PRICING.md. |
| 02. Internal catalogue costs | Live; database and public API verified | Website ece8c9a; migration 20260917161036; 237 tests and production build passed. See AUDIT_FIX_02_PRIVATE_COSTS.md for scope and verification limits. |
| 03. Standard order validation | Live; automated and read-only production checks passed | Migration 20260917162249; 278 tests and production build passed. See AUDIT_FIX_03_CHECKOUT.md for scope and remaining acceptance checks. |
| 04A. Payment request/webhook protection | Verified patch; activation blocked | 298 tests and production build passed. Strict signatures, retries, amount/currency checks and persistence-error handling. See AUDIT_FIX_04_PAYMENT_READINESS.md for open concurrency and sandbox gates. |
| Buyer account upgrade | Verified release; OTP provider activation blocked | Profile/GST, saved addresses, order tracking/documents and repeat order. See BUYER_ACCOUNT_RELEASE.md. |
| Remaining audit actions | Open | Original 14 findings / 94-action audit remains the baseline. |
