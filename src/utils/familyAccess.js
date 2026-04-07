const FAMILY_ACCESS_STATUSES = ['approved', 'associated'];

export const normalizeFamilyMembershipStatus = (value) =>
  String(value || '').trim().toLowerCase();

export const hasFamilyAccessStatus = (status) =>
  FAMILY_ACCESS_STATUSES.includes(normalizeFamilyMembershipStatus(status));

export const hasFamilyAccess = (userInfo) =>
  Boolean(String(userInfo?.familyCode || '').trim()) &&
  hasFamilyAccessStatus(userInfo?.approveStatus);