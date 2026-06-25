import { authFetch } from '../utils/authFetch';

/**
   Fetch active and published tutorials from the backend.
   Supports searching text query (q) and filtering by contentType.
 */
export const fetchTutorials = async ({ page = 1, limit = 12, q = '', contentType = '', lang = '' } = {}) => {
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (q) qs.set('q', String(q));
  if (lang) qs.set('lang', String(lang));
  if (contentType && contentType !== 'all') {
    qs.set('contentType', String(contentType));
  }
  return authFetch(`/tutorial?${qs.toString()}`);
};

/**
   Fetch a single tutorial by ID with its complete section and subsection contents.
 */
export const fetchTutorialById = async (id, lang = '') => {
  const qs = new URLSearchParams();
  if (lang) qs.set('lang', String(lang));
  const querySuffix = qs.toString() ? `?${qs.toString()}` : '';
  return authFetch(`/tutorial/${id}${querySuffix}`);
};

export const fetchTutorialLanguages = async () => {
  return authFetch('/tutorial/languages');
};

/**
   Fetch the best matching tutorial for any category.
 */
export const fetchWatchTutorial = async (category, lang = '') => {
  const qs = new URLSearchParams();
  if (lang) qs.set('lang', String(lang));
  return authFetch(`/tutorial/watch/${category}?${qs.toString()}`);
};

/**
   Fetch the best matching tutorial for the create-family category.
 */
export const fetchCreateFamilyTutorial = async (lang = '') => {
  return fetchWatchTutorial('create-family', lang);
};
