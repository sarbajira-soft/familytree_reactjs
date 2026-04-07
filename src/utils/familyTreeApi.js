// API utility for family tree CRUD operations

import { authFetch } from './authFetch';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_BASE = `${API_BASE_URL}/family-tree`;
const FAMILY_API_BASE = `${API_BASE_URL}/family`;

export async function fetchFamilyTreeAggregate(familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  return await authFetch(`${FAMILY_API_BASE}/tree/${familyCode}`, {
    method: 'GET',
  });
}

export async function fetchFamilyTree(familyCode) {
  const data = await fetchFamilyTreeAggregate(familyCode);
  return Array.isArray(data?.nodes)
    ? data.nodes
    : Array.isArray(data?.people)
      ? data.people
      : [];
}

export async function addPerson(person, familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  const { memberId, userId, ...rest } = person;
  // Fix types and remove img
  const payload = {
    ...rest,
    familyCode,
    age: person.age ? parseInt(person.age, 10) : undefined,
    parents: Array.isArray(person.parents) ? person.parents : [],
    children: Array.isArray(person.children) ? person.children : [],
    spouses: Array.isArray(person.spouses) ? person.spouses : [],
    siblings: Array.isArray(person.siblings) ? person.siblings : [],
    isDummy: typeof person.isDummy === 'boolean' ? person.isDummy : false,
  };
  delete payload.img;
  return await authFetch(`${API_BASE}/person`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function editPerson(id, person, familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  return await authFetch(`${API_BASE}/person/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ ...person, familyCode }),
  });
}

export async function deletePerson(id, familyCode, nodeUid = '') {
  if (!familyCode) throw new Error('familyCode is required');
  const normalizedNodeUid = String(nodeUid || '').trim();
  const url = normalizedNodeUid
    ? `${FAMILY_API_BASE}/tree/${familyCode}/person/${id}?nodeUid=${encodeURIComponent(normalizedNodeUid)}`
    : `${FAMILY_API_BASE}/tree/${familyCode}/person/${id}`;
  return await authFetch(url, {
    method: 'DELETE',
  });
}

export async function replaceStructuralDummy(id, familyCode, replacementUserId) {
  if (!familyCode) throw new Error('familyCode is required');
  if (!id) throw new Error('id is required');
  if (!replacementUserId) throw new Error('replacementUserId is required');
  return await authFetch(
    `${FAMILY_API_BASE}/tree/${familyCode}/person/${id}/replace/${replacementUserId}`,
    {
      method: 'POST',
    },
  );
}

export async function permanentlyDeleteStructuralDummy(id, familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  if (!id) throw new Error('id is required');
  return await authFetch(`${FAMILY_API_BASE}/tree/${familyCode}/person/${id}/permanent`, {
    method: 'DELETE',
  });
}

export async function saveFamilyTree(people, familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  await authFetch(`${API_BASE}/save`, {
    method: 'POST',
    body: JSON.stringify({ people, familyCode }),
  });
  return true;
}

// Fetch all relationships with multilingual descriptions
export async function fetchRelationships() {
  return await authFetch(`${API_BASE_URL}/relationships`, {
    method: 'GET',
  });
}

// Update a relationship label (and mark as curated)
export async function updateRelationshipLabel(code, description, labels) {
  return await authFetch(`${API_BASE_URL}/relationships/edit/${code}`, {
    method: 'PUT',
    body: JSON.stringify({ description, labels }),
  });
} 

// Fetch associated family prefixes (spouse-connected)
export async function fetchAssociatedFamilyPrefixes(userId) {
  if (!userId) throw new Error('userId is required');
  return await authFetch(`${API_BASE_URL}/family/user/${userId}/associated-prefixes`, {
    method: 'GET',
  });
}

// Fetch all family codes (main + associated) for a user
export async function fetchUserFamilyCodes(userId) {
  return await authFetch(`${API_BASE_URL}/family/user/${userId}/families`, {
    method: 'GET',
  });
}

// Fetch all relationships for a user
export async function fetchUserRelationships(userId) {
  return await authFetch(`${API_BASE_URL}/family/user/${userId}/relationships`, {
    method: 'GET',
  });
}

// Add a spouse relationship
export async function addSpouseRelationship(userId, spouseUserId) {
  // Preserve signature, but route to association request workflow
  return await authFetch(`${API_BASE_URL}/family/request-association`, {
    method: 'POST',
    body: JSON.stringify({ targetUserId: spouseUserId }),
  });
}

// Delete a family member (admin action)
export async function deleteFamilyMember(memberId, familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  if (!memberId) throw new Error('memberId is required');
  const response = await authFetch(`${FAMILY_API_BASE}/member/delete/${memberId}/${familyCode}`, {
    method: 'DELETE',
  });
  return response;
}

// Self-remove from family
export async function selfRemoveFromFamily(familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  const response = await authFetch(`${FAMILY_API_BASE}/member/self/${familyCode}`, {
    method: 'DELETE',
  });
  return response;
}

// Replace dummy user with real user
export async function replaceDummyUser(familyCode, dummyUserId, replacementUserId) {
  if (!familyCode) throw new Error('familyCode is required');
  if (!dummyUserId) throw new Error('dummyUserId is required');
  if (!replacementUserId) throw new Error('replacementUserId is required');
  const response = await authFetch(
    `${FAMILY_API_BASE}/member/${familyCode}/non-app-users/${dummyUserId}/replace/${replacementUserId}`,
    {
      method: 'POST',
    }
  );
  return response;
}

// Get members not in tree
export async function getMembersNotInTree(familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  const response = await authFetch(`${FAMILY_API_BASE}/member/${familyCode}/members-not-in-tree`, {
    method: 'GET',
  });
  return response;
}

// Request account deletion (30-day recovery)
export async function requestAccountDeletion() {
  const response = await authFetch(`${API_BASE_URL}/user/account/delete`, {
    method: 'POST',
    body: JSON.stringify({ confirmText: 'DELETE' }),
  });
  return response;
}

// Request account recovery
export async function requestAccountRecovery(identifier) {
  const response = await authFetch(`${API_BASE_URL}/user/account/recover/request`, {
    method: 'POST',
    body: JSON.stringify({ identifier }),
  });
  return response;
}

// Confirm account recovery
export async function confirmAccountRecovery(token, identifier) {
  const response = await authFetch(`${API_BASE_URL}/user/account/recover/confirm`, {
    method: 'POST',
    body: JSON.stringify({ token, identifier }),
  });
  return response;
}

