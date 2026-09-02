export function safeReturnPath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  const path = value.split('?')[0];
  return path === '/' || path === '/deals' || path === '/stores' || path === '/account' || path.startsWith('/category/') || path.startsWith('/store/') ? value : fallback;
}
