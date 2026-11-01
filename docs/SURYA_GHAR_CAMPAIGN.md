# Surya Ghar Village Campaign module

Admin route: `/admin/campaigns` (menu: Sales & Customers → Surya Ghar Campaign). Module key: `campaigns`.

Runs the PM Surya Ghar + Gujarat state top-up village campaign (GR EPCD/BUD/e-file/20/2025/2435/B1,
22-10-2026: households pay 10% of the MNRE benchmark, SC/ST 5%, for systems up to 2.18 kWp DC
commissioned on or after 22-10-2026) in Gir Somnath, Amreli and Bhavnagar.

## What it does

- **Overview:** targets with progress and days left, pipeline by stage, district table, overdue follow-ups, camp performance.
- **Leads:** one row per household; search and filters (district, camp, stage, follow-up due); stage change from the table;
  call and WhatsApp buttons (WhatsApp opens a Gujarati follow-up message and logs it on the timeline); drawer with subsidy
  breakdown, pipeline dates, subsidy-received flags, notes and an activity timeline. Import from the Excel lead tracker
  (`Leads` sheet, header row with `Name`; the example row is skipped; `Camp ID` links to camps). CSV export.
- **Village camps:** camp details, sarpanch, partner vendor, bank, attendance, pre-event and kit checklists, results.
- **Targets:** editable targets per metric, optional district and due date; actuals are counted automatically.
- **Subsidy calculator:** `lib/surya-ghar-campaign.ts` (`calcSuryaGharSubsidy`), shared by the leads drawer.

## Villages & venues (second update)

- District → taluka → village pickers on leads, camps and venues. The 27 talukas of Gir Somnath, Amreli and Bhavnagar are
  built in with Gujarati names (`lib/gujarat-places.ts`); villages autosuggest in English or Gujarati from `geo_villages`.
- Villages typed on a lead or camp join the directory automatically. The full list comes from importing the LGD
  "Villages" download (lgdirectory.gov.in → Download Directory → Villages; State Gujarat; each district), which carries the
  Gujarati name (`Village Name (In Local)`), LGD and Census codes.
- **Villages & venues** tab: taluka coverage (villages in directory, Census households, villages reached by a camp, leads,
  registered, commissioned), the village list with per-village results, and saved venues.
- Venues (panchayat office, government school, temple, ground, samaj vadi, dairy) are saved once per village and picked for
  later camps (`campaign_camps.venue_id`).
- Migration `20261102180000_campaign_villages_venues.sql` (apply after the first one).

## Database

Migration `supabase/migrations/20261102120000_surya_ghar_village_campaign.sql` creates `campaign_camps`,
`campaign_leads`, `campaign_lead_activities` and `campaign_targets`, registers the `campaigns` admin module
(admin: full; sales: view/create/edit/export; general: none) and seeds the first four targets
(10 camps, 300 registrations, 150 surveys, 100 commissioned by 31-Dec-2026).

- RLS on every table via `has_admin_permission('campaigns', …)`; anon has no access.
- One lead per PGVCL consumer number (case/space-insensitive unique index).
- Mobile must be 10 digits; system size 0–10 kW.
- Stage changes are logged to `campaign_lead_activities` by trigger.

**Apply the migration to Supabase project `cdtbwuagqxkknkccpkcr` before staff use the page.** Until it is applied,
the page shows "Campaign tables are not set up yet".

## Tests

`tests/surya-ghar-campaign.test.mjs` (subsidy figures, funnel counting, mobile/WhatsApp, Excel import mapping, nav wiring)
and `tests/surya-ghar-campaign-db.test.mjs` (migration on PGlite: permissions per role, constraints, stage log).
