'use client';

import Script from 'next/script';
import { useCallback, useEffect, useRef, useState } from 'react';

type HCaptchaWidget = string | number;
type HCaptchaApi = {
  render: (container: HTMLElement, options: {
    sitekey: string;
    callback: (token: string) => void;
    'expired-callback': () => void;
    'error-callback': () => void;
  }) => HCaptchaWidget;
  reset: (widget?: HCaptchaWidget) => void;
  remove: (widget?: HCaptchaWidget) => void;
};

declare global {
  interface Window {
    hcaptcha?: HCaptchaApi;
  }
}

type Props = { onTokenChange?: (token: string) => void };

const siteKey = process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY ?? '';

export function SupabaseAuthCaptcha({ onTokenChange }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetRef = useRef<HCaptchaWidget | null>(null);
  const [error, setError] = useState('');
  const [token, setToken] = useState('');

  const clearToken = useCallback(() => {
    setToken('');
    onTokenChange?.('');
  }, [onTokenChange]);

  const mountWidget = useCallback(() => {
    const container = containerRef.current;
    if (!siteKey || !container || !window.hcaptcha || widgetRef.current !== null) return;

    try {
      widgetRef.current = window.hcaptcha.render(container, {
        sitekey: siteKey,
        callback: token => {
          setError('');
          setToken(token);
          onTokenChange?.(token);
        },
        'expired-callback': clearToken,
        'error-callback': () => {
          clearToken();
          setError('The security check could not load. Refresh the page and try again.');
        },
      });
    } catch {
      setError('The security check could not load. Refresh the page and try again.');
    }
  }, [clearToken, onTokenChange]);

  useEffect(() => () => {
    if (widgetRef.current !== null) window.hcaptcha?.remove(widgetRef.current);
    widgetRef.current = null;
  }, []);

  if (!siteKey) return null;

  return <div className="supabase-auth-captcha" aria-label="Security verification">
    <Script
      src="https://js.hcaptcha.com/1/api.js?render=explicit"
      strategy="afterInteractive"
      onReady={mountWidget}
      onError={() => setError('The security check could not load. Refresh the page and try again.')}
    />
    <div ref={containerRef} />
    <input type="hidden" name="supabaseCaptchaToken" value={token} readOnly />
    {error && <p className="auth-notice error" role="alert">{error}</p>}
  </div>;
}
