import axios from 'axios';
import { MEDUSA_BASE_URL, MEDUSA_PUBLISHABLE_KEY, buildBaseHeaders } from '../utils/constants';

const client = axios.create({
  baseURL: MEDUSA_BASE_URL,
  headers: {
    'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY,
  },
});

export async function fetchProducts({ token, query = {}, regionId } = {}) {
  const params = {
    ...query,
  };

  if (regionId) {
    params.region_id = regionId;
  }

  const res = await client.get('/store/products', {
    params,
    headers: buildBaseHeaders(token),
  });

  return res.data.products ?? [];
}

export async function fetchProductCategories(token) {
  const res = await client.get('/store/product-categories', {
    headers: buildBaseHeaders(token),
  });

  const data = res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.product_categories)) return data.product_categories;
  if (Array.isArray(data.categories)) return data.categories;
  if (Array.isArray(data.data)) return data.data;
  return [];
}

export async function fetchRegions(token) {
  const res = await client.get('/store/regions', {
    headers: buildBaseHeaders(token),
  });

  const data = res.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.regions)) return data.regions;
  if (Array.isArray(data.data)) return data.data;
  return [];
}


export async function fetchProductById(id, token, regionId) {
  const params = {};
  if (regionId) {
    params.region_id = regionId;
  }

  const res = await client.get(`/store/products/${id}`, {
    params,
    headers: buildBaseHeaders(token),
  });

  const data = res.data;
  if (data.product) return data.product;
  return data;
}
