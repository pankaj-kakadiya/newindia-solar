# New India Solar — Controlled Deployment Workflow

## Goal

Prevent Vercel build-rate-limit issues by stopping automatic Git-triggered deployments and allowing only one controlled staging deployment after a development step is complete.

## Environment model

- **Development:** GitHub `main` remains the source of truth. Intermediate commits do not deploy automatically.
- **Staging:** Vercel is used only for controlled QA deployments after a complete step/release is ready.
- **Production:** Hostinger remains the production target after staging QA and production-readiness approval.

## Automatic Vercel Git deployments

Automatic Git deployments are disabled in `vercel.json`:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": {
    "deploymentEnabled": false
  }
}
```

Do not remove this setting unless the deployment strategy is intentionally changed.

## Required development flow

For every major step:

1. Develop the complete step.
2. Make as many Git commits as required while working.
3. Do **not** trigger Vercel for intermediate commits.
4. Run a production build check locally or in an isolated build environment.
5. Fix all build/type errors before deployment.
6. Create/finalize the step's release commit.
7. Trigger **one** Vercel staging deployment.
8. Run staging smoke tests and responsive QA.
9. Record the deployed commit SHA in the step completion note.
10. Begin the next step only after the staging release is verified, unless the build-rate limit temporarily prevents deployment.

## Staging release command

When Vercel CLI is authenticated locally, the intended flow is:

```bash
npm run build
npx vercel@latest deploy --yes
```

A deployment may also be triggered manually from the Vercel dashboard/API after the build check passes.

## Production release flow

Production deployment is separate from staging:

```text
GitHub source
   ↓
Controlled Vercel staging release
   ↓
QA / smoke test / readiness approval
   ↓
Hostinger production release
   ↓
Production smoke test + monitoring
```

Never point the production domain at a staging deployment merely because a build completed.

## Release rules

- One Vercel deployment per completed major development step by default.
- Intermediate bug-fix commits are grouped into the same step before staging deployment.
- Emergency fixes may trigger an additional staging build when required.
- Keep Vercel build cache enabled.
- Do not create repeated deployments just to inspect code changes; use local/source review first.
- The deployed commit SHA must be recorded in the final step summary.
- Production changes require the existing readiness/cutover checks.

## Build-rate-limit recovery

If Vercel reports a build-rate limit:

1. Stop triggering additional deployments.
2. Continue source work in GitHub if safe.
3. Do not retry repeatedly.
4. Wait for the Vercel window to clear.
5. Deploy only the latest completed release commit.
6. Skip all superseded commits/builds.

This avoids turning one temporary limit into a longer deployment queue.
