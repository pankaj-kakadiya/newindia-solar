// Admin session rules shared by the session watcher, the login page and tests.

export const ACTIVE_KEY = 'nis-admin-last-active'
export const WARN_SECONDS = 60

/** Idle state for a person last active at `lastActive`: warn in the final minute, expire at the timeout. */
export function idleState(lastActive: number, now: number, idleMinutes: number) {
  const left = Math.ceil((lastActive + idleMinutes * 60_000 - now) / 1000)
  if (left <= 0) return { expired: true as const, warnSeconds: null }
  return { expired: false as const, warnSeconds: left <= WARN_SECONDS ? left : null }
}

/** What the login page says after a session ended, by reason (from the database or the idle timer). */
export function sessionEndMessage(reason: string | null | undefined, seconds?: number | null) {
  switch (reason) {
    case 'idle-soon': return `For your security you will be signed out in ${seconds ?? WARN_SECONDS} seconds because there has been no activity.`
    case 'idle': return 'You were signed out after a period of inactivity. Please sign in again.'
    case 'replaced': return 'You were signed out because this account signed in on another device. Only one active session is allowed per person.'
    case 'ended': return 'This session was ended. Please sign in again.'
    case 'expired': return 'Your session reached its maximum length. Please sign in again.'
    case 'revoked': return 'An administrator signed you out of all devices. Please sign in again.'
    case 'logout': return 'You have signed out.'
    case 'missing': return 'Your session expired. Please sign in again.'
    default: return ''
  }
}
