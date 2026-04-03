import { authFetch } from './authFetch';

const STORAGE_KEY_PREFIX = 'familyss.content.visibility.v1';

const DEFAULT_ENTRY = {
  visibility: 'all-members',
  familyCodes: [],
};

const DEFAULT_SETTINGS = {
  posts: { ...DEFAULT_ENTRY },
  albums: { ...DEFAULT_ENTRY },
  events: { ...DEFAULT_ENTRY },
  updatedAt: '',
};

const getStorageKey = (userId) =>
  STORAGE_KEY_PREFIX + ':' + String(userId || 'guest').trim();

const normalizeFamilyCode = (value) => String(value || '').trim().toUpperCase();

const normalizeFamilyCodes = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(new Set(value.map(normalizeFamilyCode).filter(Boolean)));
};

const normalizeEntry = (value) => {
  if (typeof value === 'boolean') {
    return value
      ? { visibility: 'all-members', familyCodes: [] }
      : { visibility: 'specific-family', familyCodes: [] };
  }

  const source = value && typeof value === 'object' ? value : {};
  return {
    visibility: source.visibility === 'specific-family' ? 'specific-family' : 'all-members',
    familyCodes: normalizeFamilyCodes(source.familyCodes),
  };
};

const normalizeSettings = (value) => {
  const source = value && typeof value === 'object' ? value : {};

  return {
    posts: normalizeEntry(source.posts),
    albums: normalizeEntry(source.albums),
    events: normalizeEntry(source.events),
    updatedAt:
      typeof source.updatedAt === 'string' ? source.updatedAt : DEFAULT_SETTINGS.updatedAt,
  };
};

const persistSettings = ({ userId, settings }) => {
  const next = normalizeSettings(settings);

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(next));
  }

  return next;
};

export const buildDefaultFamilyPrivacySettings = () => ({
  ...DEFAULT_SETTINGS,
  posts: { ...DEFAULT_ENTRY },
  albums: { ...DEFAULT_ENTRY },
  events: { ...DEFAULT_ENTRY },
});

export const getFamilyPrivacySettings = ({ userId } = {}) => {
  if (typeof window === 'undefined' || !window.localStorage) {
    return buildDefaultFamilyPrivacySettings();
  }

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return buildDefaultFamilyPrivacySettings();

    return normalizeSettings(JSON.parse(raw));
  } catch (_) {
    return buildDefaultFamilyPrivacySettings();
  }
};

export const fetchFamilyPrivacySettings = async ({ userId } = {}) => {
  const cached = getFamilyPrivacySettings({ userId });
  if (!userId) {
    return cached;
  }

  try {
    const response = await authFetch('/user/content-visibility-settings', {
      method: 'GET',
    });

    return persistSettings({
      userId,
      settings: {
        ...response?.data,
        updatedAt: cached.updatedAt || '',
      },
    });
  } catch (_) {
    return cached;
  }
};

export const saveFamilyPrivacySettings = async ({ userId, settings } = {}) => {
  const normalizedInput = normalizeSettings(settings);
  const response = await authFetch('/user/content-visibility-settings', {
    method: 'PATCH',
    body: JSON.stringify({
      posts: normalizedInput.posts,
      albums: normalizedInput.albums,
      events: normalizedInput.events,
    }),
  });

  return persistSettings({
    userId,
    settings: {
      ...response?.data,
      updatedAt: new Date().toISOString(),
    },
  });
};

export const getFamilyPrivacyContentSetting = ({ userId, contentType = 'posts' } = {}) => {
  const settings = getFamilyPrivacySettings({ userId });
  return settings?.[contentType] || { ...DEFAULT_ENTRY };
};
