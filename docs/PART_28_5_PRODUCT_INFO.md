# Part 28.5 — Product information and enquiry

This part verifies the V2 product detail page (`components/buyer/ProductDetail.tsx`, carried over from the `work/step28` merge in Part 28.4) against the Part 28.5 scope: specifications, inclusions, published warranty/lead-time data, safe document links, related products and exact SKU/quantity transfer into RFQ. No application code changes were needed — the V2 page had already replaced the old V1 page's guessed marketing content (invented applications, invented badges like "IP65"/"Solar Ready", an invented generic description) when it was written for Part 28.2, but none of that was covered by an integration-level test until this part. Only test coverage was added.

## Verified

- **No guessed content**: with nothing published (no specifications, inclusions, warranty, lead time, or documents), the page shows explicit "has not been published" copy in each tab and never falls back to invented ratings or marketing text (checked against the exact strings the old V1 page used to invent: "IP65", "Solar Ready", "EPC Ready", "Residential rooftop").
- **Specifications**: published product specifications render; a variant attribute overrides only the matching (case/underscore-normalized) key, leaving other keys untouched — confirms `specEntries`'s existing merge behavior end-to-end, not just at the pure-function level.
- **Inclusions**: published box contents render as a list; nothing is shown if unpublished.
- **Warranty / lead time / HSN**: each renders only when actually published (warranty > 0 months, lead time ≥ 0 days), using the exact published values.
- **Safe document links**: a published `https://` datasheet URL renders as a real `target="_blank" rel="noopener…"` link; a datasheet/guide URL using an unsafe scheme (`javascript:`) is dropped entirely rather than rendered as a clickable link, confirming `safeAssetUrl` is actually applied on this page, not only unit-tested in isolation.
- **Related products**: the outgoing query is scoped to the current product's category and explicitly excludes the current product's own id (`category_id=eq.<id>`, `id=neq.<self>`, `status=eq.active`); an empty related list renders no related section at all rather than an empty one.
- **RFQ hand-off**: switching to a second variant and typing a quantity carries that exact variant id and quantity into the `/bulk-order` link, for the same product already covered by the Part 28.2/28.3 suite.

## Test coverage added

`tests/product-info-part285.browser.cjs` — 7 focused browser cases against an intercepted synthetic fixture with production writes blocked, covering all of the above.

## Verification

- 305 existing pure regression tests (298 + the 7 Part 28.4 cart tests) pass, unaffected.
- The existing 41-scenario PGlite `checkout-integrity.test.mjs` passes, unaffected.
- New 7 browser tests pass.
- Full existing browser suite re-run: unaffected (no application code was changed in this part).
- Full Next.js production build and a strict standalone TypeScript check both pass.

## Boundary and next part

This part is verification of already-published data display; it does not check content moderation of what admins publish (that data is trusted as already reviewed) and does not touch the custom ACDB/DCDB builder. Part 28.6 (Step 28 release checkpoint) remains open.
