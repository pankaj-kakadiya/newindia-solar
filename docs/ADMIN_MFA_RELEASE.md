# Admin and staff 2FA release

Applies to all internal departments and custom staff roles. Customer registration
and checkout do not become subject to mandatory authenticator enrollment.

## Journey

- New staff: temporary password → private password → authenticator enrollment if
  required by the administrator → dashboard.
- Previously enrolled staff or owner: password → existing authenticator code →
  required password change, if any → dashboard. Enrollment is enforced even when
  the separate MFA-required policy switch is off.
- Account Security supports an existing-factor challenge, multiple authenticators,
  QR/manual-key setup, cancellation after an interrupted enrollment, and refresh
  after removal. Required accounts must add a replacement before removing their
  last verified authenticator.
- Password changes preserve the verified session. Email recovery also asks for an
  existing authenticator before updating a password.

## Lost-device recovery

Keep a second authenticator on a separate device. Staff who lose all factors must
contact the owner administrator. In Team & Users, the owner verifies their own
authenticator, verifies the employee's identity independently, records a reason,
and sets a new temporary password through Recover staff authenticator. Recovery is
audited, removes the old factors, and requires a new private password and mandatory
authenticator enrollment. Supabase revokes sessions when a verified factor is
deleted. Partial failures remain restricted and must be retried.

The application cannot reset an owner administrator's factors. If the owner loses
all authenticators, an authorized Supabase project operator must verify identity,
reset that user's MFA through the Auth administrator controls, and require fresh
enrollment. Do not use email/password-only recovery to bypass a working second factor.

## Rollout order

1. Merge after regression tests and the production build pass.
2. Deploy this commit through the existing Hostinger release process. GitHub merge
   alone does not prove that Hostinger has deployed it.
3. Confirm Account Security presents "Verify & continue" for an enrolled AAL1
   account and test an authenticator login on that deployment.
4. Apply the reviewed complete_admin_mfa_flow Supabase migration to the newindia
   project. Do not enable database enforcement before the new verification UI is
   deployed; the previous UI has no way to complete an existing-factor challenge.
5. Run the SQL regression in a transaction and roll it back; verify Finance and
   owner access at AAL1/AAL2, profile self-edit protection, and revoked sessions.

The migration does not enroll/remove real factors or change anyone's MFA-required
setting. It adds database enforcement and protects the first-password requirement
with a private fingerprint of the Auth password hash until the password changes.

## Verification

`node --experimental-strip-types --test tests/admin-mfa*.test.mjs tests/admin-password-change.test.mjs`

UI tests execute real component handlers with isolated Auth responses. PostgreSQL
tests execute the release SQL and verify the new-user, enrolled-owner, Finance,
revoked-session, first-password, and RLS cases. These tests do not replace a live
authenticator login on Hostinger after deployment.
