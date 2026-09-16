# New India Solar — compact working brief

## Locked decisions

- Address the owner as Pankaj Sir.
- Keep the approved enclosure, front view, official New India Solar branding, neutral clear cover, four black corner screws, hinges and wiring style. Do not redesign the box between variants.
- User-supplied enclosure size: height 180 mm, width 130 mm, depth 100 mm.
- Reuse the provided component PNGs unchanged. Current pack: 11 AC components, 11 DC components and 10 shared layers (32 PNGs total).
- Build separate ACDB and DCDB selectors with component previews, configurable accessories, downloadable box PNG and component list, and quotation handoff.
- Do not invent prices, inventory or engineering certification. The current artwork pack is quotation-only.

## Existing systems

- GitHub: `pankaj-kakadiya/newindia-solar`.
- Production: `newindiasolar.com` on Hostinger.
- Vercel: controlled staging only. Preserve Step 28 work already on staging-release.
- Supabase: existing New India project; retain the current catalogue, order and RFQ workflows.

## Completed locally

- Integrated all 32 source PNGs and both visual builders.
- Added component selection, optional wiring/accessories, PNG export, component list and RFQ prefill.
- Matched placement metadata to the locked box; checked all 48 SPD/breaker combinations.
- Preserved Step 28 buyer flows in the staging merge.
- Production build and all 65 regression checks passed.
- Prepared separate inactive-inventory registration and post-deployment activation SQL.

## Remaining release work

- Complete GitHub publication and one controlled staging deployment.
- Verify rendered staging pages, selections, exports and RFQ prefill.
- Access the existing Hostinger deployment and publish the reviewed application revision.
- Activate the quotation-only catalogue only after the new application is verified on production.
- Verify live ACDB/DCDB routes. Confirm prices and stock separately before enabling purchases.

At this checkpoint the builder release is not live. Use `BUILDER_ASSETS_RELEASE.md` for the rollout sequence. Continue from saved progress; do not recreate assets or restart the implementation.
