# Admin session security and activity

Migrations: `20261103120000_admin_sessions_activity.sql`, `20261103121000_campaign_team_roles.sql`.

## Rules (Access → Activity & Sessions → Session security)
| Rule | Default | Enforced by |
|---|---|---|
| Sign out after no activity | 30 min (60 s warning) | Browser timer + database (`last_active_at`, 1 min grace) |
| Maximum session length | 12 h | Database (`auth.sessions.created_at`) |
| One session per person | On | Database: the newest sign-in wins; older devices are ended |
| Record pages opened | On | `log_admin_activity('page_view')` from AdminGuard |
| Owner "Sign out everywhere" | — | `nis_security.session_cutoffs` |
| Automation account | none | Exempt from idle and maximum length only (daily portal snapshot) |

All checks run inside `nis_security.admin_session_ready()`, which every admin RLS policy and
`has_admin_permission()` already call, so a closed laptop, an old tab or a second device cannot
read or change data even if the browser is tampered with. `get_my_admin_access()` returns
`session_status` (ok, idle, replaced, expired, revoked, ended, missing); the login page explains it.

## Activity log (`public.admin_activity`)
- Sign-ins (first heartbeat of a session), sign-outs and every automatic sign-out with the reason.
- Pages opened (path and module).
- Campaign record changes by database triggers: households, camps, venues, vendors, targets
  (added / changed fields / deleted).
- Exports, village and vendor imports, vendor assignments (reported by the browser).
- Readable only with Security → View; nobody can insert, edit or delete rows directly.
Other modules' data changes stay in the existing Audit Logs.

## Campaign roles
- Surya Ghar Campaign Manager: Campaigns all actions; Dashboard, Search, Notifications view; Reports view + export.
- Surya Ghar Field Executive: Campaigns view, add, edit; Dashboard, Search, Notifications view.
Campaign → Team & rights lists everyone with campaign access and lets the owner change roles.
