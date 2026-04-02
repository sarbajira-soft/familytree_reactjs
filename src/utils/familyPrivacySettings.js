import { authFetch } from './authFetch';

const STORAGE_KEY_PREFIX = 'familyss.privacy.settings.v1';

const UI_VISIBILITY = {
  ALL_MEMBERS: 'all-members',
  SPECIFIC_FAMILIES: 'specific-family',
};

const API_VISIBILITY = {
  'all-members': 'ALL_MEMBERS',
  'specific-family': 'SPECIFIC_FAMILIES',
};

const normalizeFamilyCode = (code) => String(code || '').trim().toUpperCase();

const getStorageKey = (userId) =>
  `${STORAGE_KEY_PREFIX}:${String(userId || 'guest').trim()}`;

const withPrimaryFamilyCode = (setting = {}) => ({
  visibility: setting.visibility || 'all-members',
  familyCodes: Array.isArray(setting.familyCodes) ? setting.familyCodes : [],
  familyCode:
    Array.isArray(setting.familyCodes) && setting.familyCodes.length > 0
      ? setting.familyCodes[0]
      : '',
});

const normalizeCodes = (codes, fallbackCodes = []) => {
  const normalized = Array.isArray(codes)
    ? codes.filter(Boolean).map(normalizeFamilyCode)
    : typeof codes === 'string' && codes.trim()
      ? [normalizeFamilyCode(codes)]
      : [];

  const deduped = Array.from(new Set(normalized.filter(Boolean)));
  return deduped.length > 0 ? deduped : fallbackCodes;
};

const normalizeVisibility = (value) => {
  const normalized = String(value || '').trim().toUpperCase();

  if (
    normalized === 'SPECIFIC_FAMILIES' ||
    normalized === 'SPECIFIC_FAMILY' ||
    normalized === 'SPECIFIC-FAMILY' ||
    normalized === 'SPECIFIC-FAMILIES' ||
    value === 'specific-family'
  ) {
    return 'specific-family';
  }

  return 'all-members';
};

const normalizeUiSetting = (setting, fallback) => {
  const visibility = normalizeVisibility(setting?.visibility);
  const inputCodes = Array.isArray(setting?.familyCodes)
    ? setting.familyCodes
    : setting?.familyCode;

  const familyCodes = visibility === UI_VISIBILITY.SPECIFIC_FAMILIES
    ? normalizeCodes(inputCodes, [])
    : normalizeCodes(inputCodes, fallback.familyCodes);

  return withPrimaryFamilyCode({
    visibility,
    familyCodes,
  });
};

const buildNormalizedSettings = (value, familyCode = '') => {
  const defaults = buildDefaultFamilyPrivacySettings(familyCode);
  const source = value && typeof value === 'object' ? value : {};

  return {
    ...defaults,
    posts: normalizeUiSetting(source.posts, defaults.posts),
    albums: normalizeUiSetting(source.albums, defaults.albums),
    events: normalizeUiSetting(source.events, defaults.events),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
    version: 2,
  };
};

const persistSettings = ({ userId, settings }) => {
  const next = buildNormalizedSettings(
    settings,
    settings?.posts?.familyCode || settings?.posts?.familyCodes?.[0] || '',
  );

  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(next));
  }

  return next;
};

const toApiPayload = (settings) => ({
  posts: {
    visibility: API_VISIBILITY[settings?.posts?.visibility] || 'ALL_MEMBERS',
    familyCodes: normalizeCodes(settings?.posts?.familyCodes, []),
  },
  albums: {
    visibility: API_VISIBILITY[settings?.albums?.visibility] || 'ALL_MEMBERS',
    familyCodes: normalizeCodes(settings?.albums?.familyCodes, []),
  },
  events: {
    visibility: API_VISIBILITY[settings?.events?.visibility] || 'ALL_MEMBERS',
    familyCodes: normalizeCodes(settings?.events?.familyCodes, []),
  },
});

const areSettingSectionsEqual = (left, right) => {
  try {
    return JSON.stringify(toApiPayload(left)) === JSON.stringify(toApiPayload(right));
  } catch (_) {
    return false;
  }
};

export const buildDefaultFamilyPrivacySettings = (familyCode = '') => {
  const normalizedCode = normalizeFamilyCode(familyCode);
  const defaultCodes = normalizedCode ? [normalizedCode] : [];

  return {
    version: 2,
    posts: withPrimaryFamilyCode({
      visibility: 'all-members',
      familyCodes: defaultCodes,
    }),
    albums: withPrimaryFamilyCode({
      visibility: 'all-members',
      familyCodes: defaultCodes,
    }),
    events: withPrimaryFamilyCode({
      visibility: 'all-members',
      familyCodes: defaultCodes,
    }),
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
    return buildNormalizedSettings(parsed, familyCode);
  } catch (_) {
    return defaults;
  }
};

export const fetchFamilyPrivacySettings = async ({ userId, familyCode = '' } = {}) => {
  const cached = getFamilyPrivacySettings({ userId, familyCode });
  if (!userId) {
    return cached;
  }

  try {
    const response = await authFetch('/user/content-privacy-settings', {
      method: 'GET',
    });

    const nextBase = buildNormalizedSettings(response?.data, familyCode);
    const next = {
      ...nextBase,
      updatedAt: areSettingSectionsEqual(cached, nextBase) ? cached.updatedAt || '' : '',
    };

    return persistSettings({ userId, settings: next });
  } catch (_) {
    return cached;
  }
};

export const saveFamilyPrivacySettings = async ({ userId, settings, familyCode = '' } = {}) => {
  const normalizedInput = buildNormalizedSettings(settings, familyCode);
  const response = await authFetch('/user/content-privacy-settings', {
    method: 'PUT',
    body: JSON.stringify(toApiPayload(normalizedInput)),
  });

  const next = {
    ...buildNormalizedSettings(response?.data, familyCode),
    updatedAt: new Date().toISOString(),
  };

  return persistSettings({ userId, settings: next });
};

export const getFamilyPrivacyContentSetting = ({
  userId,
  familyCode = '',
  contentType = 'posts',
} = {}) => {
  const settings = getFamilyPrivacySettings({ userId, familyCode });
  return settings?.[contentType] || buildDefaultFamilyPrivacySettings(familyCode)?.[contentType];
};
