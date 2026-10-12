import { createSmsHook } from './handler.ts';
import { createHookVerifier } from './verification.ts';

const secret = Deno.env.get('SEND_SMS_HOOK_SECRET') ?? '';

Deno.serve(createSmsHook({
  enabled: Deno.env.get('APITXT_SMS_ENABLED') === 'true' && Boolean(secret),
  authKey: Deno.env.get('APITXT_AUTH_KEY') ?? '',
  templateId: Deno.env.get('APITXT_SMS_TEMPLATE_ID') ?? '',
}, {
  verify: createHookVerifier(secret),
  fetch,
}));
