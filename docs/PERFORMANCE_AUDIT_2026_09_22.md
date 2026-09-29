# Buyer and admin performance audit — 22 September 2026

Baseline source: live Hostinger site measured through PageSpeed Insights, Lighthouse 13.5.0. These are single-run lab results, not field percentiles. The deployed commit was not independently established. Development started from main `40be4414b6e88fe3c4aeb313f22ee1f7745c9c4f`.

| Page | Mobile P / A / BP / SEO | Desktop P / A / BP / SEO |
|---|---|---|
| Home | 84 / 90 / 100 / 92 | 98 / 94 / 100 / 92 |
| Catalogue | 77 / 91 / 100 / 92 | 88 / 95 / 100 / 92 |
| Product example | 72 / 85 / 100 / 100 | 83 / 89 / 100 / 100 |
| Empty cart | 81 / 89 / 100 / 66 | 96 / 94 / 100 / 66 |
| Admin login | 83 / 100 / 100 / 66 | 99 / 100 / 100 / 66 |

P = Performance; A = Accessibility; BP = Best Practices.

Reports:
- Home: https://pagespeed.web.dev/analysis/https-newindiasolar-com/9m7ac1f2ro
- Catalogue: https://pagespeed.web.dev/analysis/https-newindiasolar-com-shop/drcdwmh3cl
- Product: https://pagespeed.web.dev/analysis/https-newindiasolar-com-product-empower-electric-em60-c32a-dc-32a-2-pole-dc-miniature-circuit-breaker-500v/ufmgjeco5a
- Cart: https://pagespeed.web.dev/analysis/https-newindiasolar-com-cart/4cscfmu3or
- Admin login: https://pagespeed.web.dev/analysis/https-newindiasolar-com-admin-login/iw50pa4l9s

## Findings and changes

- Buyer root imported 26 admin stylesheets totaling 251,084 uncompressed source bytes. Scope these styles to the admin layout. This is source weight removed from the buyer root, not a measured network-byte reduction.
- Catalogue and homepage bypassed responsive optimization for full-sized product photos. Enable Next image optimization for the existing public Supabase storage host only; retain direct delivery for other CMS-approved sources. Product detail now uses responsive images and prioritizes its main image.
- Root metadata omitted `metadataBase`, producing an invalid relative homepage and catalogue canonical. Set the production origin explicitly.
- Mobile quotation icon lacked an accessible name when its text was hidden. Add an explicit name; fix footer heading order and the small-text contrast findings.
- Support mounted authentication effects even on hidden admin routes. Keep hidden routes unmounted; resolve support identity only when the popup opens and suspend its realtime subscription while closed.
- Storefront navigation no longer speculatively loads many catalogue destinations during initial rendering.
- Admin navigation prefetched every visible workspace. Disable automatic sidebar prefetch; destinations load on navigation.
- Admin imports loaded the spreadsheet parser at startup. Import it only during file parsing or Excel template export.
- Add reproducible mobile/desktop Lighthouse reports against the production build in CI. Report invalid/redirected/failed audits as errors. Do not impose a false 100-score assertion or remove functionality to improve scores.

## Verification and limits

The CI report is a lab audit of the proposed production build, not proof of Hostinger deployment. Review the downloadable HTML/JSON artifacts and rerun PageSpeed after deployment.

The authenticated admin dashboard, role-specific modules, populated checkout, and all catalogue variants have **not** been measured in an authenticated live session. No credentials were supplied and no authentication protections were bypassed. This is shared-code review plus representative route measurement, not certification of every route.

Private admin/account/cart/checkout routes must retain their indexing restrictions. A 100 SEO score is not a release target for private pages.

The homepage still performs live database reads and client-side theme/CMS loading. Further improvements should use measured production traces, preserve CMS updates, and avoid caching user-specific or stock/price data globally. Authenticated admin data waterfalls require a real session before changing behavior.

## Release

The first commit passed all 380 regression tests and the complete production build in GitHub CI. Its Lighthouse results prompted additional fixes for the favicon, logo delivery, loading-state shifts, product tab semantics and contrast. Final-commit scores are recorded in the workflow artifacts.

Run existing regression tests and the production build, inspect CI Lighthouse reports, complete responsive staging QA, and then follow `DEPLOYMENT_WORKFLOW.md`. No production deployment or database change is performed by the audit workflow.
