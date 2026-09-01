import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

type Payload = { answer: number; expiresAt: number; nonce: string };
const key = () => process.env.GLONNI_CAPTCHA_SECRET;
const encode = (value: string) => Buffer.from(value).toString('base64url');
const decode = (value: string) => Buffer.from(value, 'base64url').toString('utf8');
const sign = (value: string, secret: string) => createHmac('sha256', secret).update(value).digest('base64url');

export function createSimpleCaptcha() {
  const secret = key();
  if (!secret) return null;
  const first = Math.floor(Math.random() * 8) + 2;
  const second = Math.floor(Math.random() * 8) + 2;
  const payload: Payload = { answer: first + second, expiresAt: Date.now() + 300_000, nonce: randomUUID() };
  const encoded = encode(JSON.stringify(payload));
  return { question: `What is ${first} + ${second}?`, token: `${encoded}.${sign(encoded, secret)}` };
}

export function verifySimpleCaptcha(token: string, answer: string) {
  const secret = key();
  if (!secret || !token || !/^[0-9]{1,3}$/.test(answer)) return false;
  const [encoded, supplied] = token.split('.');
  if (!encoded || !supplied) return false;
  const expected = sign(encoded, secret);
  if (expected.length !== supplied.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) return false;
  try { const payload = JSON.parse(decode(encoded)) as Payload; return Number.isInteger(payload.answer) && payload.expiresAt > Date.now() && Number(answer) === payload.answer; } catch { return false; }
}
