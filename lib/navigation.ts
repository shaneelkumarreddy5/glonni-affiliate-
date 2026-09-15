export function safeReturnPath(value: string | undefined, fallback: string) {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  const path = value.split('?')[0];
  return path === '/' || path === '/deals' || path === '/stores' || path === '/account' || path.startsWith('/category/') || path.startsWith('/store/') ? value : fallback;
}

export function safeCustomerReturnPath(value: string | undefined, fallback = '/account') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  const path = value.split('?')[0].split('#')[0];
  const allowed = ['/', '/account', '/wallet', '/saved-deals', '/price-alerts', '/shopping-activity', '/cashback-claim', '/support', '/deals', '/stores'];
  if (allowed.includes(path) || ['/category/', '/store/', '/product/', '/support/'].some((prefix) => path.startsWith(prefix))) return value;
  return fallback;
}
