# ACDB-14 and DCDB-21 additions

Added from the two photographs supplied on 22 September 2026:

| SKU | SPD | Breaker |
| --- | --- | --- |
| NIS-ACDB-14 | ORBIT OT-SPD-40 AC | EMPOWER EM60-C20A AC, 20A marking |
| NIS-DCDB-21 | WinSurge WS600-40 PV | SIEMENS 5SL52327RC06 DC, 32A marking |

ACDB-14 is a new corrected listing, not restoration of the deleted mixed-domain reference. DCDB-21 continues the existing catalogue numbering. Device markings do not establish assembled-box ratings.

## Catalogue and database

`scripts/add-acdb14-dcdb21.sql` was executed against the existing project after a rollback rehearsal. It adds two active products, zero-stock variants, two images per product, the two new AC component records, builder option links, and template reference metadata. Existing products, defaults, and publication state are preserved. Price follows the existing range: 762.71 excluding 18% GST (900 rounded including GST). Component costs remain unset.

The SQL guards SKU collisions and uses deterministic IDs. It is not an automatic deployment migration. Do not run it against another project without checking its source SKUs and referenced catalogue IDs.

## Image provenance

Generated catalogue previews are accompanied by the supplied original photographs. Files are in `public/catalogue/box-additions-20260922/`; the new transparent sprites are `public/configurator/components-v1/ac-mcb-empower-c20a.png` and `ac-spd-orbit.png`. Database URLs pin these files to asset commit `bbdb44252298f3a1773181f019fe52f49a07c797`.

Generation directions: use each supplied photograph for component identity and arrangement, match the existing New India Solar enclosure/catalogue presentation, retain the correct AC/DC domain and 20A/32A identification, and produce a clean catalogue illustration. Sprite directions: isolate the AC EMPOWER C20A breaker and ORBIT AC SPD on transparency in the existing sprite presentation. Generated artwork is illustrative and requires review against the accompanying original photograph.

## Deployment and verification

Catalogue records and builder option links are already in the live database. Buyer reference menus and bundled sprite mappings require this branch to be merged and deployed. The currently inactive admin templates are not automatically published by this change.

The separate admin integration PR #33 also edits `ConfiguratorBuilder.tsx`. Resolve that overlap while preserving its publication controls and this change's reference mappings; do not replace the entire file with the older builder version.

Validation: 117 builder/asset tests passed; production build passed. Live database readback confirms both active listings, two images each, zero stock, and the new AC component option links. Browser suite expectations have been updated; it was not run locally because Playwright is not installed.

## Complete buyer catalogue follow-up

The buyer reference menus now contain every number 01–21 for both ACDB and DCDB. DCDB-17 uses Finder + Lauritz Knudsen; 18 uses Sighter + EMPOWER; 19 uses SCHUTZ + Lauritz Knudsen; 20 uses WinSurge + EMPOWER; 21 uses WinSurge + SIEMENS. These are assembled dynamically from existing component sprites, so selection, component lists, saved drafts and PNG export share the same preview layers. No additional static image is required.

Mappings 17–20 were verified from live product specifications. ACDB-01 and ACDB-11 now use the ORBIT AC asset to match their listed SPD. The old ZIP-recovery message has been replaced by a catalogue count and useful selection guidance.

Follow-up validation: 128 builder/asset tests passed, including continuous numbering, exact component mappings, preview layers, component-list output and saved-draft restoration for DCDB-17–21.
