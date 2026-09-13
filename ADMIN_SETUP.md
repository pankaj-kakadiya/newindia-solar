# New India Solar V1 - Admin & Secure Checkout Setup

## Supabase
Project ref: `cdtbwuagqxkknkccpkcr`

Required environment variables:
- `NEXT_PUBLIC_SUPABASE_URL=https://cdtbwuagqxkknkccpkcr.supabase.co`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<Supabase publishable key>`

## Admin access
The `/admin` area accepts only Supabase Auth users whose `public.profiles.role` is `admin` or `staff`.
Create/sign up the desired user first, then promote that specific user ID to `admin`.
Do not assign admin to an unverified or unknown account.

## Secure customer checkout
1. Customer signs in at `/login`.
2. Storefront cart is synchronized into the authenticated Supabase `carts` / `cart_items` tables at checkout.
3. Custom ACDB/DCDB configurations are saved through server-priced database logic and preserve a frozen BOM/configuration snapshot.
4. Checkout calls `place_order_from_cart()` to create the order and order-items server-side.
5. Custom items create production jobs and BOM rows automatically.

## Important
- Do not commit `.env.local`.
- Custom configurations with zero final price are intentionally blocked from checkout until commercial component/enclosure prices are entered.
- Payment provider integration is not yet enabled.
