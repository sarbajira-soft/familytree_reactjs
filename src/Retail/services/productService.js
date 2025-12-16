import axios from 'axios';
import { MEDUSA_BASE_URL, MEDUSA_PUBLISHABLE_KEY, buildBaseHeaders } from '../utils/constants';

const client = axios.create({
  baseURL: MEDUSA_BASE_URL,
  headers: {
    'x-publishable-api-key': MEDUSA_PUBLISHABLE_KEY,
  },
});

export async function fetchProducts({ token, query = {} } = {}) {
  const params = {
    region_id: "reg_01KC610QJEMH4WVG3WV68TEWW6", // 👈 REQUIRED
    ...query,
  };

  const res = await client.get('/store/products', {
    params,
    headers: buildBaseHeaders(token),
  });

  return res.data.products ?? [];
}


export async function fetchProductById(id, token) {
  const res = await client.get(`/store/products/${id}`, {
    headers: buildBaseHeaders(token),
  });

  const data = res.data;
  if (data.product) return data.product;
  return data;
}
