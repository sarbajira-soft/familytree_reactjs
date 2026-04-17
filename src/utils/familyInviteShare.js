export function normalizeInviteBaseUrl(rawBaseUrl = import.meta.env.VITE_BASE_URL || globalThis?.location?.origin || '') {
  const normalized = String(rawBaseUrl || '').trim();
  if (!normalized) {
    throw new Error('Base URL is not configured');
  }

  const withProtocol = /^https?:\/\//i.test(normalized)
    ? normalized
    : `https://${normalized}`;

  return withProtocol.replace(/\/$/, '');
}

export function buildFamilySignupLink(familyCode, rawBaseUrl) {
  const normalizedFamilyCode = String(familyCode || '').trim().toUpperCase();
  if (!normalizedFamilyCode) {
    throw new Error('Family code is required');
  }

  const baseUrl = normalizeInviteBaseUrl(rawBaseUrl);
  return `${baseUrl}/register?familyCode=${encodeURIComponent(normalizedFamilyCode)}`;
}

export function buildFamilyInviteMessage(familyCode, signUpLink) {
  const normalizedFamilyCode = String(familyCode || '').trim().toUpperCase();
  if (!normalizedFamilyCode) {
    throw new Error('Family code is required');
  }

  return [
    'Join our family on the app!',
    `Family Code: ${normalizedFamilyCode}`,
    `Sign up here: ${signUpLink}`,
  ].join('\n');
}

export function getFamilyInviteContent(familyCode, rawBaseUrl) {
  const signUpLink = buildFamilySignupLink(familyCode, rawBaseUrl);
  return {
    familyCode: String(familyCode || '').trim().toUpperCase(),
    signUpLink,
    message: buildFamilyInviteMessage(familyCode, signUpLink),
  };
}

export async function copyFamilyInvite(familyCode, options = {}) {
  const { message, signUpLink } = getFamilyInviteContent(familyCode, options.baseUrl);
  if (!navigator?.clipboard?.writeText) {
    throw new Error('Clipboard sharing is not available on this device.');
  }

  await navigator.clipboard.writeText(message);
  return { method: 'copy', message, signUpLink };
}

export async function shareFamilyInvite(familyCode, options = {}) {
  const { title = 'Join our family on the app!', baseUrl } = options;
  const { familyCode: normalizedFamilyCode, message, signUpLink } = getFamilyInviteContent(familyCode, baseUrl);

  if (navigator?.share) {
    await navigator.share({
      title,
      text: `Join our family on the app!\nFamily Code: ${normalizedFamilyCode}`,
      url: signUpLink,
    });
    return { method: 'native', message, signUpLink };
  }

  return await copyFamilyInvite(normalizedFamilyCode, { baseUrl });
}
