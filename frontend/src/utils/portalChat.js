/** Build same-origin ws/wss URL so dev proxy and production HTTPS both work. */
export function buildPortalChatWsUrl(memberId, role) {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('graceerp_token');
  if (!token || !memberId) return null;
  const params = new URLSearchParams({
    token,
    memberId: String(memberId),
    role,
  });
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${window.location.host}/ws/portal-chat?${params.toString()}`;
}

/** Camera/mic APIs require a secure context except localhost. Works on http://localhost and https://*. */
export function canUseLiveMedia() {
  if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) return false;
  if (window.isSecureContext) return true;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '[::1]';
}
