export function normalizePublicPostBaseUrl(
  rawBaseUrl = import.meta.env.VITE_BASE_URL || globalThis?.location?.origin || 'https://familyss.app',
) {
  const normalized = String(rawBaseUrl || '').trim();
  if (!normalized) {
    return 'https://familyss.app';
  }

  const withProtocol = /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;

  return withProtocol.replace(/\/$/, '');
}

export function buildPublicPostShareUrl(shareId, rawBaseUrl) {
  const normalizedShareId = String(shareId || '').trim();
  if (!normalizedShareId) {
    throw new Error('Share link is unavailable');
  }

  return `${normalizePublicPostBaseUrl(rawBaseUrl)}/p/${encodeURIComponent(normalizedShareId)}`;
}

export function buildPublicGalleryShareUrl(shareId, rawBaseUrl) {
  const normalizedShareId = String(shareId || '').trim();
  if (!normalizedShareId) {
    throw new Error('Share link is unavailable');
  }

  return `${normalizePublicPostBaseUrl(rawBaseUrl)}/g/${encodeURIComponent(normalizedShareId)}`;
}

export async function copyTextToClipboard(text) {
  if (!navigator?.clipboard?.writeText) {
    throw new Error('Clipboard access is not available on this device.');
  }

  await navigator.clipboard.writeText(text);
}
