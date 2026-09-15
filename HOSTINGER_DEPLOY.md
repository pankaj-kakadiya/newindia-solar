# Hostinger Production Deployment

## Recommended Hostinger setup
- Hosting: Business Web Hosting or Cloud plan with Node.js Web App support
- Framework: Next.js
- Node.js: 22.x
- Repository: `pankaj-kakadiya/newindia-solar`
- Branch: `main`

## Build settings
- Install command: `npm install`
- Build command: `npm run build`
- Start command: `npm run start`

## Required environment variables
Set these in Hostinger hPanel before deployment:

```env
NEXT_PUBLIC_SUPABASE_URL=https://cdtbwuagqxkknkccpkcr.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<your Supabase publishable key>
```

## Domain
Attach `newindiasolar.com` to the Node.js Web App after the first successful deployment. Keep SSL enabled.

## Supabase Auth
After the production domain is connected, add these URLs in Supabase Auth redirect settings:
- `https://newindiasolar.com`
- `https://newindiasolar.com/**`
- `https://www.newindiasolar.com`
- `https://www.newindiasolar.com/**`

## Production checks
- Home page loads over HTTPS
- Shop loads active products only
- Product page images load from Supabase Storage
- Login and password reset redirect to production domain
- Cart and checkout load correctly
- Admin login works
- Bulk RFQ form works
- No demo/test products or sample orders are visible
