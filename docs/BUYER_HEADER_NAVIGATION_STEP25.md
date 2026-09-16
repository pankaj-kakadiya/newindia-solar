# Step 25 — Buyer Header, Navigation & Mega Menu V3

The storefront header prioritizes three buyer flows: browse products, configure an ACDB/DCDB, and submit a project RFQ.

## Desktop

- Product mega menu with twelve core product families.
- Direct ACDB and DCDB catalogue links.
- Dedicated ACDB/DCDB builder mega menu.
- Persistent Project RFQ action plus search, account and cart.
- CMS-managed links render after the fixed buyer journeys.
- Duplicate CMS links for Products, Customize, Bulk Order and Project RFQ are suppressed.

## Mobile

- Accessible full-height drawer.
- Three prominent journey cards: Buy Products, Build a Box and Project RFQ.
- Expandable product catalogue and builder sections.
- Account, cart, support and CMS-managed links.
- Scroll locking and route-change cleanup.

## Interaction and accessibility

- Skip-to-content link.
- Escape closes menus and search.
- `aria-expanded` and `aria-controls` on expandable controls.
- Dialog semantics for mobile navigation and search.
- Reduced-motion support.
- Command/Ctrl + K opens buyer search.
