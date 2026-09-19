# Part 28.3 — Variants, price and quantity

This bounded change continues `work/step28` from `7b3beb1`. Gallery work is retained. No templates are activated and no database writes, prices, master records, brand assets, DNS or hosting settings are changed.

## Implemented

- Resolve only active variants. Multiple choices require selection; invalid/inactive deep links never silently select another SKU. A stale link with only one remaining active option now offers that option explicitly instead of leaving the buyer stuck.
- Synchronize selected SKU, unit, price, specification overrides, stock and quantity controls through the same selected variant. Preserve URL campaign parameters and browser history. Quantity drafts are keyed to the selection.
- Use exact decimal integer arithmetic for selected line base/tax totals, with half-up paise rounding. Keep zero GST; do not guess unknown GST or substitute another variant's price. Reject malformed values, over-precision and unsupported line totals.
- Read-only schema inspection confirmed `product_variants.selling_price` and `order_items.unit_price/line_total` are numeric(12,2), and stock/order quantity is numeric(12,3). Quantity validation is limited to three decimal places. Published prices/rates with unsupported precision fail closed.
- MOQ remains a lower bound, not a pack multiple. For MOQ 5 and quantity_step 2, the first valid purchase is 6. Initial quantity, HTML min/step, plus/minus and validation now use that same zero-based increment sequence.
- Missing explicit quantity increments keep the existing unit policy (0.01 for measured units, 1 for other units). A malformed explicit increment or minimum is shown as needing confirmation rather than silently replaced.
- Distinguish unknown stock, no stock, stock below the purchasable minimum, and stock already covered by the cart. Typed invalid quantities remain editable and cannot generate a misleading purchase total.
- Recheck active status/price/GST/quantity/stock before addition. Refresh visible product data when it changes. Price, tax or quantity-rule changes require another deliberate click; no silent price acceptance. Late responses for a departed selection cannot add the old SKU.

## Verification

Focused helper tests and a strict standalone TypeScript check ran locally. Full build/application types and the complete browser regression suite must be verified on the exact work-branch commit in Buyer release validation. New browser cases use intercepted synthetic catalogue data and block remote writes; no real orders/payments are created.

Test coverage includes deep links, Back/Forward, SKU/specification/price synchronization, zero/unknown GST, numeric limits, MOQ/step mismatch, fractional quantities, existing-cart stock limits, stale prices/stock, deactivated options, failed/stale asynchronous rechecks and mobile controls. The pure suite also compares 3,000 arithmetic cases with an independent integer reference and 19,999 supported unit-price/rate cases with the existing catalogue.

## Boundary and next part

This is buyer-page validation, not an inventory reservation or authoritative order guarantee. Checkout/order-service enforcement, aggregate-cart review, repeated-addition concurrency and full Buy Now testing remain Part 28.4. Part 28.6 owns staging release and production readiness. Physical-device/browser-engine checks and the previously reported dependency audit warnings remain open.

Implementation references: HTML number-input step base is `min` when present (MDN https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number); native History API integrates with Next.js search parameters (https://nextjs.org/docs/app/getting-started/linking-and-navigating). These explain implementation choices, not product ratings or GST classifications.
