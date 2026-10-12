type VerifiedSms = { phone: string; otp: string };
type SmsConfig = { enabled: boolean; authKey: string; templateId: string };
type Dependencies = {
  verify: (body: string, headers: Record<string, string>) => unknown;
  fetch: typeof fetch;
};

const endpoint = 'https://apitxt.com/api/sendOTP';
const bodyLimit = 20 * 1024;
const responseLimit = 16 * 1024;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
});
const failure = (status: number, message: string) => json({ error: { http_code: status, message } }, status);
const record = (value: unknown): Record<string, unknown> | null => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

/** The verifier must validate the unmodified body, signature and timestamp before parsing. */
export function smsFromVerifiedPayload(value: unknown): VerifiedSms | null {
  const root = record(value), user = record(root?.user), sms = record(root?.sms);
  const phone = typeof user?.phone === 'string' ? user.phone.replace(/^\+/, '') : '';
  const otp = typeof sms?.otp === 'string' ? sms.otp : '';
  // This adapter is deliberately India SMS-only; no user-controlled channel or URL.
  if (!/^91[6-9]\d{9}$/.test(phone) || !/^\d{6}$/.test(otp)) return null;
  // Phone-change/MFA flows need their own reviewed destination handling.
  if (user?.phone_change) return null;
  return { phone, otp };
}

async function boundedText(stream: ReadableStream<Uint8Array> | null, limit: number): Promise<string> {
  if (!stream) return '';
  const reader = stream.getReader(), chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error('body_too_large'); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
}

export function createSmsHook(config: SmsConfig, dependencies: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method !== 'POST') return failure(405, 'Method not allowed.');
    if (!config.enabled || !config.authKey.trim() || (config.templateId && !/^[1-9]\d{0,11}$/.test(config.templateId))) return failure(500, 'SMS delivery is not configured.');
    if (Number(request.headers.get('content-length') ?? 0) > bodyLimit) return failure(413, 'Request too large.');
    let raw: string;
    try { raw = await boundedText(request.body, bodyLimit); }
    catch { return failure(400, 'Invalid request body.'); }
    let verified: unknown;
    try { verified = dependencies.verify(raw, Object.fromEntries(request.headers)); }
    catch { return failure(401, 'Invalid hook signature.'); }
    const sms = smsFromVerifiedPayload(verified);
    if (!sms) return failure(400, 'Unsupported SMS authentication request.');
    const body = new URLSearchParams({
      authkey: config.authKey, mobile: sms.phone, otp: sms.otp,
      channel: 'sms', country: '91',
    });
    if (config.templateId) body.set('template_id', config.templateId);
    const controller = new AbortController();
    // Supabase HTTP Auth Hooks have a five-second budget. Never auto-retry a billable send.
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const response = await dependencies.fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body, signal: controller.signal, redirect: 'error',
      });
      if (!response.ok) { await response.body?.cancel(); return failure(500, 'SMS provider could not accept the request.'); }
      const result = record(JSON.parse(await boundedText(response.body, responseLimit)));
      if (result?.status !== 'success') return failure(500, 'SMS provider could not accept the request.');
      // Acceptance is not proof of delivery. Supabase alone verifies the code and issues sessions.
      return json({});
    } catch {
      // Do not serialize provider messages, the request body, keys, phone numbers or OTPs.
      return failure(500, 'SMS delivery could not be confirmed. Please request a new code later.');
    } finally { clearTimeout(timeout); }
  };
}
