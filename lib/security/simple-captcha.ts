import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

type Payload = { expiresAt: number; nonce: string };
const key = () => process.env.GLONNI_CAPTCHA_SECRET;
const encode = (value: string) => Buffer.from(value).toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');
const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function createSimpleCaptcha() {
  const secret = key();
  if (!secret) return null;
  const first = Math.floor(Math.random() * 8) + 2;
  const second = Math.floor(Math.random() * 8) + 2;
  const answer = first + second;
  const payload: Payload = { expiresAt: Date.now() + 300_000, nonce: randomUUID() };
  const encoded = encode(JSON.stringify(payload));
  return { question: `What is ${first} + ${second}?`, token: `${encoded}.${sign(`${encoded}.${answer}`, secret)}` };
}

export function verifySimpleCaptcha(token: string, answer: string) {
  const secret = key();
  if (!secret || !token || !/^[0-9]{1,3}$/.test(answer)) return false;
  const [encoded, supplied] = token.split('.');
  if (!encoded || !supplied) return false;
  const expected = sign(`${encoded}.${answer}`, secret);
  if (expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return false;
  try { const payload = JSON.parse(decode(encoded)) as Payload; return payload.expiresAt > Date.now() && typeof payload.nonce === 'string'; } catch { return false; }
}
