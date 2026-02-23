const STORAGE_KEY_PREFIX = 'familyss.privacy.settings.v1';

const normalizeFamilyCode = (code) => String(code || '').trim().toUpperCase();

const getStorageKey = (userId) =>
  `${STORAGE_KEY_PREFIX}:${String(userId || 'guest').trim()}`;

export const buildDefaultFamilyPrivacySettings = (familyCode = '') => {
  const normalizedCode = normalizeFamilyCode(familyCode);
  return {
    version: 2,
    posts: {
      visibility: 'all-members',
      familyCodes: normalizedCode ? [normalizedCode] : [],
    },
    albums: {
      visibility: 'all-members',
      familyCodes: normalizedCode ? [normalizedCode] : [],
    },
    events: {
      visibility: 'all-members',
      familyCodes: normalizedCode ? [normalizedCode] : [],
    },
    updatedAt: '',
  };
};

export const getFamilyPrivacySettings = ({ userId, familyCode = '' } = {}) => {
  const defaults = buildDefaultFamilyPrivacySettings(familyCode);
  if (typeof window === 'undefined' || !window.localStorage) {
    return defaults;
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return defaults;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaults;

    const normalizeSetting = (setting, fallback) => {
      const familyCodes = Array.isArray(setting?.familyCodes) 
        ? setting.familyCodes.filter(Boolean).map(normalizeFamilyCode)
        : setting?.familyCode 
          ? [normalizeFamilyCode(setting.familyCode)]
          : fallback.familyCodes;
      return {
        visibility: setting?.visibility === 'specific-family' ? 'specific-family' : 'all-members',
        familyCodes,
      };
    };

    return {
      ...defaults,
      posts: normalizeSetting(parsed.posts, defaults.posts),
      albums: normalizeSetting(parsed.albums, defaults.albums),
      events: normalizeSetting(parsed.events, defaults.events),
      updatedAt: parsed.updatedAt || '',
    };
  } catch (error) {
    return defaults;
  }
};

export const saveFamilyPrivacySettings = ({ userId, settings } = {}) => {
  const defaults = buildDefaultFamilyPrivacySettings(settings?.posts?.familyCodes?.[0] || '');
  const normalizeCodes = (codes) => Array.isArray(codes) 
    ? codes.filter(Boolean).map(normalizeFamilyCode)
    : defaults.familyCodes;
  const next = {
    ...defaults,
    ...settings,
    posts: {
      ...defaults.posts,
      ...(settings?.posts || {}),
      familyCodes: normalizeCodes(settings?.posts?.familyCodes),
    },
    albums: {
      ...defaults.albums,
      ...(settings?.albums || {}),
      familyCodes: normalizeCodes(settings?.albums?.familyCodes),
    },
    events: {
      ...defaults.events,
      ...(settings?.events || {}),
      familyCodes: normalizeCodes(settings?.events?.familyCodes),
    },
    updatedAt: new Date().toISOString(),
    version: 2,
  };

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(next));
  }

  return next;
};

export const getFamilyPrivacyContentSetting = ({
  userId,
  familyCode = '',
  contentType = 'posts',
} = {}) => {
  const settings = getFamilyPrivacySettings({ userId, familyCode });
  return settings?.[contentType] || buildDefaultFamilyPrivacySettings(familyCode)?.[contentType];
};
