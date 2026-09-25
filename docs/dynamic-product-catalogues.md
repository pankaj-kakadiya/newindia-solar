# Dynamic product PDF catalogues

## Admin workflow

Open **Admin → PDF Catalogues** (`/admin/catalogues`). This uses the existing Content permissions: view, create, edit, delete and export.

Create a catalogue with a title and introduction. Choose all published products, selected categories (including active subcategories), or selected product IDs. Review the included-product count/list, choose whether to show selling prices, and preview/download a PDF. Save as a draft or enable publishing to display it on `/downloads`. Uncheck publishing and save to withdraw it. Deleting a catalogue definition does not delete any products or images.

All-products and category definitions automatically include new matching published products. Selected-product definitions retain their selected IDs; removed or unpublished products no longer appear. No permanent PDF snapshots are stored. Each download queries the current public product data, then generates a PDF in the browser. Existing files in the Downloads library remain available separately.

The PDF contains official branding, date, category summary, product images, public technical details, all active variants, optional selling prices with explicit GST treatment, product links and page numbers. Unknown/invalid prices display “Price on request”. Missing/unloadable images show a placeholder message and an export warning rather than preventing the entire download. English catalogue text is supported in this first release; embedded subset fonts cover Latin ASCII. Images use browser CORS rules and an eight-second timeout; no server proxy fetches arbitrary URLs.

## Data and deployment

`20260925190722_dynamic_product_catalogues.sql` is already applied to Supabase project `cdtbwuagqxkknkccpkcr`. It creates an RLS-protected table and three **unpublished** starter definitions: complete range, ACDB and DCDB. Do not replay the migration manually. No service key, public write access, existing product mutation, or image deletion is involved.

Merge the feature PR and deploy main to Hostinger. No VPS, scheduled job, additional environment variable or PDF storage bucket is required. Open the admin manager, preview a starter catalogue, then publish it when ready. Buyers download published catalogues through `/downloads`.

## Validation

- 10 automated tests: selection scope, descendants, excluded products/variants, pagination, invalid definitions, multipage PDF, safe public projection, links, empty exports and database RLS.
- Production build passed.
- Sample cover/product pages rendered with Poppler and visually inspected; embedded fonts eliminate dependence on PDF viewer fallback fonts.
- Live DB verified three drafts and zero rows visible to anon; security advisor returned no findings referencing `product_catalogues`.
- No authenticated live admin browser test performed before deployment.
- Dependency audit reports existing Next.js, PostCSS and XLSX advisories; no jsPDF advisory was reported for the pinned 4.2.1 dependency. Those pre-existing dependency upgrades are outside this feature.
