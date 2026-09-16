# Step 26 — Homepage Conversion V3

## Buyer experience

- Three entry points: components, ACDB/DCDB configuration, project quotation.
- Twelve default BOS category cards. Existing CMS collection overrides remain supported.
- Four active products, ordered by the existing Featured flag and catalogue sort order.
- Variant-aware starting prices including GST, stock availability, and product-detail links.
- ACDB/DCDB custom-box cards, quotation workflow, and EPC/dealer guidance. The current visual builders have no active templates; homepage custom-box actions lead to the working RFQ flow instead of unavailable builders.
- Published CMS downloads plus the supplied 26-page Product Explore catalogue as a bundled fallback.
- Existing homepage CMS order and visibility remain editable; new modules are inserted beside their related sections without overwriting customized ordering.
- Hero title highlights preserve the entire title; partial CMS updates keep default nested fields.
- Explicit illustration labels, contained images, readable mobile text, keyboard focus, reduced motion, and empty/error fallbacks.

The catalogue at `public/downloads/new-india-solar-product-catalogue.pdf` is a compressed copy of the owner-supplied PRODUCT EXPLORE.pdf. It retains all 26 pages. Product and certification statements inside the supplied document have not been independently verified.

## Data access correction

Remote Supabase migration: `step26_scope_cms_staff_policies_to_authenticated`.

Anonymous reads of the CMS failed because a PUBLIC staff policy evaluated the restricted `is_staff_or_admin()` function. The staff policies on `cms_downloads`, `cms_settings`, `cms_pages` and `cms_navigation_items` now apply only to `authenticated`. Their predicates and the separate public-read policies are unchanged; no grants or security-definer functions were added.

Read-only transaction verification as `anon` confirmed:

- CMS settings readable (4 records).
- Inactive downloads: 0 visible.
- Inactive navigation: 0 visible.
- Unpublished pages: 0 visible.
- No published downloads currently exist; the bundled catalogue keeps the download action functional.

Existing broader Supabase advisor warnings are outside this homepage change: public-executable SECURITY DEFINER functions require individual authorization review, and `bulk_slugify` has a mutable search path. This release does not change the production cutover gate. References: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable and https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable.

## Verification and release

Production build and TypeScript checks; legacy/custom CMS order checks; unsafe asset URL rejection; real public product query; production HTTP homepage render; catalogue page-count and visual inspection.

`main` stays deployment-disabled. Advance `staging-release` once for the completed release, then inspect that exact Vercel deployment. The cloud browser cannot reach workspace localhost; staging is the browser-verification target. No production-domain cutover is part of Step 26.

Staging browser verification confirmed the desktop homepage, four real product images/prices, shop, custom-box landing, RFQ and downloads. No horizontal overflow or broken homepage images were observed. Browser device emulation was not available; a physical mobile check remains part of buyer-side QA.
