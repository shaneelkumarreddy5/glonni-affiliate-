'use client';

import { useState } from 'react';

export function CategoryArtwork({ name, imageUrl }: { name: string; imageUrl?: string | null }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const usableUrl = imageUrl?.trim();

  return usableUrl && failedUrl !== usableUrl
    ? <img src={usableUrl} alt="" loading="lazy" onError={() => setFailedUrl(usableUrl)}/>
    : <>{name.trim().slice(0, 1).toUpperCase() || '•'}</>;
}
