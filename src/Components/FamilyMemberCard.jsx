import React, { useState, useEffect, useMemo } from 'react';
import PropTypes from 'prop-types';
import { FiTrash2, FiEye, FiLoader, FiShare2, FiSearch } from 'react-icons/fi';
import { FaBirthdayCake, FaPhone, FaHome, FaMale, FaFemale } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { BlockButton } from './block/BlockButton';
import { BlockedBadge } from './block/BlockedBadge';
import { logger } from '../utils/logger';
import { getBlockedUsers } from '../services/block.service';
import {
  buildDefaultFamilyPrivacySettings,
  getFamilyPrivacySettings,
  saveFamilyPrivacySettings,
} from '../utils/familyPrivacySettings';

const roleMapping = {
  1: 'Member',
  2: 'Admin',
  3: 'Superadmin',
};

const relationColors = {
  Member: 'bg-blue-100 text-blue-800',
  Admin: 'bg-purple-100 text-purple-800',
  Superadmin: 'bg-green-100 text-green-800',
};

const PRIVACY_VISIBILITY_OPTIONS = [
  { value: 'all-members', label: 'All Members (Except Blocked)' },
  { value: 'specific-family', label: 'Specific Family' },
];

const FamilyMemberCard = ({ familyCode, token, onViewMember, currentUser }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [familyMembers, setFamilyMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewLoadingStates, setViewLoadingStates] = useState({});
  const [deletedMemberIds, setDeletedMemberIds] = useState(() => new Set());
  const [linkedFamilies, setLinkedFamilies] = useState([]);
  const [selectedAssociatedFamilyCode, setSelectedAssociatedFamilyCode] = useState('');
  const [selectedAssociatedFamilyMembersAll, setSelectedAssociatedFamilyMembersAll] = useState([]);
  const [loadingAssociatedFamily, setLoadingAssociatedFamily] = useState(false);
  const [selectedLinkedFamilyMembersAll, setSelectedLinkedFamilyMembersAll] = useState([]);
  const [loadingLinkedFamily, setLoadingLinkedFamily] = useState(false);
  const [selectedLinkedFamilyCode, setSelectedLinkedFamilyCode] = useState('');
  const [activeTab, setActiveTab] = useState('birth');
  const [membersNotInTree, setMembersNotInTree] = useState([]);
  const [memberIdsInTree, setMemberIdsInTree] = useState(() => new Set());
  const [treeLinkedFamilyMap, setTreeLinkedFamilyMap] = useState({});
  const [treeAllPeople, setTreeAllPeople] = useState([]);
  const [nonAppUsers, setNonAppUsers] = useState([]);
  const [loadingNonAppUsers, setLoadingNonAppUsers] = useState(false);
  const [replacementSelections, setReplacementSelections] = useState({});
  const [replacingDummyIds, setReplacingDummyIds] = useState(() => new Set());
  const [selfRemoving, setSelfRemoving] = useState(false);
  const [notInTreeLoading, setNotInTreeLoading] = useState(false);
  const [associatedFamilyNameMap, setAssociatedFamilyNameMap] = useState({});
  const [linkedFamilyNameMap, setLinkedFamilyNameMap] = useState({});
  // BLOCK OVERRIDE: Add state for blocked users from API
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loadingBlocked, setLoadingBlocked] = useState(false);
  const [privacySettings, setPrivacySettings] = useState(() =>
    buildDefaultFamilyPrivacySettings(''),
  );
  const [privacySavedAt, setPrivacySavedAt] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [familyFilterPage, setFamilyFilterPage] = useState(1);
  // Accordion states for Linked tab
  const [linkedAccordionOpen, setLinkedAccordionOpen] = useState({
    inTree: true,
    allLinked: false,
    readyToLink: false,
  });
  // Accordion states for Associated tab
  const [associatedAccordionOpen, setAssociatedAccordionOpen] = useState({
    inTree: true,
    allAssociated: false,
    readyToAssociate: false,
  });
  const itemsPerPage = 10;
  const familiesPerPage = 5;

  // Reset page when tab or filters change
  useEffect(() => {
    setCurrentPage(1);
    setFamilyFilterPage(1);
  }, [activeTab, searchTerm, selectedAssociatedFamilyCode, selectedLinkedFamilyCode]);

  const BASE_URL = import.meta.env.VITE_API_BASE_URL;
  const normalizeFamilyCode = (code) => String(code || '').trim().toUpperCase();
  const birthFamilyCode = normalizeFamilyCode(familyCode);
  const currentUserFamilyCode = currentUser?.userProfile?.familyCode || currentUser?.familyCode;
  const currentUserIsFamilyAdmin =
    (currentUser?.role === 2 || currentUser?.role === 3) &&
    normalizeFamilyCode(currentUserFamilyCode) === normalizeFamilyCode(familyCode);

  const fetchMembers = async () => {
    try {
      const res = await fetch(`${BASE_URL}/family/member/${familyCode}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error('Failed to fetch members');
      const json = await res.json().catch(() => null);
      const list = Array.isArray(json?.data) ? json.data : [];
      const members = list.map((item) => ({
        id: item.id,
        memberId: item.memberId,
        userId: item.user?.id,
        membershipType: item.membershipType || 'member',
        user: item.user, // Preserve user object for isAppUser badge
        name: (item?.user?.fullName && !/\bnull\b|\bundefined\b/i.test(item.user.fullName))
          ? item.user.fullName
            .replaceAll(/\bnull\b|\bundefined\b/gi, '')
            .replaceAll(/\s+/g, ' ')
            .trim()
          : (
            [item?.user?.userProfile?.firstName, item?.user?.userProfile?.lastName]
              .filter(val => val && val !== 'null' && val !== 'undefined')
              .join(' ') || 'Unknown Name'
          ),
        gender: item?.user?.userProfile?.gender || 'N/A',
        role: item.familyRole || roleMapping[item?.user?.role] || 'Member',
        contact: item?.user?.userProfile?.contactNumber,
        address: item?.user?.userProfile?.address || '',
        dob: item?.user?.userProfile?.dob || '',
        age: item?.user?.userProfile?.age || '',
        profilePic: item?.user?.profileImage,
        isAdmin: item.isFamilyAdmin ?? item?.user?.role > 1,
        // BLOCK OVERRIDE: Use new bidirectional block status payload.
        blockStatus: item.blockStatus || {
          isBlockedByMe: false,
          isBlockedByThem: false,
        },
        lastUpdated: item.updatedAt
          ? new Date(item.updatedAt).toLocaleDateString('en-IN')
          : '-',
        sourceFamilyCode: normalizeFamilyCode(item?.user?.userProfile?.familyCode || item?.familyCode),
      }));
      setFamilyMembers(members);
    } catch (err) {
      logger.error('BLOCK OVERRIDE: Failed to load family members', err);
      setFamilyMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchNonAppUsers = async () => {
    if (!familyCode || !token || !currentUserIsFamilyAdmin) {
      setNonAppUsers([]);
      return;
    }

    setLoadingNonAppUsers(true);
    try {
      const res = await fetch(`${BASE_URL}/family/member/${familyCode}/non-app-users`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to fetch non-app users');
      }

      const rows = Array.isArray(json?.data) ? json.data : [];
      setNonAppUsers(rows);
    } catch (error) {
      logger.error('Failed to load non-app users', error);
      setNonAppUsers([]);
    } finally {
      setLoadingNonAppUsers(false);
    }
  };

  const fetchLinkedFamilies = async () => {
    if (!familyCode || !token) return;

    try {
      const res = await fetch(`${BASE_URL}/family/linked-families`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
      });

      if (!res.ok) throw new Error('Failed to load linked families');
      const data = await res.json().catch(() => []);
      const normalized = Array.isArray(data)
        ? data
          .map((entry) => ({
            familyCode: normalizeFamilyCode(entry?.familyCode),
            familyName: entry?.familyName || null,
          }))
          .filter((entry) => Boolean(entry.familyCode))
        : [];
      setLinkedFamilies(normalized);
    } catch (error) {
      logger.error('Failed to load linked families', error);
      setLinkedFamilies([]);
    }
  };

  const fetchFamilyNameByCode = async (code) => {
    try {
      const res = await fetch(`${BASE_URL}/family/code/${encodeURIComponent(code)}`, {
        headers: {
          Accept: 'application/json',
        },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      return data?.familyName || null;
    } catch (error) {
      return null;
    }
  };

  // BLOCK OVERRIDE: Fetch blocked users from API
  const fetchBlockedUsersData = async () => {
    if (!token) return;
    
    setLoadingBlocked(true);
    try {
      const response = await getBlockedUsers();
      const users = response?.data || [];
      console.log('[FamilyMemberCard] Blocked users fetched:', users.length);
      
      // Transform blocked users to match member format
      const formattedBlockedUsers = users.map((item) => ({
        id: `blocked-${item.id}`,
        memberId: null,
        userId: item.blockedUserId,
        membershipType: 'blocked',
        user: item.user,
        name: item.user?.name || 'Unknown User',
        gender: item.user?.userProfile?.gender || 'N/A',
        role: 'Blocked Member',
        contact: item.user?.mobile || item.user?.email || '',
        address: item.user?.userProfile?.address || '',
        dob: item.user?.userProfile?.dob || '',
        age: item.user?.userProfile?.age || '',
        profilePic: item.user?.profilePhoto || null,
        isAdmin: false,
        blockStatus: { isBlockedByMe: true, isBlockedByThem: false },
        sourceFamilyCode: item.user?.familyCode || '',
        blockedDate: item.createdAt,
      }));
      
      setBlockedUsers(formattedBlockedUsers);
    } catch (err) {
      logger.error('[FamilyMemberCard] Failed to load blocked users:', err);
      setBlockedUsers([]);
    } finally {
      setLoadingBlocked(false);
    }
  };

  useEffect(() => {
    if (familyCode && token) {
      setLoading(true);
      fetchMembers();
    }
  }, [familyCode, token]);

  useEffect(() => {
    if (familyCode && token && currentUserIsFamilyAdmin) {
      fetchNonAppUsers();
    } else {
      setNonAppUsers([]);
    }
  }, [familyCode, token, currentUserIsFamilyAdmin]);

  useEffect(() => {
    setReplacementSelections((prev) => {
      const validDummyIds = new Set(nonAppUsers.map((row) => Number(row?.dummyUserId)));
      const next = {};
      Object.keys(prev).forEach((key) => {
        const dummyId = Number(key);
        if (validDummyIds.has(dummyId)) {
          next[dummyId] = prev[key];
        }
      });
      return next;
    });
  }, [nonAppUsers]);

  useEffect(() => {
    if (familyCode && token) {
      fetchLinkedFamilies();
    }
  }, [familyCode, token]);

  // BLOCK OVERRIDE: Fetch blocked users when Blocked tab is active
  useEffect(() => {
    if (activeTab === 'blocked' && token) {
      fetchBlockedUsersData();
    }
  }, [activeTab, token]);

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  };

  const handleViewMember = async (userId, e) => {
    e.stopPropagation();

    // Set loading state for this specific member
    setViewLoadingStates(prev => ({ ...prev, [userId]: true }));

    try {
      await onViewMember(userId);
    } finally {
      // Clear loading state after a short delay to ensure smooth transition
      setTimeout(() => {
        setViewLoadingStates(prev => ({ ...prev, [userId]: false }));
      }, 500);
    }
  };

  const handleDeleteMember = async (memberId, familyCode, userId, e) => {
    if (e?.stopPropagation) e.stopPropagation();

    const inTree = memberIdsInTree.has(Number(userId));

    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete Member?',
      text: inTree
        ? 'This member is in the family tree. Deleting will convert the tree card into a Non-App user.'
        : 'This will remove the member from this family.',
      showCancelButton: true,
      confirmButtonText: 'Yes, remove member',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#e53e3e',
    });

    if (!confirm.isConfirmed) return;

    setDeletedMemberIds((prev) => {
      const next = new Set(prev);
      next.add(memberId);
      return next;
    });

    try {
      const res = await fetch(
        `${BASE_URL}/family/member/delete/${memberId}/${familyCode}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const json = await res.json().catch(() => null);

      if (!res.ok) {
        const msg = json?.message || 'Failed to delete member';
        throw new Error(msg);
      }

      await Swal.fire({
        icon: 'success',
        title: json?.alreadyProcessed ? 'Already Removed' : 'Member Removed',
        text: json?.message || 'Family member removed successfully.',
      });

      await fetchMembers();
      await fetchNonAppUsers();
    } catch (err) {
      logger.error('BLOCK OVERRIDE: Failed to delete member', err);
      await Swal.fire({
        icon: 'error',
        title: 'Delete Failed',
        text: err?.message || 'Unable to delete this member. Please try again.',
      });
    } finally {
      setDeletedMemberIds((prev) => {
        const next = new Set(prev);
        next.delete(memberId);
        return next;
      });
    }
  };

  const handleSelfRemove = async () => {
    if (!familyCode || !token) return;

    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Leave Family?',
      text: 'Type LEAVE to confirm removing yourself from this family tree.',
      input: 'text',
      inputPlaceholder: 'Type LEAVE',
      showCancelButton: true,
      confirmButtonText: 'Leave family',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      preConfirm: (value) => {
        if (String(value || '').trim().toUpperCase() !== 'LEAVE') {
          Swal.showValidationMessage('Type LEAVE exactly to continue.');
          return false;
        }
        return true;
      },
    });
    if (!confirm.isConfirmed) return;

    try {
      setSelfRemoving(true);
      const res = await fetch(`${BASE_URL}/family/member/self/${familyCode}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to leave family');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Removed From Family',
        text: json?.message || 'You were removed from this family successfully.',
      });
      
      // Clear cached user info to force fresh fetch after reload
      try {
        localStorage.removeItem('userInfo');
        sessionStorage.removeItem('userInfo');
      } catch (e) {
        // ignore storage errors
      }
      
      window.location.reload();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Unable to Leave Family',
        text: error?.message || 'Please try again.',
      });
    } finally {
      setSelfRemoving(false);
    }
  };

  const handleReplaceDummy = async (dummyUserId) => {
    const replacementUserId = Number(replacementSelections?.[dummyUserId]);
    if (!Number.isFinite(replacementUserId) || replacementUserId <= 0) {
      await Swal.fire({
        icon: 'warning',
        title: 'Select Replacement',
        text: 'Choose a valid app user to replace this non-app user.',
      });
      return;
    }

    setReplacingDummyIds((prev) => new Set(prev).add(dummyUserId));

    try {
      const res = await fetch(
        `${BASE_URL}/family/member/${familyCode}/non-app-users/${dummyUserId}/replace/${replacementUserId}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        },
      );
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(json?.message || 'Failed to replace dummy user');
      }

      await Swal.fire({
        icon: 'success',
        title: 'Replacement Complete',
        text: json?.message || 'Dummy user replaced successfully.',
      });

      setReplacementSelections((prev) => {
        const next = { ...prev };
        delete next[dummyUserId];
        return next;
      });

      await fetchMembers();
      await fetchNonAppUsers();
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Replacement Failed',
        text: error?.message || 'Unable to replace non-app user.',
      });
    } finally {
      setReplacingDummyIds((prev) => {
        const next = new Set(prev);
        next.delete(dummyUserId);
        return next;
      });
    }
  };

  const handleShareInvite = async (member, e) => {
    e.stopPropagation();

    const inviteUrl = `${window.location.origin}/edit-profile?familyCode=${familyCode}&memberId=${member.memberId}`;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Family Tree Invitation',
          text: 'Update your family tree profile using this secure link.',
          url: inviteUrl,
        });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        await Swal.fire({
          icon: 'success',
          title: 'Invite Link Copied',
          text: 'The profile invite link has been copied to your clipboard. You can share it via WhatsApp or any app.',
        });
      }
    } catch (err) {
      logger.error('BLOCK OVERRIDE: Failed to share invite link', err);
      await Swal.fire({
        icon: 'error',
        title: 'Share Failed',
        text: 'Unable to share the invite link. Please try again.',
      });
    }
  };

  const handleMemberBlockStatusChange = (memberUserId, nextStatus) => {
    // BLOCK OVERRIDE: Apply local optimistic block status updates using new block contract.
    // Update ALL member arrays that might contain this user
    
    // Update main family members
    setFamilyMembers((prevMembers) =>
      prevMembers.map((member) =>
        Number(member.userId) === Number(memberUserId)
          ? { ...member, blockStatus: nextStatus }
          : member,
      ),
    );
    
    // Update selected associated family members
    setSelectedAssociatedFamilyMembersAll((prevMembers) =>
      prevMembers.map((member) =>
        Number(member.userId) === Number(memberUserId)
          ? { ...member, blockStatus: nextStatus }
          : member,
      ),
    );
    
    // Update selected linked family members
    setSelectedLinkedFamilyMembersAll((prevMembers) =>
      prevMembers.map((member) =>
        Number(member.userId) === Number(memberUserId)
          ? { ...member, blockStatus: nextStatus }
          : member,
      ),
    );
    
    // Update tree people (associated from tree)
    setTreeAllPeople((prevMembers) =>
      prevMembers.map((member) =>
        Number(member.userId) === Number(memberUserId)
          ? { ...member, blockStatus: nextStatus }
          : member,
      ),
    );
    
    // Update members not in tree
    setMembersNotInTree((prevMembers) =>
      prevMembers.map((member) =>
        Number(member.userId) === Number(memberUserId)
          ? { ...member, blockStatus: nextStatus }
          : member,
      ),
    );
  };

  const filteredMembers = useMemo(
    () =>
      familyMembers.filter((member) =>
        member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [familyMembers, searchTerm],
  );

  const birthFamilyMembers = useMemo(
    () =>
      familyMembers.filter(
        (member) =>
          member.membershipType === 'member' &&
          member.sourceFamilyCode === birthFamilyCode &&
          member.name &&
          member.name.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [familyMembers, birthFamilyCode, searchTerm],
  );

  const associatedMembersAll = useMemo(() => {
    const fromApi = familyMembers.filter((member) => member.membershipType === 'associated');
    const fromTree = treeAllPeople.filter((m) => m.membershipType === 'associated');
    
    // Deduplicate by userId - prefer API data over tree data
    const seenUserIds = new Set();
    const deduped = [];
    
    // First add API members
    fromApi.forEach((member) => {
      if (member.userId) {
        seenUserIds.add(Number(member.userId));
      }
      deduped.push(member);
    });
    
    // Then add tree members only if not already seen
    fromTree.forEach((member) => {
      const userId = Number(member.userId);
      if (userId && !seenUserIds.has(userId)) {
        seenUserIds.add(userId);
        deduped.push(member);
      }
    });
    
    return deduped;
  }, [familyMembers, treeAllPeople]);

  const linkedMembersAll = useMemo(
    () => familyMembers.filter((member) => member.membershipType === 'linked'),
    [familyMembers],
  );

  const allBirthFamilyMembers = useMemo(
    () => familyMembers.filter((member) => member.membershipType === 'member'),
    [familyMembers],
  );

  const associatedFamilyCodes = useMemo(() =>
      Array.from(
        new Set(
          associatedMembersAll
            .map((member) => normalizeFamilyCode(member.sourceFamilyCode))
            .filter(Boolean),
        ),
      ),
    [associatedMembersAll],
  );

  const linkedFamilyCodesFromMembers = useMemo(
    () =>
      Array.from(
        new Set(
          linkedMembersAll
            .map((member) => normalizeFamilyCode(member.sourceFamilyCode))
            .filter(Boolean),
        ),
      ),
    [linkedMembersAll],
  );

  const linkedFamiliesOptions = useMemo(() => {
    const map = new Map();
    Object.keys(treeLinkedFamilyMap || {}).forEach((code) => {
      const normalizedCode = normalizeFamilyCode(code);
      if (!normalizedCode) return;
      map.set(normalizedCode, {
        familyCode: normalizedCode,
        familyName: linkedFamilyNameMap[normalizedCode] || null,
      });
    });

    linkedFamilies.forEach((family) => {
      const code = normalizeFamilyCode(family.familyCode);
      if (!code) return;
      map.set(code, {
        familyCode: code,
        familyName: family.familyName || linkedFamilyNameMap[code] || null,
      });
    });

    linkedFamilyCodesFromMembers.forEach((code) => {
      if (!map.has(code)) {
        map.set(code, {
          familyCode: code,
          familyName: linkedFamilyNameMap[code] || null,
        });
      }
    });

    return Array.from(map.values());
  }, [linkedFamilies, linkedFamilyCodesFromMembers, treeLinkedFamilyMap, linkedFamilyNameMap]);

  const associatedFamiliesOptions = useMemo(
    () =>
      associatedFamilyCodes.map((code) => ({
        familyCode: code,
        familyName: associatedFamilyNameMap[code] || null,
      })),
    [associatedFamilyCodes, associatedFamilyNameMap],
  );

  const linkedFamilyCodesForLookup = useMemo(
    () =>
      Array.from(
        new Set([
          ...linkedFamilyCodesFromMembers,
          ...Object.keys(treeLinkedFamilyMap || {}).map((code) => normalizeFamilyCode(code)),
          ...linkedFamilies.map((entry) => normalizeFamilyCode(entry.familyCode)),
        ].filter(Boolean)),
      ),
    [linkedFamilyCodesFromMembers, treeLinkedFamilyMap, linkedFamilies],
  );

  useEffect(() => {
    let ignore = false;

    const loadAssociatedFamilyNames = async () => {
      if (!associatedFamilyCodes.length) {
        if (!ignore) {
          setAssociatedFamilyNameMap({});
        }
        return;
      }

      const entries = await Promise.all(
        associatedFamilyCodes.map(async (code) => {
          const name = await fetchFamilyNameByCode(code);
          return [code, name];
        }),
      );

      if (ignore) return;
      setAssociatedFamilyNameMap((prev) => {
        const next = { ...prev };
        entries.forEach(([code, name]) => {
          next[code] = name || prev[code] || null;
        });
        return next;
      });
    };

    loadAssociatedFamilyNames();
    return () => {
      ignore = true;
    };
  }, [associatedFamilyCodes]);

  useEffect(() => {
    let ignore = false;

    const loadLinkedFamilyNames = async () => {
      if (!linkedFamilyCodesForLookup.length) {
        if (!ignore) {
          setLinkedFamilyNameMap({});
        }
        return;
      }

      const entries = await Promise.all(
        linkedFamilyCodesForLookup.map(async (code) => {
          const fromLinkedEndpoint = linkedFamilies.find(
            (entry) => normalizeFamilyCode(entry.familyCode) === code,
          )?.familyName;
          if (fromLinkedEndpoint) return [code, fromLinkedEndpoint];

          const name = await fetchFamilyNameByCode(code);
          return [code, name];
        }),
      );

      if (ignore) return;
      setLinkedFamilyNameMap((prev) => {
        const next = { ...prev };
        entries.forEach(([code, name]) => {
          next[code] = name || prev[code] || null;
        });
        return next;
      });
    };

    loadLinkedFamilyNames();
    return () => {
      ignore = true;
    };
  }, [linkedFamilyCodesForLookup, linkedFamilies]);

  useEffect(() => {
    if (!associatedFamiliesOptions.length) {
      setSelectedAssociatedFamilyCode('');
      return;
    }

    if (
      !selectedAssociatedFamilyCode ||
      !associatedFamiliesOptions.some((entry) => entry.familyCode === selectedAssociatedFamilyCode)
    ) {
      setSelectedAssociatedFamilyCode(associatedFamiliesOptions[0].familyCode);
    }
  }, [associatedFamiliesOptions, selectedAssociatedFamilyCode]);

  useEffect(() => {
    if (!linkedFamiliesOptions.length) {
      setSelectedLinkedFamilyCode('');
      return;
    }

    if (
      !selectedLinkedFamilyCode ||
      !linkedFamiliesOptions.some((entry) => entry.familyCode === selectedLinkedFamilyCode)
    ) {
      setSelectedLinkedFamilyCode(linkedFamiliesOptions[0].familyCode);
    }
  }, [linkedFamiliesOptions, selectedLinkedFamilyCode]);

  const selectedAssociatedFamilyMembers = useMemo(() => {
    if (!selectedAssociatedFamilyCode) return [];
    return associatedMembersAll.filter(
      (member) =>
        normalizeFamilyCode(member.sourceFamilyCode) === selectedAssociatedFamilyCode &&
        member.name &&
        member.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [associatedMembersAll, selectedAssociatedFamilyCode, searchTerm]);

  // Fetch all members of selected associated family
  useEffect(() => {
    const fetchAssociatedFamilyMembers = async () => {
      if (!selectedAssociatedFamilyCode || !token) {
        setSelectedAssociatedFamilyMembersAll([]);
        return;
      }
      
      setLoadingAssociatedFamily(true);
      try {
        const res = await fetch(`${BASE_URL}/family/member/${selectedAssociatedFamilyCode}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!res.ok) throw new Error('Failed to fetch associated family members');
        
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.data) ? json.data : [];
        
        const members = list.map((item) => ({
          id: item.id,
          memberId: item.memberId,
          userId: item.user?.id,
          membershipType: item.membershipType || 'member',
          user: item.user,
          name: (item?.user?.fullName && !/\bnull\b|\bundefined\b/i.test(item.user.fullName))
            ? item.user.fullName
              .replaceAll(/\bnull\b|\bundefined\b/gi, '')
              .replaceAll(/\s+/g, ' ')
              .trim()
            : (
              [item?.user?.userProfile?.firstName, item?.user?.userProfile?.lastName]
                .filter(val => val && val !== 'null' && val !== 'undefined')
                .join(' ') || 'Unknown Name'
            ),
          gender: item?.user?.userProfile?.gender || 'N/A',
          role: item.familyRole || roleMapping[item?.user?.role] || 'Member',
          contact: item?.user?.userProfile?.contactNumber,
          address: item?.user?.userProfile?.address || '',
          dob: item?.user?.userProfile?.dob || '',
          age: item?.user?.userProfile?.age || '',
          profilePic: item?.user?.profileImage,
          isAdmin: item.isFamilyAdmin ?? item?.user?.role > 1,
          blockStatus: item.blockStatus || { isBlockedByMe: false, isBlockedByThem: false },
          sourceFamilyCode: normalizeFamilyCode(item?.user?.userProfile?.familyCode || item?.familyCode),
        }));
        
        setSelectedAssociatedFamilyMembersAll(members);
      } catch (err) {
        logger.error('Failed to load associated family members', err);
        setSelectedAssociatedFamilyMembersAll([]);
      } finally {
        setLoadingAssociatedFamily(false);
      }
    };
    
    fetchAssociatedFamilyMembers();
  }, [selectedAssociatedFamilyCode, token, BASE_URL]);

  // Fetch all members of selected linked family
  useEffect(() => {
    const fetchLinkedFamilyMembers = async () => {
      if (!selectedLinkedFamilyCode || !token) {
        setSelectedLinkedFamilyMembersAll([]);
        return;
      }
      
      setLoadingLinkedFamily(true);
      try {
        const res = await fetch(`${BASE_URL}/family/member/${selectedLinkedFamilyCode}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        
        if (!res.ok) throw new Error('Failed to fetch linked family members');
        
        const json = await res.json().catch(() => null);
        const list = Array.isArray(json?.data) ? json.data : [];
        
        const members = list.map((item) => ({
          id: item.id,
          memberId: item.memberId,
          userId: item.user?.id,
          membershipType: item.membershipType || 'member',
          user: item.user, // Preserve user object for isAppUser badge
          name: (item?.user?.fullName && !/\bnull\b|\bundefined\b/i.test(item.user.fullName))
            ? item.user.fullName
              .replaceAll(/\bnull\b|\bundefined\b/gi, '')
              .replaceAll(/\s+/g, ' ')
              .trim()
            : (
              [item?.user?.userProfile?.firstName, item?.user?.userProfile?.lastName]
                .filter(val => val && val !== 'null' && val !== 'undefined')
                .join(' ') || 'Unknown Name'
            ),
          gender: item?.user?.userProfile?.gender || 'N/A',
          role: item.familyRole || roleMapping[item?.user?.role] || 'Member',
          contact: item?.user?.userProfile?.contactNumber,
          address: item?.user?.userProfile?.address || '',
          dob: item?.user?.userProfile?.dob || '',
          age: item?.user?.userProfile?.age || '',
          profilePic: item?.user?.profileImage,
          isAdmin: item.isFamilyAdmin ?? item?.user?.role > 1,
          blockStatus: item.blockStatus || { isBlockedByMe: false, isBlockedByThem: false },
          sourceFamilyCode: normalizeFamilyCode(item?.user?.userProfile?.familyCode || item?.familyCode),
        }));
        
        setSelectedLinkedFamilyMembersAll(members);
      } catch (err) {
        logger.error('Failed to load linked family members', err);
        setSelectedLinkedFamilyMembersAll([]);
      } finally {
        setLoadingLinkedFamily(false);
      }
    };
    
    fetchLinkedFamilyMembers();
  }, [selectedLinkedFamilyCode, token, BASE_URL]);

  const selectedLinkedFamilyMembers = useMemo(() => {
    if (!selectedLinkedFamilyCode) return [];
    return selectedLinkedFamilyMembersAll.filter(
      (member) =>
        member.name &&
        member.name.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [selectedLinkedFamilyMembersAll, selectedLinkedFamilyCode, searchTerm]);

  useEffect(() => {
    let ignore = false;

    const loadMembersNotInTree = async () => {
      if (!familyCode || !token) {
        setMembersNotInTree([]);
        setMemberIdsInTree(new Set());
        setTreeLinkedFamilyMap({});
        return;
      }

      setNotInTreeLoading(true);
      try {
        const res = await fetch(`${BASE_URL}/family/tree/${familyCode}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/json',
          },
        });
        if (!res.ok) throw new Error('Failed to fetch family tree');

        const json = await res.json().catch(() => null);
        const people = Array.isArray(json?.people)
          ? json.people
          : Array.isArray(json?.data?.people)
            ? json.data.people
            : [];

        const idsInTree = new Set(
          people
            .map((person) => Number(person?.userId || person?.memberId))
            .filter((id) => Number.isFinite(id) && id > 0),
        );

        const linkedFromTree = {};
        people
          .filter((person) => Boolean(person?.isExternalLinked))
          .forEach((person, index) => {
            const linkedCode = normalizeFamilyCode(person?.canonicalFamilyCode);
            if (!linkedCode) return;
            if (!linkedFromTree[linkedCode]) linkedFromTree[linkedCode] = [];

            linkedFromTree[linkedCode].push({
              id: `tree-linked-${linkedCode}-${index}`,
              memberId: Number(person?.memberId) || null,
              userId: Number(person?.userId || person?.memberId) || null,
              membershipType: 'linked',
              user: { isAppUser: Boolean(person?.isAppUser) }, // Preserve isAppUser for badge
              name: person?.name || 'Unknown',
              gender: person?.gender || 'N/A',
              role: 'Member',
              contact: person?.contactNumber || person?.mobile || '',
              address: '',
              dob: '',
              age: person?.age || '',
              profilePic: person?.img || null,
              isAdmin: false,
              blockStatus: person?.blockStatus || {
                isBlockedByMe: false,
                isBlockedByThem: false,
              },
              lastUpdated: '-',
              sourceFamilyCode: linkedCode,
            });
          });

        const notInTreeMembers = allBirthFamilyMembers.filter(
          (member) => !idsInTree.has(Number(member.userId)),
        );

        const associatedFromTree = people
          .filter((person) => 
            person?.associatedFamilyCodes?.includes(birthFamilyCode) &&
            normalizeFamilyCode(person?.primaryFamilyCode) !== birthFamilyCode
          )
          .map((person, index) => ({
            id: `tree-associated-${index}`,
            memberId: Number(person?.memberId) || null,
            userId: Number(person?.userId || person?.memberId) || null,
            membershipType: 'associated',
            user: { isAppUser: Boolean(person?.isAppUser) },
            name: person?.name || 'Unknown',
            gender: person?.gender || 'N/A',
            role: 'Member',
            contact: person?.contactNumber || person?.mobile || '',
            address: '',
            dob: '',
            age: person?.age || '',
            profilePic: person?.img || null,
            isAdmin: false,
            blockStatus: person?.blockStatus || {
              isBlockedByMe: false,
              isBlockedByThem: false,
            },
            lastUpdated: '-',
            sourceFamilyCode: normalizeFamilyCode(person?.primaryFamilyCode),
          }));

        if (!ignore) {
          setMemberIdsInTree(idsInTree);
          setTreeLinkedFamilyMap(linkedFromTree);
          setMembersNotInTree(notInTreeMembers);
          setTreeAllPeople([...associatedFromTree]);
        }
      } catch (error) {
        logger.error('Failed to compute members not in tree', error);
        if (!ignore) {
          setMemberIdsInTree(new Set());
          setTreeLinkedFamilyMap({});
          setMembersNotInTree([]);
        }
      } finally {
        if (!ignore) {
          setNotInTreeLoading(false);
        }
      }
    };

    loadMembersNotInTree();
    return () => {
      ignore = true;
    };
  }, [familyCode, token, allBirthFamilyMembers]);

  // Non-linked family members (app users only - those who have a userId from the backend)
  const nonLinkedFamilyMembers = useMemo(() => {
    return familyMembers.filter((member) => 
      member.membershipType === 'member' && 
      member.userId && 
      !memberIdsInTree.has(Number(member.userId))
    );
  }, [familyMembers, memberIdsInTree]);

  const replacementCandidates = useMemo(() => {
    const unique = new Map();
    familyMembers.forEach((member) => {
      const userId = Number(member?.userId);
      if (!Number.isFinite(userId) || userId <= 0) return;
      if (member?.membershipType !== 'member') return;
      if (!member?.user?.isAppUser) return;
      if (memberIdsInTree.has(userId)) return;
      if (unique.has(userId)) return;
      unique.set(userId, {
        userId,
        name: member?.name || `User ${userId}`,
      });
    });
    return Array.from(unique.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [familyMembers, memberIdsInTree]);

  const filteredMembersNotInTree = useMemo(
    () =>
      membersNotInTree.filter((member) =>
        member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [membersNotInTree, searchTerm],
  );

  // BLOCK OVERRIDE: Add filtered blocked members
  const filteredBlockedMembers = useMemo(
    () =>
      blockedUsers.filter((member) =>
        member.name && member.name.toLowerCase().includes(searchTerm.toLowerCase())
      ),
    [blockedUsers, searchTerm],
  );

  const privacyFamilyOptions = useMemo(() => {
    const map = new Map();
    if (birthFamilyCode) {
      map.set(birthFamilyCode, {
        familyCode: birthFamilyCode,
        familyName: 'Birth Family',
      });
    }

    associatedFamiliesOptions.forEach((entry) => {
      map.set(entry.familyCode, {
        familyCode: entry.familyCode,
        familyName: entry.familyName || 'Associated Family',
      });
    });

    linkedFamiliesOptions.forEach((entry) => {
      map.set(entry.familyCode, {
        familyCode: entry.familyCode,
        familyName: entry.familyName || 'Linked Family',
      });
    });

    return Array.from(map.values());
  }, [birthFamilyCode, associatedFamiliesOptions, linkedFamiliesOptions]);

  useEffect(() => {
    const userId = currentUser?.userId;
    const defaults = buildDefaultFamilyPrivacySettings(birthFamilyCode);
    const stored = getFamilyPrivacySettings({ userId, familyCode: birthFamilyCode });
    const validCodesSet = new Set(privacyFamilyOptions.map((entry) => entry.familyCode));

    const normalizeContentSetting = (setting, fallbackSetting) => {
      const visibility =
        setting?.visibility === 'specific-family' ? 'specific-family' : 'all-members';
      const requestedCodes = Array.isArray(setting?.familyCodes) 
        ? setting.familyCodes 
        : [setting?.familyCode || fallbackSetting?.familyCode].filter(Boolean);
      const validCodes = requestedCodes.filter(c => validCodesSet.has(c));
      const resolvedCodes = validCodes.length > 0 
        ? validCodes 
        : [fallbackSetting?.familyCode || birthFamilyCode].filter(Boolean);
      return {
        visibility,
        familyCodes: resolvedCodes,
      };
    };

    const next = {
      ...defaults,
      posts: normalizeContentSetting(stored?.posts, defaults.posts),
      albums: normalizeContentSetting(stored?.albums, defaults.albums),
      events: normalizeContentSetting(stored?.events, defaults.events),
      updatedAt: stored?.updatedAt || '',
    };

    setPrivacySettings(next);
    setPrivacySavedAt(stored?.updatedAt || '');
  }, [currentUser?.userId, birthFamilyCode, privacyFamilyOptions]);

  const updatePrivacySetting = (contentType, key, value) => {
    setPrivacySettings((prev) => ({
      ...prev,
      [contentType]: {
        ...prev[contentType],
        [key]: value,
      },
    }));
  };

  const handleSavePrivacySettings = async () => {
    const userId = currentUser?.userId;
    if (!userId) return;

    const saved = saveFamilyPrivacySettings({
      userId,
      settings: privacySettings,
    });
    setPrivacySettings(saved);
    setPrivacySavedAt(saved?.updatedAt || '');

    window.dispatchEvent(
      new CustomEvent('family-privacy-settings-updated', {
        detail: { userId, settings: saved },
      }),
    );

    await Swal.fire({
      icon: 'success',
      title: 'Privacy Saved',
      text: 'Your content privacy settings have been updated.',
      timer: 1400,
      showConfirmButton: false,
    });
  };

  // BLOCK OVERRIDE: Keep blocked users out of active grid and move them to blocked section only.
  const activeBirthMembers = birthFamilyMembers.filter(
    (member) => !member?.blockStatus?.isBlockedByMe,
  );
  const blockedMembers = filteredMembers.filter(
    (member) => member?.blockStatus?.isBlockedByMe,
  );
  const currentUserId = Number(currentUser?.userId || currentUser?.id);
  const canSelfRemove = activeBirthMembers.some(
    (member) => Number(member?.userId) === currentUserId,
  );

  const SingleMemberCard = ({
    member,
    showFamilyCode = false,
    allowManageActions = false,
    allowDelete = false,
    disabled = false,
    memberIdsInTree = new Set(),
    showWhatsAppInvite = false,
    showNotInTreeBadge = false,
  }) => (
    <div
      onClick={() => {
        if (
          !deletedMemberIds.has(member.memberId) &&
          currentUserIsFamilyAdmin &&
          !member?.blockStatus?.isBlockedByMe &&
          !disabled
        ) {
          handleViewMember(member.userId, { stopPropagation: () => { } });
        }
      }}
      className={`group relative flex flex-col sm:flex-row items-stretch bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all duration-200 overflow-hidden ${currentUserIsFamilyAdmin && !disabled ? 'cursor-pointer' : 'cursor-default'
        } ${deletedMemberIds.has(member.memberId) || disabled ? 'opacity-60 grayscale' : ''}`}
    >
      {/* Left Accent Bar */}
      <div className={`w-1.5 flex-shrink-0 ${member.gender === 'male' ? 'bg-sky-400' : member.gender === 'female' ? 'bg-pink-400' : 'bg-gray-300'}`}></div>

      <div className="flex-1 p-3 sm:p-4 flex flex-col sm:flex-row items-center gap-4 min-w-0">
        {/* Profile Avatar */}
        <div className="flex-shrink-0 relative">
          <img
            src={member.profilePic || 'https://placehold.co/80x80/f8fafc/94a3b8?text=👤'}
            alt={member.name}
            className="w-16 h-16 sm:w-12 sm:h-12 rounded-full object-cover border border-gray-200 shadow-sm"
            onError={(e) => {
              e.target.src = 'https://placehold.co/80x80/f8fafc/94a3b8?text=👤';
            }}
          />
        </div>

        {/* Content Grid */}
        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-12 gap-4 sm:gap-6 items-center">

          {/* Identity Info (Col 4) */}
          <div className="sm:col-span-4 flex flex-col items-center sm:items-start text-center sm:text-left min-w-0 pr-2">
            <div className="flex items-center gap-2 max-w-full">
              <h3 className="text-base font-bold text-gray-900 truncate">{member.name}</h3>
              {currentUserIsFamilyAdmin && member?.blockStatus?.isBlockedByMe && (
                <BlockedBadge />
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 mt-1">
              <span className={`inline-flex items-center text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${relationColors[member.role] || 'bg-gray-100 text-gray-700'}`}>
                {member.role}
              </span>
              {/* Show Associated or Linked badge based on membershipType */}
              {member.membershipType === 'associated' && (
                <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-sky-100 text-sky-600 border border-sky-200">
                  Associated
                </span>
              )}
              {member.membershipType === 'linked' && (
                <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                  Linked
                </span>
              )}
              {disabled && (
                <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200">
                  Already in Tree
                </span>
              )}
              {member.user?.isAppUser ? (
                <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
                  App User
                </span>
              ) : (
                <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-gray-100 text-gray-500 border border-gray-200">
                  Non-App
                </span>
              )}
              {/* Show NOT IN TREE badge for members not yet added to tree - only in Birth Family Directory */}
              {showNotInTreeBadge && member.membershipType === 'member' && !memberIdsInTree.has(Number(member.userId)) && (
                <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
                  Not in Tree
                </span>
              )}
              {showFamilyCode && member.sourceFamilyCode && (
                <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-100">
                  Code: {member.sourceFamilyCode}
                </span>
              )}
            </div>
          </div>

          {/* Demographics (Col 3) */}
          <div className="sm:col-span-3 flex flex-row sm:flex-col justify-center sm:justify-center items-center sm:items-start gap-3 sm:gap-1.5 text-sm text-gray-600 border-t sm:border-t-0 border-gray-100 pt-3 sm:pt-0">
            <div className="flex items-center gap-2 truncate" title="Age / DOB">
              <FaBirthdayCake className="text-gray-400 flex-shrink-0" size={14} />
              <span className="font-medium truncate">{member.age || calculateAge(member.dob)} yrs</span>
            </div>
            <div className="flex items-center gap-2 truncate" title="Gender">
              {member.gender === 'male' ? <FaMale className="text-sky-500 flex-shrink-0" size={14} /> : member.gender === 'female' ? <FaFemale className="text-pink-500 flex-shrink-0" size={14} /> : <div className="w-[14px]"></div>}
              <span className="font-medium capitalize truncate">{member.gender || 'N/A'}</span>
            </div>
          </div>

          {/* Contact info (Col 3) */}
          <div className="sm:col-span-3 flex flex-col justify-center items-center sm:items-start gap-1.5 text-sm text-gray-500 min-w-0">
            {member.contact ? (
              <div className="flex items-center gap-2 w-full justify-center sm:justify-start">
                <FaPhone className="text-gray-400 flex-shrink-0" size={13} />
                <span className="truncate" title={member.contact}>{member.contact}</span>
              </div>
            ) : (
              <div className="hidden sm:block text-gray-300 text-xs italic">-</div>
            )}
            {member.address ? (
              <div className="flex items-center gap-2 w-full justify-center sm:justify-start mt-1 sm:mt-0">
                <FaHome className="text-gray-400 flex-shrink-0" size={13} />
                <span className="truncate" title={member.address}>{member.address}</span>
              </div>
            ) : (
              <div className="hidden sm:block text-gray-300 text-xs italic">-</div>
            )}
          </div>

          {/* Actions (Col 2) */}
          <div className="sm:col-span-2 flex items-center justify-center sm:justify-end gap-2 sm:pl-4 border-t sm:border-t-0 sm:border-l border-gray-100 pt-4 sm:pt-0 pb-1 sm:pb-0 h-full">
            {currentUserIsFamilyAdmin && !disabled && (
              <>
                {/* WhatsApp Invite button for non-app users - only in Birth Family Directory */}
                {showWhatsAppInvite && !member.user?.isAppUser && member.membershipType === 'member' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const inviteLink = `${window.location.origin}/edit-profile?familyCode=${encodeURIComponent(familyCode)}&memberId=${member.memberId}`;
                      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`Join our family tree! Click here to complete your profile: ${inviteLink}`)}`;
                      window.open(whatsappUrl, '_blank');
                    }}
                    className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100 hover:text-green-700 hover:shadow-sm border border-transparent hover:border-green-200 transition-all tooltip"
                    title="Invite via WhatsApp"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                  </button>
                )}
                {allowManageActions && member.membershipType === 'member' && (
                  <button
                    onClick={(e) => handleShareInvite(member, e)}
                    disabled={deletedMemberIds.has(member.memberId)}
                    className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-blue-50 hover:text-blue-600 hover:shadow-sm border border-transparent hover:border-blue-100 transition-all tooltip"
                    title="Share invite link"
                  >
                    <FiShare2 size={16} />
                  </button>
                )}
                {/* Block button for all app users (not self) */}
                {member.user?.isAppUser && currentUser?.userId !== member.userId && (
                  <div className="flex items-center scale-95 origin-right">
                    <BlockButton
                      userId={member.userId}
                      isBlockedByMe={Boolean(member?.blockStatus?.isBlockedByMe)}
                      location="membersList"
                      userName={member.name}
                      onStatusChange={(userId, nextStatus) => handleMemberBlockStatusChange(userId, nextStatus)}
                    />
                  </div>
                )}
                {allowDelete && member.membershipType === 'member' && currentUser?.userId !== member.userId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMember(member.memberId, familyCode, member.userId, e);
                    }}
                    disabled={deletedMemberIds.has(member.memberId)}
                    className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:shadow-sm border border-transparent hover:border-red-100 transition-all tooltip"
                    title="Delete"
                  >
                    <FiTrash2 size={16} />
                  </button>
                )}
                <button
                  onClick={(e) => handleViewMember(member.userId, e)}
                  disabled={deletedMemberIds.has(member.memberId) || viewLoadingStates[member.userId]}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all border font-semibold text-sm ${viewLoadingStates[member.userId]
                      ? 'bg-primary-50 text-primary-400 border-primary-100 cursor-not-allowed'
                      : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50 hover:border-primary-300 hover:shadow-sm'
                    } tooltip`}
                  title="View Profile"
                >
                  {viewLoadingStates[member.userId] ? (
                    <FiLoader size={16} className="animate-spin" />
                  ) : (
                    <FiEye size={16} />
                  )}
                </button>
              </>
            )}
            {disabled && (
              <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-1 rounded">
                Already Linked
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const PrivacyControls = () => (
    <section className="w-full rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Privacy Settings</h2>
            <p className="text-sm text-primary-100 mt-1">
              Control who can see your posts, albums, and events
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePrivacySettings}
            className="flex items-center gap-2 px-5 py-2.5 bg-white text-primary-700 font-semibold rounded-lg hover:bg-primary-50 transition-all shadow-lg"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Save Settings
          </button>
        </div>
      </div>

      {/* Content Cards */}
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { key: 'posts', label: 'Posts', icon: '📝', desc: 'Photos, videos, and status updates' },
          { key: 'albums', label: 'Albums', icon: '📷', desc: 'Photo collections and galleries' },
          { key: 'events', label: 'Events', icon: '📅', desc: 'Family gatherings and occasions' },
        ].map((entry) => (
          <div key={entry.key} className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
            {/* Card Header */}
            <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{entry.icon}</span>
                <div>
                  <h3 className="font-bold text-gray-900">{entry.label}</h3>
                  <p className="text-xs text-gray-500">{entry.desc}</p>
                </div>
              </div>
            </div>

            {/* Card Body */}
            <div className="p-5 space-y-5">
              {/* Visibility Toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  Visibility
                </label>
                <div className="flex bg-gray-100 p-1 rounded-lg">
                  {[
                    { value: 'all-members', label: 'All Members' },
                    { value: 'specific-family', label: 'Specific Families' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => updatePrivacySetting(entry.key, 'visibility', option.value)}
                      className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-all ${
                        (privacySettings?.[entry.key]?.visibility || 'all-members') === option.value
                          ? 'bg-white text-primary-700 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Family Selection - Show only when specific-family is selected */}
              {(privacySettings?.[entry.key]?.visibility === 'specific-family') && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Select Families
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto rounded-lg border border-gray-200 p-2 bg-gray-50">
                    {privacyFamilyOptions.map((familyOption) => {
                      const isSelected = (privacySettings?.[entry.key]?.familyCodes || []).includes(familyOption.familyCode);
                      return (
                        <button
                          key={`${entry.key}-${familyOption.familyCode}`}
                          onClick={() => {
                            const currentCodes = privacySettings?.[entry.key]?.familyCodes || [];
                            const newCodes = isSelected
                              ? currentCodes.filter(c => c !== familyOption.familyCode)
                              : [...currentCodes, familyOption.familyCode];
                            updatePrivacySetting(entry.key, 'familyCodes', newCodes);
                          }}
                          className={`w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all ${
                            isSelected 
                              ? 'bg-primary-50 border border-primary-200' 
                              : 'bg-white border border-transparent hover:bg-gray-100'
                          }`}
                        >
                          {/* Toggle Switch */}
                          <div className={`relative w-11 h-6 rounded-full transition-colors ${
                            isSelected ? 'bg-primary-600' : 'bg-gray-300'
                          }`}>
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                              isSelected ? 'translate-x-5' : 'translate-x-0'
                            }`} />
                          </div>
                          <span className={`text-sm font-medium ${isSelected ? 'text-primary-900' : 'text-gray-700'}`}>
                            {familyOption.familyName} ({familyOption.familyCode})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {privacySavedAt && (
        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
          <p className="text-xs text-gray-500 text-center">
            Last saved: {new Date(privacySavedAt).toLocaleString()}
          </p>
        </div>
      )}
    </section>
  );

  const TABS = [
    { id: 'birth', label: 'Birth Family', count: activeBirthMembers.length, color: 'text-slate-700 bg-slate-100', emptyMessage: 'No birth family members found.' },
    { id: 'associated', label: 'Associated', count: associatedFamiliesOptions.length, color: 'text-sky-700 bg-sky-100', emptyMessage: 'No associated families linked.' },
    { id: 'linked', label: 'Linked', count: linkedFamiliesOptions.length, color: 'text-emerald-700 bg-emerald-100', emptyMessage: 'No linked families discovered yet.' },
    { id: 'pending', label: 'Members Not in Tree', count: filteredMembersNotInTree.length, color: 'text-amber-700 bg-amber-100', emptyMessage: 'All birth family members are already placed in the family tree.' },
    { id: 'blocked', label: 'Blocked', count: blockedMembers.length, color: 'text-red-700 bg-red-100', emptyMessage: 'No blocked members.' },
    { id: 'privacy', label: 'Privacy', count: null, color: null, emptyMessage: null },
  ];

  /* PAGINATION LOGIC */
  const paginateData = (dataArray) => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return dataArray.slice(startIndex, startIndex + itemsPerPage);
  };

  const paginateFamilies = (familiesArray) => {
    const startIndex = (familyFilterPage - 1) * familiesPerPage;
    return familiesArray.slice(startIndex, startIndex + familiesPerPage);
  };

  const FamilyFilterPagination = ({ totalFamilies }) => {
    const totalPages = Math.ceil(totalFamilies / familiesPerPage);
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center gap-2 ml-auto">
        <button
          onClick={() => setFamilyFilterPage(prev => Math.max(prev - 1, 1))}
          disabled={familyFilterPage === 1}
          className="px-2 py-1 rounded-md border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Prev
        </button>
        <span className="text-xs text-gray-500 font-medium">
          {familyFilterPage} / {totalPages}
        </span>
        <button
          onClick={() => setFamilyFilterPage(prev => Math.min(prev + 1, totalPages))}
          disabled={familyFilterPage === totalPages}
          className="px-2 py-1 rounded-md border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    );
  };

  const PaginationControls = ({ totalItems }) => {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    if (totalPages <= 1) return null;

    let pages = [];
    if (totalPages <= 7) {
      pages = [...Array(totalPages)].map((_, i) => i + 1);
    } else {
      if (currentPage <= 3) {
        pages = [1, 2, 3, 4, 5, '...', totalPages];
      } else if (currentPage >= totalPages - 2) {
        pages = [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
      } else {
        pages = [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
      }
    }

    return (
      <div className="flex flex-col sm:flex-row items-center justify-between mt-8 pt-6 border-t border-gray-100 gap-4">
        <p className="text-sm text-gray-500 font-medium">
          Showing <span className="font-bold text-gray-900">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-gray-900">{Math.min(currentPage * itemsPerPage, totalItems)}</span> of <span className="font-bold text-gray-900">{totalItems}</span> members
        </p>
        <div className="flex items-center gap-1 sm:gap-2">
          <button
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-gray-200 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Prev
          </button>

          <div className="flex items-center gap-1">
            {pages.map((p, i) => (
              p === '...' ? (
                <span key={`ellipsis-${i}`} className="px-2 text-gray-400">...</span>
              ) : (
                <button
                  key={`page-${p}`}
                  onClick={() => setCurrentPage(p)}
                  className={`w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center rounded-md text-sm font-semibold transition-colors ${currentPage === p
                      ? 'bg-primary-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {p}
                </button>
              )
            ))}
          </div>

          <button
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg border border-gray-200 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full pb-6">
      {/* Search and Pill Filters Header */}
      <div className="w-full mb-4">
        <div className="max-w-7xl mx-auto px-2">
          <div className="max-w-7xl mx-auto">
            <div className="px-1 pb-1">
              <div className="flex items-center gap-3 w-full">
                {/* Tabs */}
                <div className="min-w-0 flex items-center gap-2 overflow-hidden">
                  {TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`flex-shrink-0 whitespace-nowrap flex items-center gap-2 px-3 py-2 sm:px-4 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition-all duration-200 ${activeTab === tab.id
                          ? 'bg-primary-600 text-white shadow-md shadow-primary-600/20'
                          : 'bg-white text-gray-600 hover:bg-primary-50 hover:text-gray-900 border border-gray-200 shadow-sm'
                        }`}
                    >
                      {tab.label}
                      {tab.count !== null && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] tracking-wide font-bold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                          }`}>
                          {tab.count}
                        </span>
                      )}
                    </button>
                  ))}
                </div>

                {/* Search (name-only) */}
                <div className="flex-shrink-0">
                  <div className="relative group shadow-sm rounded-lg bg-white transition-shadow hover:shadow-md focus-within:shadow-md focus-within:ring-2 focus-within:ring-primary-100 border border-gray-200 w-44 sm:w-52 md:w-60 h-10">
                    <div className="absolute inset-y-0 left-0 w-12 flex items-center justify-center pointer-events-none">
                      <FiSearch
                        size={16}
                        className="text-gray-400 group-focus-within:text-primary-500 transition-colors"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Search by name..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full h-full pr-3 bg-transparent border-none focus:outline-none focus:ring-0 text-gray-800 placeholder-gray-400 text-sm rounded-lg"
                      style={{ paddingLeft: '3.25rem' }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="w-full pb-20 max-w-7xl mx-auto">
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-200 border-t-primary-600" />
          </div>
        ) : (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
            {!filteredMembers.length && !notInTreeLoading && activeTab !== 'privacy' && activeTab !== 'birth' && activeTab !== 'linked' && activeTab !== 'pending' && activeTab !== 'blocked' && activeTab !== 'associated' && (
              <div className="flex flex-col items-center justify-center py-16 bg-white rounded-xl border border-gray-200 shadow-sm text-gray-400">
                <p className="text-lg font-semibold text-gray-600">No members found</p>
                <p className="text-sm text-gray-400 mt-1">Try adjusting your filters or search terms.</p>
              </div>
            )}

            {activeTab === 'birth' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 mb-1">Birth Family Directory</h2>
                    <p className="text-sm text-gray-500">Manage members of your primary birth family.</p>
                  </div>
                  {canSelfRemove && (
                    <button
                      type="button"
                      onClick={handleSelfRemove}
                      disabled={selfRemoving}
                      className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-600 bg-red-50 hover:bg-red-100 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {selfRemoving ? 'Leaving...' : 'Leave Family'}
                    </button>
                  )}
                </div>
                {activeBirthMembers.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-3">
                      {paginateData(activeBirthMembers).map((member) => (
                        <SingleMemberCard
                          key={`birth-${member.id}`}
                          member={member}
                          allowManageActions
                          allowDelete
                          memberIdsInTree={memberIdsInTree}
                          showWhatsAppInvite
                          showNotInTreeBadge
                        />
                      ))}
                    </div>
                    <PaginationControls totalItems={activeBirthMembers.length} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium">No birth family members found.</p>
                    <p className="text-gray-400 text-xs mt-1">Family members will appear here once added.</p>
                  </div>
                )}

                {currentUserIsFamilyAdmin && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">Non-App Users In Tree</h3>
                        <p className="text-sm text-gray-500">
                          Replace dummy cards with active app members not already placed in the tree.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={fetchNonAppUsers}
                        className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Refresh
                      </button>
                    </div>

                    {loadingNonAppUsers ? (
                      <div className="py-8 text-sm text-gray-500">Loading non-app users...</div>
                    ) : nonAppUsers.length === 0 ? (
                      <div className="py-8 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-100 px-4">
                        No non-app users found in this family tree.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {nonAppUsers.map((dummy) => {
                          const dummyUserId = Number(dummy?.dummyUserId);
                          const selectedReplacement = Number(replacementSelections?.[dummyUserId] || 0);
                          const isReplacing = replacingDummyIds.has(dummyUserId);
                          return (
                            <div key={`dummy-${dummyUserId}`} className="rounded-lg border border-gray-200 p-4 bg-gray-50/40">
                              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">
                                    {dummy?.name || 'Familyss User'}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    Dummy ID: {dummyUserId} | Node: {dummy?.nodeUid || '-'} | Generation: {dummy?.generation ?? '-'}
                                  </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                                  <select
                                    value={selectedReplacement || ''}
                                    onChange={(e) => {
                                      const nextValue = Number(e.target.value || 0);
                                      setReplacementSelections((prev) => ({
                                        ...prev,
                                        [dummyUserId]: nextValue || '',
                                      }));
                                    }}
                                    className="min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                                  >
                                    <option value="">Select replacement member</option>
                                    {replacementCandidates.map((candidate) => (
                                      <option key={`replace-${dummyUserId}-${candidate.userId}`} value={candidate.userId}>
                                        {candidate.name} (#{candidate.userId})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleReplaceDummy(dummyUserId)}
                                    disabled={isReplacing || !selectedReplacement}
                                    className="inline-flex items-center justify-center px-3 py-2 rounded-lg bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
                                  >
                                    {isReplacing ? 'Replacing...' : 'Replace'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!loadingNonAppUsers && nonAppUsers.length > 0 && replacementCandidates.length === 0 && (
                      <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                        No eligible replacement members available. Add or approve an app user who is not already in the tree.
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'associated' && (
              <div className="space-y-4">
                {/* Section 1: Associated Members IN MY TREE (Highlighted) */}
                <div className="bg-white rounded-xl shadow-sm border-2 border-sky-200 overflow-hidden">
                  <button
                    onClick={() => setAssociatedAccordionOpen(prev => ({ ...prev, inTree: !prev.inTree }))}
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-sky-50 to-white hover:from-sky-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-sky-500 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-900">Associated in My Tree</h2>
                        <p className="text-sm text-gray-500">Associated members already placed in your family tree</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-sky-100 text-sky-700 rounded-full text-sm font-bold">
                        {associatedMembersAll.filter(m => memberIdsInTree.has(Number(m.userId))).length}
                      </span>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${associatedAccordionOpen.inTree ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {associatedAccordionOpen.inTree && (
                    <div className="p-4 border-t border-gray-100">
                      {(() => {
                        const associatedInTree = associatedMembersAll.filter(m => memberIdsInTree.has(Number(m.userId)));
                        return associatedInTree.length > 0 ? (
                          <>
                            <div className="mb-4">
                              <div className="flex flex-wrap gap-1 bg-gray-100/50 p-1 rounded-lg">
                                {associatedFamiliesOptions.map((family) => {
                                  const familyMemberCount = associatedInTree.filter(
                                    m => normalizeFamilyCode(m.sourceFamilyCode) === family.familyCode
                                  ).length;
                                  if (familyMemberCount === 0) return null;
                                  return (
                                    <button
                                      type="button"
                                      key={`associated-tree-tab-${family.familyCode}`}
                                      onClick={() => setSelectedAssociatedFamilyCode(family.familyCode)}
                                      className={`px-4 py-2 text-sm font-semibold transition-all rounded-md ${selectedAssociatedFamilyCode === family.familyCode
                                          ? 'bg-white text-sky-600 shadow-sm'
                                          : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                      {family.familyName || family.familyCode}
                                      <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                        {familyMemberCount}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                            <div className="bg-sky-50/50 rounded-lg p-4">
                              {selectedAssociatedFamilyCode ? (
                                (() => {
                                  const filtered = associatedInTree.filter(
                                    m => normalizeFamilyCode(m.sourceFamilyCode) === selectedAssociatedFamilyCode
                                  );
                                  return filtered.length > 0 ? (
                                    <div className="flex flex-col gap-2">
                                      <h3 className="text-sm font-bold text-sky-800 mb-3 flex items-center gap-2">
                                        <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                                        {associatedFamilyNameMap[selectedAssociatedFamilyCode] || selectedAssociatedFamilyCode}
                                        <span className="text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded border">
                                          {selectedAssociatedFamilyCode}
                                        </span>
                                      </h3>
                                      {paginateData(filtered).map((member) => (
                                        <SingleMemberCard 
                                          key={`associated-tree-${member.id}`} 
                                          member={member} 
                                          showFamilyCode 
                                          allowManageActions 
                                        />
                                      ))}
                                      <PaginationControls totalItems={filtered.length} />
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center justify-center py-8">
                                      <p className="text-gray-500 text-sm font-medium">No associated members from this family in your tree</p>
                                    </div>
                                  );
                                })()
                              ) : (
                                <div className="flex flex-col items-center justify-center py-8">
                                  <p className="text-gray-500 text-sm font-medium">Select a family to view members</p>
                                </div>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                            <p className="text-gray-500 text-sm font-medium">No associated members in your tree yet</p>
                            <p className="text-gray-400 text-xs mt-1">Associated members will appear here when placed in your tree</p>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>

                {/* Section 2: ALL Associated Family Members */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setAssociatedAccordionOpen(prev => ({ ...prev, allAssociated: !prev.allAssociated }))}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-900">All Associated Members</h2>
                        <p className="text-sm text-gray-500">Complete list of all members from associated families</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                        {selectedAssociatedFamilyCode 
                          ? selectedAssociatedFamilyMembersAll.filter(m => m.name?.toLowerCase().includes(searchTerm.toLowerCase())).length
                          : associatedMembersAll.length}
                      </span>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${associatedAccordionOpen.allAssociated ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {associatedAccordionOpen.allAssociated && (
                    <div className="p-4 border-t border-gray-100">
                      {associatedFamiliesOptions.length > 0 ? (
                        <>
                          {/* Tab-style Family Filter */}
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-1 bg-gray-100/50 p-1 rounded-lg">
                              {associatedFamiliesOptions.map((family) => {
                                const familyMemberCount = selectedAssociatedFamilyMembersAll.filter(
                                  m => normalizeFamilyCode(m.sourceFamilyCode) === family.familyCode &&
                                  m.name?.toLowerCase().includes(searchTerm.toLowerCase())
                                ).length;
                                return (
                                  <button
                                    type="button"
                                    key={`associated-tab-${family.familyCode}`}
                                    onClick={() => setSelectedAssociatedFamilyCode(family.familyCode)}
                                    className={`px-4 py-2 text-sm font-semibold transition-all rounded-md ${selectedAssociatedFamilyCode === family.familyCode
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                      }`}
                                  >
                                    {family.familyName || 'Family'}
                                    <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                      {familyMemberCount}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {selectedAssociatedFamilyCode ? (
                            loadingAssociatedFamily ? (
                              <div className="flex justify-center items-center py-8">
                                <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-blue-500" />
                                <span className="ml-3 text-sm text-gray-500">Loading...</span>
                              </div>
                            ) : (
                              (() => {
                                const filteredMembers = selectedAssociatedFamilyMembersAll.filter(
                                  m => m.name?.toLowerCase().includes(searchTerm.toLowerCase())
                                );
                                
                                return filteredMembers.length > 0 ? (
                                  <div className="flex flex-col gap-3">
                                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-2">
                                      <p className="text-sm text-blue-700">
                                        <span className="font-semibold">{filteredMembers.length}</span> member{filteredMembers.length > 1 ? 's' : ''}
                                        {' from '}{associatedFamilyNameMap[selectedAssociatedFamilyCode] || selectedAssociatedFamilyCode}
                                      </p>
                                    </div>
                                    {paginateData(filteredMembers).map((member) => (
                                      <SingleMemberCard 
                                        key={`associated-all-${member.id}`} 
                                        member={member} 
                                        showFamilyCode 
                                      />
                                    ))}
                                    <PaginationControls totalItems={filteredMembers.length} />
                                  </div>
                                ) : (
                                  <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                                    <p className="text-gray-500 text-sm font-medium">No members from this family</p>
                                  </div>
                                );
                              })()
                            )
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                              <p className="text-gray-500 text-sm font-medium">Select a family to view members</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-500 text-sm font-medium">No associated families discovered yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 3: App Users Ready to Associate (NOT in tree yet) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setAssociatedAccordionOpen(prev => ({ ...prev, readyToAssociate: !prev.readyToAssociate }))}
                    className="w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-900">Ready to Associate</h2>
                        <p className="text-sm text-gray-500">App users from associated families available to add to your tree</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${associatedAccordionOpen.readyToAssociate ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {associatedAccordionOpen.readyToAssociate && (
                    <div className="p-4 border-t border-gray-100">
                      {selectedAssociatedFamilyCode ? (
                        loadingAssociatedFamily ? (
                          <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-amber-500" />
                            <span className="ml-3 text-sm text-gray-500">Loading...</span>
                          </div>
                        ) : (
                          (() => {
                            // Get all app users from the selected associated family
                            const allAppUsers = selectedAssociatedFamilyMembersAll.filter(
                              (m) => 
                                m.userId && 
                                m.user?.isAppUser &&
                                m.name && 
                                m.name.toLowerCase().includes(searchTerm.toLowerCase())
                            );
                            
                            // Get IDs of users already in current family (members or associated)
                            const currentFamilyUserIds = new Set(
                              familyMembers
                                .filter(m => m.userId && (m.membershipType === 'member' || m.membershipType === 'associated'))
                                .map(m => Number(m.userId))
                                .filter(id => id > 0)
                            );
                            
                            // Filter out users already in current family
                            const availableToAssociate = allAppUsers.filter(m => !currentFamilyUserIds.has(Number(m.userId)));
                            const alreadyInFamily = allAppUsers.filter(m => currentFamilyUserIds.has(Number(m.userId)));
                            
                            const readyCount = availableToAssociate.length;
                            const hiddenCount = alreadyInFamily.length;
                            
                            return readyCount > 0 || hiddenCount > 0 ? (
                              <div className="flex flex-col gap-3">
                                <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                                  <p className="text-sm text-amber-700">
                                    <span className="font-semibold">{readyCount}</span> ready to associate
                                    {hiddenCount > 0 && (
                                      <span className="text-amber-600"> • <span className="font-semibold">{hiddenCount}</span> already in family (hidden)</span>
                                    )}
                                  </p>
                                </div>
                                {/* Ready to associate */}
                                {availableToAssociate.map((member) => (
                                  <SingleMemberCard key={`ready-assoc-${member.id}`} member={member} showFamilyCode allowManageActions />
                                ))}
                                {/* Already in family - show as disabled */}
                                {alreadyInFamily.map((member) => (
                                  <SingleMemberCard key={`ready-assoc-hidden-${member.id}`} member={member} showFamilyCode disabled />
                                ))}
                                <PaginationControls totalItems={readyCount + hiddenCount} />
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                                <p className="text-gray-500 text-sm font-medium">No app users available from this family</p>
                                <p className="text-gray-400 text-xs mt-1">All users are already members of your current family</p>
                              </div>
                            );
                          })()
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-500 text-sm font-medium">Select an associated family first</p>
                          <p className="text-gray-400 text-xs mt-1">Choose a family from the &quot;All Associated Members&quot; section above</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'linked' && (
              <div className="space-y-4">
                {/* Section 1: Linked Members IN MY TREE (Highlighted) */}
                <div className="bg-white rounded-xl shadow-sm border-2 border-emerald-200 overflow-hidden">
                  <button
                    onClick={() => setLinkedAccordionOpen(prev => ({ ...prev, inTree: !prev.inTree }))}
                    className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-emerald-50 to-white hover:from-emerald-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-900">Linked in My Tree</h2>
                        <p className="text-sm text-gray-500">Members from linked families already placed in your family tree</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-full text-sm font-bold">
                        {Object.values(treeLinkedFamilyMap).flat().length}
                      </span>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${linkedAccordionOpen.inTree ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {linkedAccordionOpen.inTree && (
                    <div className="p-4 border-t border-gray-100">
                      {Object.keys(treeLinkedFamilyMap).length > 0 ? (
                        <>
                          {/* Horizontal Tab-style Family Selector */}
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-1 bg-gray-100/50 p-1 rounded-lg">
                              {Object.entries(treeLinkedFamilyMap).map(([familyCode, members]) => (
                                <button
                                  type="button"
                                  key={`tree-tab-${familyCode}`}
                                  onClick={() => setSelectedLinkedFamilyCode(familyCode)}
                                  className={`px-4 py-2 text-sm font-semibold transition-all rounded-md ${selectedLinkedFamilyCode === familyCode
                                      ? 'bg-white text-emerald-600 shadow-sm'
                                      : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                  {linkedFamilyNameMap[familyCode] || familyCode}
                                  <span className="ml-1.5 text-xs text-gray-400">({familyCode})</span>
                                  <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                    {members.length}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Selected Family Members */}
                          {selectedLinkedFamilyCode && treeLinkedFamilyMap[selectedLinkedFamilyCode] ? (
                            <div className="bg-emerald-50/50 rounded-lg p-4">
                              <h3 className="text-sm font-bold text-emerald-800 mb-3 flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-full"></span>
                                {linkedFamilyNameMap[selectedLinkedFamilyCode] || selectedLinkedFamilyCode}
                                <span className="text-xs font-normal text-gray-500 bg-white px-2 py-0.5 rounded border">
                                  {selectedLinkedFamilyCode}
                                </span>
                              </h3>
                              <div className="flex flex-col gap-2">
                                {treeLinkedFamilyMap[selectedLinkedFamilyCode].map((member) => (
                                  <SingleMemberCard 
                                    key={`tree-${member.id}`} 
                                    member={member} 
                                    showFamilyCode 
                                    allowManageActions 
                                  />
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                              <p className="text-gray-500 text-sm font-medium">Select a family to view members</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-500 text-sm font-medium">No linked members in your tree yet</p>
                          <p className="text-gray-400 text-xs mt-1">Add members from linked families to your tree to see them here</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 2: ALL Linked Family Members */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setLinkedAccordionOpen(prev => ({ ...prev, allLinked: !prev.allLinked }))}
                    className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-500 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-900">All Family Members</h2>
                        <p className="text-sm text-gray-500">Complete list of all members from linked families</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-bold">
                        {selectedLinkedFamilyCode 
                          ? selectedLinkedFamilyMembersAll.filter(m => m.sourceFamilyCode === selectedLinkedFamilyCode).length
                          : 'Select a family'}
                      </span>
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${linkedAccordionOpen.allLinked ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {linkedAccordionOpen.allLinked && (
                    <div className="p-4 border-t border-gray-100">
                      {linkedFamiliesOptions.length > 0 ? (
                        <>
                          {/* Tab-style Family Filter */}
                          <div className="mb-4">
                            <div className="flex flex-wrap gap-1 bg-gray-100/50 p-1 rounded-lg">
                              {linkedFamiliesOptions.map((family) => {
                                const familyMemberCount = selectedLinkedFamilyMembersAll.filter(
                                  m => m.sourceFamilyCode === family.familyCode
                                ).length;
                                return (
                                  <button
                                    type="button"
                                    key={`linked-tab-${family.familyCode}`}
                                    onClick={() => setSelectedLinkedFamilyCode(family.familyCode)}
                                    className={`px-4 py-2 text-sm font-semibold transition-all rounded-md ${selectedLinkedFamilyCode === family.familyCode
                                        ? 'bg-white text-blue-600 shadow-sm'
                                        : 'text-gray-500 hover:text-gray-700'
                                      }`}
                                  >
                                    {family.familyName || 'Family'}
                                    <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 px-1.5 py-0.5 rounded-full">
                                      {familyMemberCount}
                                    </span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Members List */}
                          {selectedLinkedFamilyCode ? (
                            (() => {
                              const filteredMembers = selectedLinkedFamilyMembersAll.filter(m => m.sourceFamilyCode === selectedLinkedFamilyCode);
                              
                              return filteredMembers.length > 0 ? (
                                <div className="flex flex-col gap-3">
                                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-2">
                                    <p className="text-sm text-blue-700">
                                      <span className="font-semibold">{filteredMembers.length}</span> member{filteredMembers.length > 1 ? 's' : ''}
                                      {' from '}{linkedFamilyNameMap[selectedLinkedFamilyCode] || selectedLinkedFamilyCode}
                                    </p>
                                  </div>
                                  {paginateData(filteredMembers).map((member) => (
                                    <SingleMemberCard 
                                      key={`family-all-${member.id}`} 
                                      member={member} 
                                      showFamilyCode 
                                    />
                                  ))}
                                  <PaginationControls totalItems={filteredMembers.length} />
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                                  <p className="text-gray-500 text-sm font-medium">No members from this family</p>
                                </div>
                              );
                            })()
                          ) : (
                            <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                              <p className="text-gray-500 text-sm font-medium">Select a family to view members</p>
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-500 text-sm font-medium">No linked families discovered yet</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Section 3: App Users Ready to Link (NOT linked yet) */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                  <button
                    onClick={() => setLinkedAccordionOpen(prev => ({ ...prev, readyToLink: !prev.readyToLink }))}
                    className="w-full flex items-center justify-between p-4 bg-amber-50 hover:bg-amber-100 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                        </svg>
                      </div>
                      <div className="text-left">
                        <h2 className="text-lg font-bold text-gray-900">Ready to Link</h2>
                        <p className="text-sm text-gray-500">App users from linked families available for linking</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg 
                        className={`w-5 h-5 text-gray-400 transition-transform ${linkedAccordionOpen.readyToLink ? 'rotate-180' : ''}`} 
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </button>
                  
                  {linkedAccordionOpen.readyToLink && (
                    <div className="p-4 border-t border-gray-100">
                      {selectedLinkedFamilyCode ? (
                        loadingLinkedFamily ? (
                          <div className="flex justify-center items-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-4 border-gray-200 border-t-amber-500" />
                            <span className="ml-3 text-sm text-gray-500">Loading...</span>
                          </div>
                        ) : (
                          <div>
                            <div className="flex flex-wrap items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-100 mb-4">
                              <span className="text-sm font-semibold text-gray-500 mr-2">Select Family:</span>
                              {linkedFamiliesOptions.map((family) => (
                                <button
                                  type="button"
                                  key={`ready-${family.familyCode}`}
                                  onClick={() => setSelectedLinkedFamilyCode(family.familyCode)}
                                  className={`rounded-lg px-3 py-1 text-sm font-semibold transition-all ${selectedLinkedFamilyCode === family.familyCode
                                      ? 'bg-amber-500 text-white shadow-sm'
                                      : 'bg-white text-gray-700 hover:bg-amber-50 border border-gray-200'
                                    }`}
                                >
                                  {(family.familyName || 'Family')}
                                </button>
                              ))}
                            </div>
                            
                            {(() => {
                              // Get all app users from selected family
                              const allAppUsers = selectedLinkedFamilyMembersAll.filter(
                                (m) => m.userId && 
                                        m.user?.isAppUser &&
                                        m.name && 
                                        m.name.toLowerCase().includes(searchTerm.toLowerCase())
                              );
                              
                              // Check which users are already in the tree
                              const linkedInTreeIds = new Set(
                                Object.values(treeLinkedFamilyMap)
                                  .flat()
                                  .map(m => Number(m.userId))
                                  .filter(id => id > 0)
                              );
                              
                              // Separate into ready and already linked
                              const readyToLink = allAppUsers.filter(m => !linkedInTreeIds.has(Number(m.userId)));
                              const alreadyLinked = allAppUsers.filter(m => linkedInTreeIds.has(Number(m.userId)));
                              
                              const totalCount = allAppUsers.length;
                              
                              return totalCount > 0 ? (
                                <div className="flex flex-col gap-3">
                                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
                                    <p className="text-sm text-amber-700">
                                      <span className="font-semibold">{readyToLink.length}</span> ready to link
                                      {alreadyLinked.length > 0 && (
                                        <span className="text-amber-600"> • <span className="font-semibold">{alreadyLinked.length}</span> already in tree</span>
                                      )}
                                    </p>
                                  </div>
                                  {/* Ready to link - normal state */}
                                  {readyToLink.map((member) => (
                                    <SingleMemberCard key={`ready-${member.id}`} member={member} showFamilyCode allowManageActions />
                                  ))}
                                  {/* Already linked - disabled state */}
                                  {alreadyLinked.map((member) => (
                                    <SingleMemberCard key={`ready-linked-${member.id}`} member={member} showFamilyCode disabled />
                                  ))}
                                  <PaginationControls totalItems={totalCount} />
                                </div>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                                  <p className="text-gray-500 text-sm font-medium">No app users found in this family</p>
                                </div>
                              );
                            })()}
                          </div>
                        )
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 bg-gray-50 rounded-lg">
                          <p className="text-gray-500 text-sm font-medium">Select a linked family first</p>
                          <p className="text-gray-400 text-xs mt-1">Choose a family from the &quot;All Linked Members&quot; section above</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {activeTab === 'pending' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900 mb-1">Members Not in Tree</h2>
                <p className="text-sm text-gray-500 mb-6">These birth family members are not yet placed in the family tree (Under Admin's Family Code).</p>
                {filteredMembersNotInTree.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-3">
                      {paginateData(filteredMembersNotInTree).map((member) => (
                        <SingleMemberCard key={`not-in-tree-${member.id}`} member={member} allowDelete />
                      ))}
                    </div>
                    <PaginationControls totalItems={filteredMembersNotInTree.length} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium">All birth family members are already placed in the family tree.</p>
                    <p className="text-gray-400 text-xs mt-1">New members who haven't been added to the tree will appear here.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'blocked' && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <h2 className="text-xl font-bold text-red-600 mb-1">Blocked Profiles</h2>
                <p className="text-sm text-gray-500 mb-6">Manage restricted users. Blocked users cannot see your posts or interact with you.</p>
                {loadingBlocked ? (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium">Loading blocked members...</p>
                  </div>
                ) : filteredBlockedMembers.length > 0 ? (
                  <>
                    <div className="flex flex-col gap-3">
                      {paginateData(filteredBlockedMembers).map((member) => (
                        <div
                          key={`blocked-member-${member.id}`}
                          className="flex items-center gap-4 rounded-xl border border-red-100 bg-red-50/30 p-4 shadow-sm"
                        >
                          <img
                            src={member.profilePic || 'https://placehold.co/48x48/e2e8f0/64748b?text=👤'}
                            alt={member.name}
                            className="h-12 w-12 flex-shrink-0 rounded-full object-cover ring-2 ring-red-100"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-bold text-gray-900">{member.name}</span>
                              <BlockedBadge />
                            </div>
                            <span className={`mt-1 inline-flex items-center rounded-md px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider ${relationColors[member.role] || 'bg-gray-100 text-gray-800'}`}>
                              {member.role}
                            </span>
                          </div>
                          {currentUserIsFamilyAdmin && (
                            <div className="flex-shrink-0 scale-90">
                              <BlockButton
                                userId={member.userId}
                                isBlockedByMe
                                location="profile"
                                userName={member.name}
                                onStatusChange={(nextStatus) =>
                                  handleMemberBlockStatusChange(member.userId, nextStatus)
                                }
                              />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <PaginationControls totalItems={filteredBlockedMembers.length} />
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 bg-gray-50 rounded-xl border border-gray-100">
                    <p className="text-gray-500 text-sm font-medium">No blocked members.</p>
                    <p className="text-gray-400 text-xs mt-1">Blocked users will appear here. You can unblock them anytime.</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'privacy' && (
              <div className="w-full">
                <PrivacyControls />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default FamilyMemberCard;
