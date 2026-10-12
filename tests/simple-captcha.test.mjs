import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createSimpleCaptcha, verifySimpleCaptcha } from '../lib/security/simple-captcha.ts';

const secret = 'test-only-math-captcha-secret';
process.env.GLONNI_CAPTCHA_SECRET = secret;

test('signed arithmetic challenge accepts the correct answer', () => {
  const challenge = createSimpleCaptcha();
  assert.ok(challenge);
  const match = challenge.question.match(/^What is (\d+) \+ (\d+)\?$/);
  assert.ok(match);
  assert.equal(verifySimpleCaptcha(challenge.token, String(Number(match[1]) + Number(match[2]))), true);
});

test('signed arithmetic challenge rejects wrong answers and altered tokens', () => {
  const challenge = createSimpleCaptcha();
  assert.ok(challenge);
  assert.equal(verifySimpleCaptcha(challenge.token, '0'), false);
  const altered = `${challenge.token.slice(0, -1)}${challenge.token.endsWith('a') ? 'b' : 'a'}`;
  assert.equal(verifySimpleCaptcha(altered, '10'), false);
});

test('signed arithmetic challenge rejects expired tokens', () => {
  const encoded = Buffer.from(JSON.stringify({ expiresAt: Date.now() - 1, nonce: 'test' })).toString('base64url');
  const answer = '4';
  const signature = createHmac('sha256', secret).update(`${encoded}.${answer}`).digest('base64url');
  assert.equal(verifySimpleCaptcha(`${encoded}.${signature}`, answer), false);
});

test('challenge verification fails closed when its server secret is missing', () => {
  const saved = process.env.GLONNI_CAPTCHA_SECRET;
  delete process.env.GLONNI_CAPTCHA_SECRET;
  assert.equal(createSimpleCaptcha(), null);
  assert.equal(verifySimpleCaptcha('token', '4'), false);
  process.env.GLONNI_CAPTCHA_SECRET = saved;
});
