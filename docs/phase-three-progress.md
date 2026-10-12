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

- Native Supabase Auth CAPTCHA support is implemented using hCaptcha across the website's customer and admin auth forms, but the CAPTCHA provider keys are not configured and protection remains disabled. Supabase's OTP/magic-link verification rate is now 10 per 5 minutes per IP. The production project SMS sending cap remains 30/hour and is non-editable in the current Free plan; phone sign-in and the Send SMS hook remain disabled. No real SMS has been sent.
- These website changes are awaiting the owner-provided hCaptcha site/secret setup before CAPTCHA can be enabled safely. No database records were deleted.
- Before activating phone OTP: add the hCaptcha site key to Vercel Production and secret key in Supabase Auth > Attack Protection, deploy, enable and verify CAPTCHA; confirm APITxT default vs approved template; then complete an owner-approved one-phone test before enabling the SMS hook and `PHONE_OTP_ENABLED`.
- Affiliate live tests/import mapping, other providers, transactional email, payments/payout sandbox and remaining launch integrations still need their own credentials and verification. Stored AI connection status is not evidence of live API health.
- Public seed catalogue remains inactive; do not republish it as real inventory. Any physical seed cleanup requires exact-target review before deletion.
- Dependency audit reported existing warnings in Next.js 15.5.24, PostCSS, sharp and source-map-js. A separate verified dependency update is required before public launch; no forced updates were performed here.

## Verification

Website production build and all automated tests pass. New tests cover complete pagination, partial-query failures, commission currency/approval/missing values, safe CSV export, provider response sanitization, OTP signature forgery/tampering/expiry and provider failures. All provider calls in tests are stubs; they do not send SMS or use credits.

Next owner action: create an hCaptcha site for the production domain, save its site key in Vercel and its secret in Supabase (never paste credentials into the conversation or commit them to Git). Then I can verify the CAPTCHA setup and finish deployment safely; an owner-approved SMS test is still required before activating paid sends.
