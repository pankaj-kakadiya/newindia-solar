# New India Solar — Buyer Frontend Design System V2 (Step 24)

This is the shared UI foundation for buyer-facing work from Step 25 onward. New storefront components should use the `nis*` primitives in `app/buyer-design-system-v2.css` and reusable React primitives in `components/buyer/BuyerUI.tsx` instead of creating one-off spacing, colors, buttons, fields or status styles.

## Visual language

- Primary brand: Deep Navy `#0D1B2A`, Energy Green `#1D9B54`.
- Supporting accents: Leaf Green, Solar Gold and Bright Orange only where they communicate meaning or emphasis.
- Surfaces are predominantly white with restrained soft-gray/green panels.
- Cards use visible borders before heavy shadow. Hover elevation stays subtle and functional.
- Buyer CTAs use green for primary conversion and navy for strong secondary actions.
- Destructive red is reserved for errors/removal; amber is reserved for warnings.

## Layout

- Maximum buyer container width: 1280px.
- Desktop horizontal padding: 24px.
- Mobile horizontal padding: 14px.
- Section rhythm: 72px desktop, 44px mobile.
- Use `nisGrid2`, `nisGrid3`, `nisGrid4`, `nisStack`, `nisSection` and `nisSectionHead` before adding custom grid rules.

## Core primitives

`BuyerButton` — primary, secondary, outline, ghost and danger variants; sm/md/lg sizes; block mode.

`BuyerBadge` — default, success, warning, danger, info and dark states.

`BuyerCard` — standard surface with optional hover behavior.

`BuyerField` + `BuyerInput` / `BuyerSelect` / `BuyerTextarea` — consistent label, hint and error treatment.

`BuyerAlert` — success, warning, error and info feedback.

`BuyerSkeleton` — text, title, media and button loading placeholders.

`BuyerEmptyState` — reusable empty / not-found state with primary and secondary actions.

## Interaction rules

- Primary interactive controls are at least 44px high on desktop and 46px on mobile.
- All keyboard-focusable controls receive a visible green focus ring.
- Disabled buttons do not animate or imply clickability.
- Hover motion is limited to small elevation/translation; reduced-motion users receive effectively static transitions.
- Do not hide critical status only in color; pair color with text/icon.

## Form rules

- Always provide visible labels for checkout/RFQ/account fields.
- Optional fields should explicitly say Optional.
- Use helper text for format/context and dedicated error text for validation failures.
- Invalid fields use `aria-invalid` through the shared primitives.
- Preserve entered values after recoverable errors wherever possible.

## Loading / empty / error states

Step 24 adds global App Router `loading.tsx`, `error.tsx` and `not-found.tsx` states. Feature pages should still use contextual skeletons and empty states where the page can load but its data is empty.

## Existing storefront compatibility

The design system deliberately harmonizes existing `.btn`, product card, checkout/RFQ input, cart summary and catalogue loading classes so Step 24 improves the current storefront without requiring a risky all-at-once markup rewrite. Future steps should progressively migrate page markup to the reusable `BuyerUI` primitives.

## Guardrail

Admin/ERP pages keep their own `admin*` component language. Do not reuse buyer UI classes in the admin shell unless a future design decision explicitly merges the systems.
