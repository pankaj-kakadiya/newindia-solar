// Helpers for the Access → Activity & sessions view.

export const EVENT_LABELS: Record<string, string> = {
  login: 'Signed in', logout: 'Signed out', auto_logout: 'Signed out (inactive)', session_replaced: 'Signed out (new device)',
  session_expired: 'Signed out (session too long)', session_revoked: 'Signed out by owner', page_view: 'Opened page',
  create: 'Added', update: 'Changed', delete: 'Deleted', export: 'Exported', import: 'Imported', assign: 'Assigned',
  settings_change: 'Changed settings', force_logout: 'Signed someone out',
  // admin_sessions.end_reason values
  idle: 'inactive', replaced: 'new device', expired: 'session too long', revoked: 'by owner', ended: 'ended',
}

/** online = active in the last 2 minutes; idle = page open but no activity; stale = not heard from in 5 minutes. */
export function sessionState(s: { ended_at?: string | null; last_seen_at?: string | null; last_active_at?: string | null } | null | undefined, now: number) {
  if (!s) return 'never' as const
  if (s.ended_at) return 'ended' as const
  const seen = s.last_seen_at ? Date.parse(s.last_seen_at) : 0
  if (now - seen > 5 * 60_000) return 'stale' as const
  const active = s.last_active_at ? Date.parse(s.last_active_at) : 0
  return now - active <= 2 * 60_000 ? 'online' as const : 'idle' as const
}

/** "Chrome on Mac", "Safari on iPhone" … from a user-agent string. */
export function deviceLabel(ua: string | null | undefined) {
  if (!ua) return 'Unknown device'
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac OS X|Macintosh/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'device'
  const browser = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) && !/Chromium/.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  return `${browser} on ${os}`
}

/** Per-person counts for the selected period, most recent first. */
export function activitySummary(events: { user_id: string | null; user_email?: string | null; user_name?: string | null; event: string; created_at: string }[]) {
  const m = new Map<string, { user_id: string | null; email: string | null; name: string | null; logins: number; pages: number; changes: number; last: string }>()
  for (const e of events) {
    const k = e.user_id || e.user_email || 'unknown'
    const p = m.get(k) || { user_id: e.user_id, email: e.user_email || null, name: e.user_name || null, logins: 0, pages: 0, changes: 0, last: e.created_at }
    if (e.event === 'login') p.logins++
    else if (e.event === 'page_view') p.pages++
    else if (['create', 'update', 'delete', 'import', 'export', 'assign', 'settings_change'].includes(e.event)) p.changes++
    if (e.created_at > p.last) p.last = e.created_at
    m.set(k, p)
  }
  return [...m.values()].sort((a, b) => b.last.localeCompare(a.last))
}
