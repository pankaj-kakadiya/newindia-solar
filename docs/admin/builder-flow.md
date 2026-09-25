# ACDB, DCDB and Combo admin flow

ACDB and DCDB use the published database catalogue. Normal buyer routes never silently fall back to the bundled example. The explicit `?preview=components-v1` route remains a labelled visual sample for asset QA.

1. Admin → Configurator → Templates & Enclosures: prepare an active enclosure with the correct supported type and inside image.
2. Options & Defaults: link active components and an enclosure. Configure required groups, quantity limits, visibility and defaults. Edit or disable values here; archived RFQ snapshots keep their old labels and IDs.
3. Slot Mapping: map each offered component and quantity to the selected enclosure. Keep slots within the canvas. Compatibility Rules constrain the buyer selection; deny rules take precedence.
4. Templates & Enclosures → Check catalogue: resolve all displayed errors, then Check & publish. Unpublish removes the live catalogue on the next buyer load/refresh. Publishing permits quotations, not engineering approval or direct custom checkout.
5. A buyer selects components and chooses Request quotation, then submits contact details. The RFQ stores the selected IDs, labels, quantities and a descriptive snapshot. Local Save draft stays on that device until submitted.
6. Configurator → Customer Configurations shows submitted builder requests separately from priced configurations. The RFQ pipeline displays the snapshot and handles staff assignment, quotes and follow-up. RFQ view permission is required. Treat the snapshot as a customer request, not trusted pricing or an approved manufacturing BOM.
7. Combo Products controls whether standard products belong on ACDB/DCDB sides or are excluded. Normal Products controls publication, variants, price, tax, MOQ and stock. The buyer sees eligible products and rechecks these settings before adding two standard order lines to the cart. This is a pair of finished boxes, not a single combined enclosure.

## Current catalogue setup

At the audit on 22 September 2026 both custom templates were unpublished, all default selections were unset, several DCDB groups had no values, and only five visual slots existed. These require catalogue setup and review. This change does not invent missing ratings, prices, stock, default electrical selections or engineering approvals. Products and image files are not altered.

## Database deployment

Apply the `builder_rfq_snapshot` migration before deploying the new form. It adds a nullable, size-limited JSON snapshot to the existing RFQ table, without changing RLS or granting public read access. Existing RFQs remain valid. No product or storage migration is required.

## Validation

Run the existing full Node regression suite and production build. Admin builder integration CI exercises published catalogue updates after user edits, unpublishing, the RFQ handoff with intercepted writes, and unpublished landing links. Database tests use isolated PGlite, never production customer records.
