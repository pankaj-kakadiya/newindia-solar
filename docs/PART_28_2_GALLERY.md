# Part 28.2 — Product layout and image gallery

Scope: refine the saved Step 28 product gallery and fixed mobile purchase-bar layout. No pricing, quantity rules, purchase actions, product records, database schema, configurator logic, logo or brand-token changes.

## Source defects addressed

- The old touch handler tested only horizontal distance, so a diagonal vertical scroll could change the image. It did not clear a gesture on cancellation or reject multi-touch.
- The enlarged view had no gallery keyboard handler. The page view had no Home/End support.
- A failed image shared component state with its replacement, and there was no explicit retry control.
- The fixed mobile bar had space reserved within main only, leaving the footer vulnerable to being covered at the bottom of the document.
- A long title and low landscape viewport could crowd enlarged-image controls.

## Changes

- One-finger, direction-aware, cancellable swipe helper; same handling in normal and enlarged views.
- Left/right/Home/End navigation; native modal focus containment and Escape; focus returned to the enlargement control. Selected thumbnails scroll horizontally into view without moving the whole page.
- Image-keyed load/error states, visible loading feedback and retry for the main/enlarged photo. Existing URLs, admin order and contain rendering remain intact.
- Mobile bar height measured with ResizeObserver. Space is reserved after the whole document and restored on desktop resize or route unmount. Content and footer remain reachable.
- Bounded enlarged dialog with wrapping title and visible controls on portrait and landscape viewports.

## Verification to run for this exact commit

- Existing 56 pure tests plus 12 focused gallery helper tests.
- Existing product-detail browser suite plus focused gallery cases: gestures, keys, failure/retry, zero/one/multiple images, footer clearance, resize cleanup and responsive widths.
- Two existing public catalogue photographs loaded read-only into an isolated browser fixture. Commercial data is omitted in these photo checks; they are not screenshots of production.
- Full Next.js application build/type validation through Buyer release validation.

Full screenshots are stored under the workflow artifact buyer-validation-results. Test outcomes must be recorded from the completed run, not inferred from this checklist. The local container has no external DNS, so it cannot clone/install the full application; full application/browser evidence comes from CI.

## Release boundary

Keep this part on work/step28. Do not move main or staging-release or trigger a Hostinger release for this sub-part. Complete Step 28 release checkpoint 28.6 before publishing. Part 28.3 is the next scope after 28.2 validation.

## References used for implementation

- Next.js 15 Image API: https://nextjs.org/docs/15/app/api-reference/components/image
- WAI-ARIA modal dialog keyboard pattern: https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/
