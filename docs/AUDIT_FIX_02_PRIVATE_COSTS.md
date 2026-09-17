# Step 2: internal catalogue cost protection

Completed on production, 17 September 2026.

Website release: ece8c9a17d9a642c95801ccbf68e7b9029f53539 (GitHub main, deployed through Hostinger). The production release marker and live product page were verified before the database restriction was applied.

Database migrations:
- 20260917025748_admin_catalogue_cost_access: guarded admin cost endpoint.
- 20260917161036_restrict_catalogue_cost_reads: final direct cost-column restrictions. The previous prepared filename 20260917025825 was renamed to match actual live migration history; do not apply it again.

Verified:
- anon and authenticated have no SELECT access to cost_price in product_variants, components or enclosures; selling_price remains readable and RLS remains enabled.
- Nine live anonymous HTTP checks passed: safe projections return HTTP 200; cost-only and wildcard projections return 401/42501 for all three tables.
- Authenticated buyer identity was denied access to the admin cost RPC in a rolled-back database test.
- An existing active admin identity retrieved one cost record from each table via the protected RPC after restrictions. Tests used transaction-local identity claims; no identities, catalogue values or orders were modified or printed.
- Live buyer product page continues to load selling price, GST, stock and editable quantity controls.
- 237 automated test results and the production build passed.
- Security advisor warning categories unchanged; this is not certification of all remaining audit findings.

Limitation: authenticated admin browser editing was not exercised; admin access was verified at the live database endpoint and by automated client tests.

Admin pages already open before deployment should be refreshed. Never roll the website back to wildcard catalogue queries while these restrictions remain enabled.

Next: standard checkout stock, MOQ, positive-price and concurrent ordering validation.
