# Phase 3 checkpoint — 12 October 2026

Phase 2 backup work remains paused by the owner. Do not make it a prerequisite for Phase 3.

## Implemented locally

- Removed the global mock interaction wrapper, hard-coded admin identity and unused demo components/data files. Existing website-builder sections and saved layouts were not removed.
- Reported Orders now reads real customer claims; review actions require an active Owner/Admin with two-step verification. Existing database eligibility guards still control any claim-related credit.
- Wallet & Payouts and provider CSV reports now use complete recorded ledgers/conversions. Customer cashback and provider commission are separate; currencies are never added together. Failed/partial queries and missing commission amounts show unavailable totals instead of fabricated values.
- Removed demo homepage collections and fake layout status. Offers link to the actual website builder.
- Operational feed controls no longer stage/display mock feeds. Real HTTPS registration does not claim automatic fetching; provider-specific feed adapters are still required. Isolated testing infrastructure and migration history are preserved.
- API Integrations reads saved configurations and provides Owner/Admin-only explicit checks/listing reads through the existing Cuelinks connector. No automatic catalogue imports or publication.
- APITxT SMS sender is deployed in Supabase; the Send SMS HTTPS hook is configured but disabled. The owner confirmed the endpoint and matching hook secret. The customer phone request/verification UI is implemented locally behind the `PHONE_OTP_ENABLED` server flag, which defaults off. No real SMS has been sent. SMS setup is in `docs/integrations/apitxt-sms.md`.

## Not yet complete

- Customer email sign-in/sign-up/password reset, admin sign-in, and the gated India-phone OTP request use Glonni's signed arithmetic challenge. Native Supabase CAPTCHA is intentionally deferred; the math check is a lightweight early-stage speed bump, not protection against direct Auth API calls. Supabase's OTP/magic-link verification rate is set to 10 per 5 minutes per IP. The project SMS sending cap is 30/hour and is currently non-editable on this Free plan. Phone sign-in and the Send SMS hook remain disabled; no real SMS has been sent.
- The math challenge requires the server-only `GLONNI_CAPTCHA_SECRET` in the production environment. No provider CAPTCHA keys or Supabase CAPTCHA toggle are needed for this decision. No database records were deleted.
- Phone OTP stays off until the owner approves a paid one-phone test; no further CAPTCHA setup is needed for the current build. When approved, confirm APITxT default vs approved template, then enable the SMS hook and `PHONE_OTP_ENABLED` only for the controlled test.
- Affiliate live tests/import mapping, other providers, transactional email, payments/payout sandbox and remaining launch integrations still need their own credentials and verification. Stored AI connection status is not evidence of live API health.
- Public seed catalogue remains inactive; do not republish it as real inventory. Any physical seed cleanup requires exact-target review before deletion.
- Dependency audit reported existing warnings in Next.js 15.5.24, PostCSS, sharp and source-map-js. A separate verified dependency update is required before public launch; no forced updates were performed here.

## Verification

Website production build and all automated tests pass. New tests cover complete pagination, partial-query failures, commission currency/approval/missing values, safe CSV export, provider response sanitization, OTP signature forgery/tampering/expiry and provider failures. All provider calls in tests are stubs; they do not send SMS or use credits.

Next owner action: none for CAPTCHA or the current 30/hour SMS cap. To activate phone login later, approve one paid test SMS and confirm the APITxT template choice first; until then, leave the phone feature and Send SMS hook disabled.
