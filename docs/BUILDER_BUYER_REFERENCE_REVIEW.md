# ACDB / DCDB buyer-builder reference review

## Requested scope
Prioritize the compact ACDB/DCDB builder, supplied component visuals and buyer desktop/mobile operation. Keep the unvalidated Part 28.4 checkout draft separate. Base source: main 54e15eed602177d6cf5507be98fd4d0409b860ab.

## Source packs inspected
ACDB archive: 20 ACDB visual drafts, plus REF-14-DC-COMPONENTS-REVIEW.png. README and CSV explicitly exclude reference 14 from ACDB because it contains DC-marked components; 07 and 16 intentionally retain the same combination. These are generated visual proofs, not exact photographic composites or engineering drawings.

DCDB archive: uploaded ZIP lacks its central directory and ends inside DCDB-17.png. Local-header recovery recovered DCDB-01.png through DCDB-16.png with matching CRC and uncompressed sizes. DCDB-17 is partial; 18-20 and the trailing index are unavailable in these bytes. The original upload was not modified. No missing reference was invented.

All usable reference images were inspected as numbered contact sheets. Arrangement: SPD pair left, breaker centre, terminal pair right, curved wires above, sticker row below and two lower glands. The source component PNGs and original brand imagery are retained byte-for-byte.

## Database boundary
Read-only inspection at start: 32 active component records; none with a positive selling price; both templates inactive; no active enclosure. The buyer routes therefore did not open a working published-template builder. Images alone are not pricing or engineering approval. No template, enclosure, product, component price, database schema, payment or order record is changed by this implementation.

## Implementation
Normal ACDB/DCDB routes open the existing uploaded visual catalogue as a quotation builder without a special preview parameter. Valid published template data can be read separately; incomplete or unavailable commercial data is not advertised as a purchasable product. Purchase/cart execution is intentionally not used until authoritative pricing and engineering checks exist.

Scoped buyer styling avoids catalogue cv* collisions. Added uploaded-reference selection, corrected breaker width and top alignment, independent AC/DC choices, required/mapped-slot validation, optional layers and gland counts, browser-local save/restore, current-component PNG and BOM export, a full-size mobile preview dialog and a fixed action bar with footer clearance. RFQs use a per-request draft key and carry asset identifiers, component names, quantities and the selected reference to the existing enquiry form. PNG export shares the screen's aspect-preserving/top-alignment calculation.

## Validation gate
Local focused helper tests: 93 passed. Existing immutable-PNG tests, full application build and browser tests must pass on the exact final commit before release. Browser suite is designed to exercise all 24 SPD/breaker combinations for each domain at both 390px and 1440px (96 rendered combinations), every available reference preset, optional layers, quantity controls, draft persistence, exports, enquiry hand-off, image failure/retry, keyboard dialog behaviour and additional responsive viewports. Synthetic RFQ submissions are intercepted; no real lead/order/payment is created. Live-domain GET-only observations are recorded separately and are not automatically counted as a successful live deployment.
