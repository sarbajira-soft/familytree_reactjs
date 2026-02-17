// API utility for family tree CRUD operations

import { authFetch } from './authFetch';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const API_BASE = `${API_BASE_URL}/family-tree`;

export async function fetchFamilyTree(familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  const data = await authFetch(`${API_BASE}?familyCode=${familyCode}`, {
    method: 'GET',
  });
  return data.people;
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

export async function deletePerson(id, familyCode) {
  if (!familyCode) throw new Error('familyCode is required');
  await authFetch(`${API_BASE}/person/${id}`, {
    method: 'DELETE',
  });
  return true;
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