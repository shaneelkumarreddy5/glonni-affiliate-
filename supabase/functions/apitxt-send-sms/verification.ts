import { Webhook } from 'standardwebhooks';

export function createHookVerifier(secretList: string) {
  const verifiers = secretList.split('|').filter(Boolean).map(secret => new Webhook(secret.replace(/^v1,whsec_/, '')));
  return (body: string, headers: Record<string, string>): unknown => {
    for (const verifier of verifiers) {
      try { return verifier.verify(body, headers); } catch { /* Try an explicitly configured rotation key. */ }
    }
    throw new Error('Invalid hook signature');
  };
}
