# Step 28 — Product Detail Page V2

Implemented: active variant selection and deep links; contained product photos, thumbnails, enlargement dialog and touch/keyboard gallery; actual published specs, contents and documents; price/GST and minimum-quantity checks; stock-aware checked additions; Buy Now opens checkout without removing the existing cart; SKU/quantity hand-off to RFQ; responsive purchase bar; retry/unavailable states. Removed invented IP65/application/lead-time fallbacks. No product images or catalogue data were fabricated.

The cart hydration no longer writes an empty cart before reading browser storage. Checked additions update stale line prices and reject same-tab combined quantities above the freshly retrieved stock. Per-line GST is preserved; legacy unknown rates remain visibly unconfirmed. Client stock checks are not reservations.

Local verification: 32 existing catalogue tests plus 24 new buyer-commerce tests passed (56 total). Pure helpers received a strict TypeScript check, TSX was syntax-transpiled. Full application types/build and isolated browser tests run in the read-only Buyer release validation workflow. Browser fixtures intercept Supabase requests and must never write to production.

The checkout preflight/summary integration is grouped with Step 29 because its custom-build path depends on the new validated quote RPC. No payment provider credentials, DNS, production hosting configuration, product records or prices were changed in Step 28. Vercel staging and Hostinger production remain separate releases.
