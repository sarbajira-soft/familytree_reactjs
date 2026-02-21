const STORAGE_KEY_PREFIX = 'familyss.privacy.settings.v1';

const normalizeFamilyCode = (code) => String(code || '').trim().toUpperCase();

const getStorageKey = (userId) =>
  `${STORAGE_KEY_PREFIX}:${String(userId || 'guest').trim()}`;

export const buildDefaultFamilyPrivacySettings = (familyCode = '') => {
  const normalizedCode = normalizeFamilyCode(familyCode);
  return {
    version: 1,
    posts: {
      visibility: 'all-members',
      familyCode: normalizedCode,
    },
    albums: {
      visibility: 'all-members',
      familyCode: normalizedCode,
    },
    events: {
      visibility: 'all-members',
      familyCode: normalizedCode,
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

    const normalizeSetting = (setting, fallback) => ({
      visibility: setting?.visibility === 'specific-family' ? 'specific-family' : 'all-members',
      familyCode: normalizeFamilyCode(setting?.familyCode || fallback.familyCode),
    });

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
  const defaults = buildDefaultFamilyPrivacySettings(settings?.posts?.familyCode || '');
  const next = {
    ...defaults,
    ...settings,
    posts: {
      ...defaults.posts,
      ...(settings?.posts || {}),
      familyCode: normalizeFamilyCode(settings?.posts?.familyCode || defaults.posts.familyCode),
    },
    albums: {
      ...defaults.albums,
      ...(settings?.albums || {}),
      familyCode: normalizeFamilyCode(settings?.albums?.familyCode || defaults.albums.familyCode),
    },
    events: {
      ...defaults.events,
      ...(settings?.events || {}),
      familyCode: normalizeFamilyCode(settings?.events?.familyCode || defaults.events.familyCode),
    },
    updatedAt: new Date().toISOString(),
    version: 1,
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
