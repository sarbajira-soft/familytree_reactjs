import { authFetch } from '../utils/authFetch';

/**
   Fetch active and published tutorials from the backend.
   Supports searching text query (q) and filtering by contentType.
 */
export const fetchTutorials = async ({ page = 1, limit = 12, q = '', contentType = '' } = {}) => {
  const qs = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (q) qs.set('q', String(q));
  if (contentType && contentType !== 'all') {
    qs.set('contentType', String(contentType));
  }
  return authFetch(`/tutorial?${qs.toString()}`);
};

/**
   Fetch a single tutorial by ID with its complete section and subsection contents.
 */
export const fetchTutorialById = async (id) => {
  return authFetch(`/tutorial/${id}`);
};
