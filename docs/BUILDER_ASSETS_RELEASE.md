# ACDB and DCDB component release

This release adds 32 supplied PNGs: 11 AC components, 11 DC components and 10 shared enclosure, wiring and label layers. The PNG bytes are preserved. Both builders use the locked enclosure, with selectable SPD/breaker brands, accessories, transparent PNG export and a component list carried into the existing RFQ form.

## Review routes

- `/customize/acdb?preview=components-v1`
- `/customize/dcdb?preview=components-v1`

These routes use the bundled catalogue, require no production activation, and support quotation requests. Normal routes continue to respect the database activation flag. Unpriced artwork cannot enter checkout as a free build.

## Production rollout

1. Run `npm ci`, `npm run test:builder` and `npm run build` on Node 22.
2. Review both staging routes, component changes, mobile layout, PNG download and RFQ prefill. Do not submit test enquiries to the production RFQ table.
3. `scripts/stage-builder-assets.sql` registers 31 components and the enclosure as inactive inventory. It preserves existing prices, stock and activation states on subsequent runs.
4. Deploy the reviewed application revision to the existing Hostinger Node application. Keep the existing domain and DNS. Do not promote Vercel staging as production.
5. Verify the preview routes and `/configurator/components-v1/enclosure-empty.png` on `newindiasolar.com`.
6. Run `scripts/activate-builder-catalog.sql` against the existing New India Supabase project. This publishes 40 option values and 22 placement slots in quotation-only mode.
7. Verify `/customize/acdb` and `/customize/dcdb` without the preview query, PNG export and RFQ prefill.

## Limits and rollback

The supplied artwork provides visual selection, not manufacturer-verified wiring, dimensions, electrical compatibility, ratings, inventory or pricing. The enclosure's 180 H × 130 W × 100 D mm label is user supplied. There is no automatic electrical design or checkout for this artwork pack.

To withdraw the release, set the two configurator templates' `is_active` fields to false, then restore the prior application revision in Hostinger. Preserve records rather than deleting catalogue or saved configuration data.

The existing staging-release branch includes Step 28 work. Any staging integration must retain that work; this release must not replace the branch with an older main snapshot.
