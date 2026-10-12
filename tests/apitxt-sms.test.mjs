import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Webhook } from 'standardwebhooks';
import { createSmsHook, smsFromVerifiedPayload } from '../supabase/functions/apitxt-send-sms/handler.ts';
import { createHookVerifier } from '../supabase/functions/apitxt-send-sms/verification.ts';

const secret = randomBytes(32).toString('base64');
const signer = new Webhook(secret);
const payload = { user: { phone: '+919999999999' }, sms: { otp: '001234' } };
const config = { enabled: true, authKey: 'test-only-not-a-real-key', templateId: '42' };
const signedRequest = (value = payload, timestamp = new Date()) => {
  const body = JSON.stringify(value), id = 'test-hook';
  return new Request('https://project.invalid/functions/v1/apitxt-send-sms', { method: 'POST', body, headers: {
    'Content-Type': 'application/json', 'webhook-id': id,
    'webhook-timestamp': String(Math.floor(timestamp.getTime() / 1000)),
    'webhook-signature': signer.sign(id, timestamp, body),
  } });
};
const create = (send, override = {}) => createSmsHook({ ...config, ...override }, { verify: createHookVerifier(`v1,whsec_${secret}`), fetch: send });
const neverSend = () => { throw new Error('The provider must not be called'); };

test('APITxT receives a POST form with the Supabase code and an explicit approved template', async () => {
  let calls = 0;
  const hook = create(async (url, options) => {
    calls++;
    assert.equal(url, 'https://apitxt.com/api/sendOTP');
    assert.ok(!url.includes(config.authKey));
    assert.equal(options.method, 'POST');
    assert.equal(options.redirect, 'error');
    assert.equal(options.headers['Content-Type'], 'application/x-www-form-urlencoded');
    const form = new URLSearchParams(options.body);
    assert.equal(form.get('mobile'), '919999999999');
    assert.equal(form.get('otp'), '001234');
    assert.equal(form.get('authkey'), config.authKey);
    assert.equal(form.get('channel'), 'sms');
    assert.equal(form.get('template_id'), '42');
    return Response.json({ status: 'success', data: { private: 'provider-only' } });
  });
  const response = await hook(signedRequest());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {});
  assert.equal(calls, 1);
});
test('disabled or incomplete SMS configuration cannot spend credits', async () => {
  for (const config of [{ enabled: false }, { authKey: '' }, { templateId: 'DLT-not-an-internal-id' }]) {
    const response = await create(neverSend, config)(signedRequest());
    assert.equal(response.status, 500);
  }
});
test('the documented provider default is supported when no custom template is selected', async () => {
  const response = await create(async (_url, options) => {
    const form = new URLSearchParams(options.body);
    assert.equal(form.has('template_id'), false);
    return Response.json({ status: 'success' });
  }, { templateId: '' })(signedRequest());
  assert.equal(response.status, 200);
});
test('unsigned and forged hook requests never reach APITxT', async () => {
  const unsigned = new Request('https://project.invalid', { method: 'POST', body: JSON.stringify(payload) });
  assert.equal((await create(neverSend)(unsigned)).status, 401);
  const forged = signedRequest();
  forged.headers.set('webhook-signature', 'v1,forged');
  assert.equal((await create(neverSend)(forged)).status, 401);
});
test('tampered signed payloads never reach APITxT', async () => {
  const valid = signedRequest();
  const tampered = new Request(valid.url, { method: 'POST', headers: valid.headers, body: JSON.stringify({ ...payload, sms: { otp: '654321' } }) });
  assert.equal((await create(neverSend)(tampered)).status, 401);
});
test('stale and far-future signatures are rejected', async () => {
  for (const offset of [-360_000, 360_000]) assert.equal((await create(neverSend)(signedRequest(payload, new Date(Date.now() + offset)))).status, 401);
});
test('signing secrets can rotate without accepting unknown keys', () => {
  const other = randomBytes(32).toString('base64');
  const request = signedRequest(), headers = Object.fromEntries(request.headers);
  const body = JSON.stringify(payload);
  assert.deepEqual(createHookVerifier(`v1,whsec_${other}|v1,whsec_${secret}`)(body, headers), payload);
  assert.throws(() => createHookVerifier(`v1,whsec_${other}`)(body, headers));
  assert.throws(() => createHookVerifier('')(body, headers));
});
test('unsupported destinations, malformed codes and phone-change flows cannot send', async () => {
  for (const value of [
    { user: { phone: '+14155551234' }, sms: { otp: '123456' } },
    { user: { phone: '+919999999999' }, sms: { otp: 123456 } },
    { user: { phone: '+919999999999' }, sms: { otp: '123' } },
    { user: { phone: '+919999999999', phone_change: '+918888888888' }, sms: { otp: '123456' } },
    { user: { phone: 'https://bad.invalid' }, sms: { otp: '123456' } },
  ]) assert.equal((await create(neverSend)(signedRequest(value))).status, 400);
  assert.equal(smsFromVerifiedPayload(null), null);
});
test('a provider HTTP failure or status error never becomes successful delivery', async () => {
  for (const send of [
    async () => Response.json({ status: 'success' }, { status: 401 }),
    async () => Response.json({ status: 'error', message: config.authKey }),
    async () => new Response('not JSON'),
    async () => Response.json({ message: 'missing status' }),
  ]) {
    const response = await create(send)(signedRequest());
    assert.equal(response.status, 500);
    assert.ok(!(await response.text()).includes(config.authKey));
  }
});
test('network failures are sanitized and not automatically retried', async () => {
  let calls = 0;
  const response = await create(async () => { calls++; throw new Error(config.authKey); })(signedRequest());
  assert.equal(response.status, 500);
  assert.equal(calls, 1);
  assert.ok(!(await response.text()).includes(config.authKey));
});
test('oversized requests/responses and other methods fail closed', async () => {
  assert.equal((await create(neverSend)(new Request('https://project.invalid', { method: 'GET' }))).status, 405);
  assert.equal((await create(neverSend)(new Request('https://project.invalid', { method: 'POST', body: 'x'.repeat(21000) }))).status, 400);
  const response = await create(async () => new Response('x'.repeat(17000)))(signedRequest());
  assert.equal(response.status, 500);
});
