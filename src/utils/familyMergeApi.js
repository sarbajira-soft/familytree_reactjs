import { getToken } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_BASE = `${API_BASE_URL}/family-merge`;

function authHeaders() {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(res, defaultErrorMessage) {
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || defaultErrorMessage || 'Request failed');
  }
  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return res.json();
  }
  return null;
}

export async function searchMergeFamilies({ familyCode, adminPhone } = {}) {
  const params = new URLSearchParams();
  if (familyCode) params.append('familyCode', familyCode);
  if (adminPhone) params.append('adminPhone', adminPhone);

  const res = await fetch(`${API_BASE}/search?${params.toString()}`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to search families for merge');
}

export async function createMergeRequest(primaryFamilyCode, secondaryFamilyCode) {
  const res = await fetch(`${API_BASE}/request`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ primaryFamilyCode, secondaryFamilyCode }),
  });
  return handleResponse(res, 'Failed to create merge request');
}

export async function getMergeRequests(status) {
  const params = new URLSearchParams();
  if (status) params.append('status', status);

  const url = params.toString()
    ? `${API_BASE}/requests?${params.toString()}`
    : `${API_BASE}/requests`;

  const res = await fetch(url, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to fetch merge requests');
}

export async function getMergeFamilyAPreview(requestId) {
  const res = await fetch(`${API_BASE}/${requestId}/family-a`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to fetch primary family preview');
}

export async function getMergeFamilyBPreview(requestId) {
  const res = await fetch(`${API_BASE}/${requestId}/family-b`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to fetch secondary family preview');
}

export async function getMergeAnalysis(requestId) {
  const res = await fetch(`${API_BASE}/${requestId}/analysis`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to fetch merge analysis');
}

export async function getMergeState(requestId) {
  const res = await fetch(`${API_BASE}/${requestId}/state`, {
    method: 'GET',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to fetch merge state');
}

export async function saveMergeState(requestId, state) {
  const res = await fetch(`${API_BASE}/${requestId}/state`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(state || {}),
  });
  return handleResponse(res, 'Failed to save merge state');
}

export async function executeMerge(requestId) {
  const res = await fetch(`${API_BASE}/${requestId}/execute`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to execute merge');
}

export async function acceptMergeRequest(requestId) {
  const res = await fetch(`${API_BASE}/${requestId}/accept`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to accept merge request');
}

export async function rejectMergeRequest(requestId) {
  const res = await fetch(`${API_BASE}/${requestId}/reject`, {
    method: 'POST',
    headers: authHeaders(),
  });
  return handleResponse(res, 'Failed to reject merge request');
}
