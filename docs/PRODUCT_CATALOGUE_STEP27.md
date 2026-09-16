# Step 27 — Product Catalogue / Listing Page V2

## Implemented scope

- `/shop` uses the existing buyer design tokens, header, footer, cart context and catalogue tables. No replacement logo or fabricated product imagery.
- Active products and categories load in stable, 200-row batches with exact-count and duplicate checks. An incomplete/error response is not presented as a complete or empty catalogue. Both requests are cancelled on unmount, with a 30-second overall timeout and a retry action.
- Explicit public column projections exclude cost prices. Embedded variants are filtered to active even for signed-in staff. Existing row-level policies remain unchanged.
- Search covers names, SKU, brand, category, descriptions and scalar published specifications. Search is submitted with Enter or the Search button; it does not redirect to an arbitrary first suggestion.
- Category selection includes active descendants. Brand, MOQ-aware stock, GST-inclusive price range and category/search-context technical filters can be combined. All variant-specific conditions must be satisfied by the same active variant.
- Technical filter aliases accommodate current master keys such as OPERATING VOLTAGE, RATED VOLTAGE (UC), POLE CONFIGURATION, CURRENT RATING and discharge ratings. Uc is not confused with Up; discharge current is not breaker current. Ratings are never extracted or guessed from marketing text.
- Featured/name/stock/ascending-price/descending-price sorting. Quote-only products sort after priced products in either price direction.
- Twelve products per page; grid/list views; removable filter chips; shareable query strings; legacy `q` and `cat` URLs; Back/Forward restoration through the Next.js native History API integration.
- Product images respect master sort order and contain/fallback rendering. Product prices show base, tax and GST-inclusive totals in paise. Zero GST remains zero; unknown tax does not silently become 18%.
- Multi-variant products use Choose options, never an arbitrary add-to-cart variant. Single-variant standard products re-read current status, price, MOQ and stock before adding, with cart quantity limits and accessible feedback. This is not a stock reservation; checkout remains authoritative.
- Existing product and bulk-RFQ destinations are retained. Published datasheet links are shown only for safe HTTPS or local paths. A bulk link does not claim to prefill the future Step 32 RFQ.
- Desktop sidebar and native mobile modal drawer with keyboard dismissal, focus return, scroll locking and resize handling. Scoped CSS includes reduced-motion support and loading/error/empty states.

## Files

- `app/shop/page.tsx` — metadata, Suspense, existing shell.
- `app/shop/catalogue-v2.css` — scoped responsive catalogue styles.
- `components/buyer/ShopCatalogue.tsx` — data loading, filters, product cards, drawer and cart hand-off.
- `lib/catalogue.ts` — typed pure query, attribute, price and filtering helpers.
- `tests/catalogue.test.mjs` — Node regression tests using synthetic fixtures, not production test products.

## Verification

Run on Node 22:

```sh
node --experimental-strip-types --test tests/catalogue.test.mjs
npx tsc --noEmit
npm run build
```

The implementation session ran 32 passing pure-function tests, a strict standalone TypeScript check of `lib/catalogue.ts`, TSX syntax transpilation checks and CSS parsing. Supabase schema and existing catalogue master keys were inspected read-only. No database writes, catalogue uploads, orders, payments or policies were changed.

The local workspace could not download the full repository/dependencies because external DNS was unavailable. A full application build and interactive browser checks must therefore be distinguished from those local checks; verify the exact release deployment's build logs rather than treating the standalone checks as a full Next.js build.

## Browser acceptance checklist

1. Open `/shop`, `/shop?q=SPD`, `/shop?category=mcb`; submit a SKU search; use Back and Forward.
2. Combine technical specifications, brand, stock and price; remove individual chips and clear all. Check filters with no matches and an unknown category.
3. Check both price orders, featured order, pagination, grid/list and a no-price product. Verify only active options are displayed.
4. At 360/390/768/1440 widths check horizontal overflow, contained images, readable controls, drawer focus/Tab/Escape, scroll lock and desktop resize.
5. Check the drawer and desktop price-range validation, unavailable image fallback and catalogue retry state.
6. In an isolated/test cart, verify one standard SKU add, minimum quantity and stock limit; multi-option products must navigate to selection. Do not submit an order or charge a payment merely to check the catalogue.
7. Follow product, datasheet, cart and project-RFQ links; confirm existing header/footer and homepage remain unaffected.

## Release boundary

Keep the existing controlled Vercel `staging-release` flow. Do not modify DNS, production credentials, Supabase Auth or the Hostinger domain. Confirm the exact staging build and record its SHA in the delivery note. Hostinger production publication and production smoke tests remain separate; GitHub or Vercel success is not evidence of a live-domain update.
