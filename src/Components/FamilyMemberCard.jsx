import React, { useState, useEffect, useMemo, useRef } from 'react';
import PropTypes from 'prop-types';
import { FiTrash2, FiEye, FiLoader, FiShare2, FiSearch } from 'react-icons/fi';
import { FaBirthdayCake, FaPhone, FaHome, FaMale, FaFemale } from 'react-icons/fa';
import Swal from 'sweetalert2';
import { BlockedBadge } from './block/BlockedBadge';
import { logger } from '../utils/logger';
import { authFetch } from '../utils/authFetch';
import { fetchFamilyTree, deleteFamilyMember, getMembersNotInTree, replaceDummyUser, replaceStructuralDummy as replaceStructuralDummySlot, selfRemoveFromFamily } from '../utils/familyTreeApi';
import {
  buildDefaultFamilyPrivacySettings,
  fetchFamilyPrivacySettings,
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

  const handleViewMember = async (userId, e) => {
    e?.stopPropagation?.();

    const key = String(userId ?? '');
    if (!key) return;
    if (viewLoadingStates[key]) return;

    setViewLoadingStates((prev) => ({ ...prev, [key]: true }));
    try {
      if (typeof onViewMember === 'function') {
        await onViewMember(userId);
      }
    } finally {
      setViewLoadingStates((prev) => ({ ...prev, [key]: false }));
    }
  };
  const [privacySettings, setPrivacySettings] = useState(() =>
    buildDefaultFamilyPrivacySettings(''),
  );
  const [privacySavedAt, setPrivacySavedAt] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [familyFilterPage, setFamilyFilterPage] = useState(1);
  const [isTabDropdownOpen, setIsTabDropdownOpen] = useState(false);
  const tabDropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    let ignore = false;
    const userId = currentUser?.userId;

    const applyPrivacySettings = (stored) => {
      const next = {
        ...buildDefaultFamilyPrivacySettings(),
        ...stored,
        updatedAt: stored?.updatedAt || '',
      };

      if (!ignore) {
        setPrivacySettings(next);
        setPrivacySavedAt(next.updatedAt || '');
      }
    };

    applyPrivacySettings(getFamilyPrivacySettings({ userId }));

    if (userId) {
      fetchFamilyPrivacySettings({ userId }).then((stored) => {
        applyPrivacySettings(stored);
      });
    }

    return () => {
      ignore = true;
    };
  }, [currentUser?.userId]);

  const updatePrivacySetting = (contentType, value) => {
    setPrivacySettings((prev) => {
      const currentEntry = prev?.[contentType] || { visibility: 'all-members', familyCodes: [] };
      const nextEntry =
        value && typeof value === 'object'
          ? {
              visibility:
                value.visibility === 'specific-family' ? 'specific-family' : 'all-members',
              familyCodes: Array.isArray(value.familyCodes)
                ? Array.from(
                    new Set(
                      value.familyCodes
                        .map((code) => normalizeFamilyCode(code))
                        .filter(Boolean),
                    ),
                  )
                : currentEntry.familyCodes || [],
            }
          : currentEntry;

      return {
        ...prev,
        [contentType]: nextEntry,
      };
    });
  };

  const togglePrivacyFamilyCode = (contentType, familyCode) => {
    const normalizedCode = normalizeFamilyCode(familyCode);
    if (!normalizedCode) return;

    setPrivacySettings((prev) => {
      const currentEntry = prev?.[contentType] || { visibility: 'specific-family', familyCodes: [] };
      const currentCodes = Array.isArray(currentEntry.familyCodes) ? currentEntry.familyCodes : [];
      const nextCodes = currentCodes.includes(normalizedCode)
        ? currentCodes.filter((code) => code !== normalizedCode)
        : [...currentCodes, normalizedCode];

      return {
        ...prev,
        [contentType]: {
          visibility: 'specific-family',
          familyCodes: nextCodes,
        },
      };
    });
  };

  const [isSavingPrivacySettings, setIsSavingPrivacySettings] = useState(false);

  const handleSavePrivacySettings = async () => {
    const userId = currentUser?.userId;
    if (!userId) return;
    if (isSavingPrivacySettings) return;

    try {
      setIsSavingPrivacySettings(true);
      await Swal.fire({
        title: 'Saving... ',
        allowOutsideClick: false,
        allowEscapeKey: false,
        showConfirmButton: false,
        didOpen: () => {
          Swal.showLoading();
        },
      });

      const saved = await saveFamilyPrivacySettings({
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
    } catch (error) {
      logger.error('Failed to save content privacy settings', error);
      await Swal.fire({
        icon: 'error',
        title: 'Save Failed',
        text: error?.message || 'Unable to update your content privacy settings.',
      });
    } finally {
      setIsSavingPrivacySettings(false);
    }
  };


  const itemsPerPage = 10;
  const familiesPerPage = 8;
  const [associatedAccordionOpen, setAssociatedAccordionOpen] = useState({ inTree: true, allAssociated: true });
  const [linkedAccordionOpen, setLinkedAccordionOpen] = useState({ inTree: true, allLinked: true });

  const normalizeFamilyCode = (value) => String(value || '').trim().toUpperCase();
  const birthFamilyCode = normalizeFamilyCode(
    familyCode || currentUser?.familyCode || currentUser?.userProfile?.familyCode,
  );

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    if (Number.isNaN(birthDate.getTime())) return 'N/A';
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age -= 1;
    }
    return age >= 0 ? age : 'N/A';
  };

  const normalizeMember = (raw) => {
    const user = raw?.user || {};
    const profile = user?.userProfile || {};
    const resolvedUserId = Number(user?.id || raw?.userId || raw?.memberId || 0);
    const primaryCode = normalizeFamilyCode(profile?.familyCode || raw?.familyCode);
    return {
      id: raw?.id ?? resolvedUserId ?? raw?.memberId,
      memberId: raw?.memberId ?? null,
      userId: resolvedUserId,
      name:
        user?.fullName ||
        [profile?.firstName, profile?.lastName].filter(Boolean).join(' ').trim() ||
        'Family Member',
      profilePic: user?.profileImage || profile?.profile || null,
      age: calculateAge(profile?.dob),
      dob: profile?.dob || null,
      gender: profile?.gender || '',
      contact: profile?.contactNumber || user?.mobile || '',
      address: profile?.address || '',
      role: raw?.familyRole || roleMapping[user?.role] || 'Member',
      sourceFamilyCode: primaryCode,
      membershipType: raw?.membershipType || 'member',
      isFamilyAdmin: Boolean(raw?.isFamilyAdmin),
      familyCode: normalizeFamilyCode(raw?.familyCode || birthFamilyCode),
      user: {
        ...user,
        isAppUser: user?.isAppUser !== false,
      },
      blockStatus: raw?.blockStatus || { isBlockedByMe: false, isBlockedByThem: false },
    };
  };

  useEffect(() => {
    let ignore = false;

    const loadMembers = async () => {
      if (!birthFamilyCode) {
        if (!ignore) {
          setFamilyMembers([]);
          setLoading(false);
        }
        return;
      }

      try {
        setLoading(true);
        const response = await authFetch('/family/member/' + birthFamilyCode, { method: 'GET' });
        const nextMembers = Array.isArray(response?.data)
          ? response.data.map(normalizeMember)
          : [];
        if (!ignore) {
          setFamilyMembers(nextMembers);
        }
      } catch (error) {
        logger.error('Failed to load family members', error);
        if (!ignore) {
          setFamilyMembers([]);
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    loadMembers();
    return () => {
      ignore = true;
    };
  }, [birthFamilyCode]);

  useEffect(() => {
    let ignore = false;

    const loadMembersNotInTree = async () => {
      if (!birthFamilyCode) {
        if (!ignore) {
          setMembersNotInTree([]);
          setNonAppUsers([]);
        }
        return;
      }
      try {
        setNotInTreeLoading(true);
        setLoadingNonAppUsers(true);
        const [membersResponse, nonAppResponse] = await Promise.all([
          getMembersNotInTree(birthFamilyCode),
          authFetch('/family/member/' + birthFamilyCode + '/non-app-users', { method: 'GET' }),
        ]);
        const nextMembers = Array.isArray(membersResponse?.data)
          ? membersResponse.data.map(normalizeMember)
          : [];
        const nextNonAppUsers = Array.isArray(nonAppResponse?.data)
          ? nonAppResponse.data
          : [];
        if (!ignore) {
          setMembersNotInTree(nextMembers);
          setNonAppUsers(nextNonAppUsers);
        }
      } catch (error) {
        logger.error('Failed to load members not in tree', error);
        if (!ignore) {
          setMembersNotInTree([]);
          setNonAppUsers([]);
        }
      } finally {
        if (!ignore) {
          setNotInTreeLoading(false);
          setLoadingNonAppUsers(false);
        }
      }
    };

    loadMembersNotInTree();
    return () => {
      ignore = true;
    };
  }, [birthFamilyCode]);

  useEffect(() => {
    let ignore = false;

    const loadTreePeople = async () => {
      if (!birthFamilyCode) {
        if (!ignore) {
          setTreeAllPeople([]);
          setMemberIdsInTree(new Set());
        }
        return;
      }
      try {
        const people = await fetchFamilyTree(birthFamilyCode);
        const normalizedPeople = Array.isArray(people) ? people : [];
        const ids = new Set(
          normalizedPeople
            .map((person) => Number(person?.userId || person?.memberId || person?.id))
            .filter((value) => Number.isFinite(value) && value > 0),
        );
        if (!ignore) {
          setTreeAllPeople(normalizedPeople);
          setMemberIdsInTree(ids);
        }
      } catch (error) {
        logger.error('Failed to load family tree people', error);
        if (!ignore) {
          setTreeAllPeople([]);
          setMemberIdsInTree(new Set());
        }
      }
    };

    loadTreePeople();
    return () => {
      ignore = true;
    };
  }, [birthFamilyCode]);

  const refreshFamilyManagementState = async () => {
    if (!birthFamilyCode) return;

    const [membersResponse, notInTreeResponse, people] = await Promise.all([
      authFetch('/family/member/' + birthFamilyCode, { method: 'GET' }),
      getMembersNotInTree(birthFamilyCode),
      fetchFamilyTree(birthFamilyCode),
    ]);

    const nextMembers = Array.isArray(membersResponse?.data)
      ? membersResponse.data.map(normalizeMember)
      : [];
    const nextMembersNotInTree = Array.isArray(notInTreeResponse?.data)
      ? notInTreeResponse.data.map(normalizeMember)
      : [];
    const normalizedPeople = Array.isArray(people) ? people : [];
    const ids = new Set(
      normalizedPeople
        .map((person) => Number(person?.userId || person?.memberId || person?.id))
        .filter((value) => Number.isFinite(value) && value > 0),
    );

    setFamilyMembers(nextMembers);
    setMembersNotInTree(nextMembersNotInTree);
    setTreeAllPeople(normalizedPeople);
    setMemberIdsInTree(ids);

    await fetchNonAppUsers();
  };
  const fetchNonAppUsers = async () => {
    if (!birthFamilyCode) return;
    try {
      setLoadingNonAppUsers(true);
      const response = await authFetch('/family/member/' + birthFamilyCode + '/non-app-users', { method: 'GET' });
      setNonAppUsers(Array.isArray(response?.data) ? response.data : []);
    } catch (error) {
      logger.error('Failed to load non-app users', error);
      setNonAppUsers([]);
    } finally {
      setLoadingNonAppUsers(false);
    }
  };

  const getReplacementKey = (dummy) => {
    if (dummy?.isStructuralDummy) {
      return `slot:${Number(dummy?.personId || 0)}`;
    }
    return `dummy:${Number(dummy?.dummyUserId || 0)}`;
  };

  const handleReplaceDummy = async (dummy) => {
    const replacementKey = getReplacementKey(dummy);
    const replacementUserId = Number(replacementSelections?.[replacementKey] || 0);
    const dummyUserId = Number(dummy?.dummyUserId || 0);
    const personId = Number(dummy?.personId || 0);

    if (!birthFamilyCode || !replacementUserId) return;

    try {
      setReplacingDummyIds((prev) => new Set(prev).add(replacementKey));
      if (dummy?.isStructuralDummy) {
        if (!personId) {
          throw new Error('Removed-member slot is missing a tree person id.');
        }
        await replaceStructuralDummySlot(personId, birthFamilyCode, replacementUserId);
      } else {
        if (!dummyUserId) {
          throw new Error('Dummy user id is missing.');
        }
        await replaceDummyUser(birthFamilyCode, dummyUserId, replacementUserId);
      }
      await refreshFamilyManagementState();
    } catch (error) {
      logger.error('Failed to replace dummy user', error);
      await Swal.fire({ icon: 'error', title: 'Replace Failed', text: error?.message || 'Unable to replace this dummy user right now.' });
    } finally {
      setReplacingDummyIds((prev) => {
        const next = new Set(prev);
        next.delete(replacementKey);
        return next;
      });
    }
  };
  const handleShareInvite = async (member, event) => {
    event?.stopPropagation?.();
    const inviteLink = window.location.origin + '/edit-profile?familyCode=' + encodeURIComponent(birthFamilyCode) + '&memberId=' + member.memberId;
    try {
      if (navigator?.share) {
        await navigator.share({ title: 'Join our family tree', url: inviteLink });
        return;
      }
      await navigator.clipboard.writeText(inviteLink);
      await Swal.fire({ icon: 'success', title: 'Invite Copied', text: 'The family invite link has been copied.' });
    } catch (error) {
      logger.error('Failed to share invite', error);
    }
  };
  const handleDeleteMember = async (memberId, targetFamilyCode, memberUserId, event) => {
    event?.stopPropagation?.();
    if (!memberId || !birthFamilyCode) return;
    const isSelf = Number(memberUserId) === Number(currentUser?.userId || currentUser?.id);
    try {
      if (isSelf) {
        await selfRemoveFromFamily(birthFamilyCode);
        window.location.reload();
        return;
      }

      await deleteFamilyMember(memberId, targetFamilyCode || birthFamilyCode);
      setDeletedMemberIds((prev) => new Set(prev).add(memberId));
      await refreshFamilyManagementState();
    } catch (error) {
      logger.error('Failed to delete family member', error);
      await Swal.fire({ icon: 'error', title: 'Action Failed', text: error?.message || 'Unable to update this family member right now.' });
    }
  };
  const filteredMembers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return familyMembers;
    return familyMembers.filter((member) =>
      [member?.name, member?.sourceFamilyCode, member?.role]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [familyMembers, searchTerm]);

  const birthFamilyMembers = useMemo(
    () => filteredMembers.filter((member) => member.membershipType === 'member'),
    [filteredMembers],
  );

  const birthFamilyMemberUserIds = useMemo(
    () => new Set(
      birthFamilyMembers
        .map((member) => Number(member?.userId || 0))
        .filter((userId) => userId > 0),
    ),
    [birthFamilyMembers],
  );

  const associatedMembersAll = useMemo(
    () => filteredMembers.filter(
      (member) => member.membershipType === 'associated' && !birthFamilyMemberUserIds.has(Number(member?.userId || 0)),
    ),
    [filteredMembers, birthFamilyMemberUserIds],
  );

  const linkedMembersAll = useMemo(
    () => filteredMembers.filter(
      (member) => member.membershipType === 'linked' && !birthFamilyMemberUserIds.has(Number(member?.userId || 0)),
    ),
    [filteredMembers, birthFamilyMemberUserIds],
  );

  const buildFamilyOptions = (members) => {
    const map = new Map();
    members.forEach((member) => {
      const code = normalizeFamilyCode(member?.sourceFamilyCode);
      if (!code) return;
      if (!map.has(code)) {
        map.set(code, { familyCode: code, familyName: code });
      }
    });
    return Array.from(map.values());
  };

  const associatedFamiliesOptions = useMemo(
    () => buildFamilyOptions(associatedMembersAll),
    [associatedMembersAll],
  );

  const linkedFamiliesOptions = useMemo(
    () => buildFamilyOptions(linkedMembersAll),
    [linkedMembersAll],
  );

  const privacyFamilyOptions = useMemo(() => {
    const options = [];
    const seen = new Set();

    const pushOption = (familyCode, familyName, group) => {
      const normalizedCode = normalizeFamilyCode(familyCode);
      if (!normalizedCode || seen.has(normalizedCode)) return;
      seen.add(normalizedCode);
      options.push({
        familyCode: normalizedCode,
        familyName: String(familyName || normalizedCode).trim() || normalizedCode,
        group,
      });
    };

    if (birthFamilyCode) {
      pushOption(birthFamilyCode, birthFamilyCode, 'Birth Family');
    }

    associatedFamiliesOptions.forEach((family) => {
      pushOption(
        family.familyCode,
        associatedFamilyNameMap?.[family.familyCode] || family.familyName || family.familyCode,
        'Associated Family',
      );
    });

    linkedFamiliesOptions.forEach((family) => {
      pushOption(
        family.familyCode,
        linkedFamilyNameMap?.[family.familyCode] || family.familyName || family.familyCode,
        'Linked Family',
      );
    });

    return options;
  }, [
    associatedFamiliesOptions,
    associatedFamilyNameMap,
    birthFamilyCode,
    linkedFamiliesOptions,
    linkedFamilyNameMap,
  ]);

  useEffect(() => {
    if (!selectedAssociatedFamilyCode && associatedFamiliesOptions.length > 0) {
      setSelectedAssociatedFamilyCode(associatedFamiliesOptions[0].familyCode);
    }
  }, [selectedAssociatedFamilyCode, associatedFamiliesOptions]);

  useEffect(() => {
    if (!selectedLinkedFamilyCode && linkedFamiliesOptions.length > 0) {
      setSelectedLinkedFamilyCode(linkedFamiliesOptions[0].familyCode);
    }
  }, [selectedLinkedFamilyCode, linkedFamiliesOptions]);

  useEffect(() => {
    setSelectedAssociatedFamilyMembersAll(associatedMembersAll);
  }, [associatedMembersAll]);

  useEffect(() => {
    setSelectedLinkedFamilyMembersAll(linkedMembersAll);
    setLinkedFamilies(linkedFamiliesOptions);
  }, [linkedMembersAll, linkedFamiliesOptions]);

  useEffect(() => {
    setTreeLinkedFamilyMap(
      linkedMembersAll
        .filter((member) => memberIdsInTree.has(Number(member.userId)))
        .reduce((acc, member) => {
          const code = normalizeFamilyCode(member.sourceFamilyCode);
          if (!code) return acc;
          if (!acc[code]) acc[code] = [];
          acc[code].push(member);
          return acc;
        }, {}),
    );
  }, [linkedMembersAll, memberIdsInTree]);

  const currentUserIsFamilyAdmin = useMemo(() => {
    const currentUserId = Number(currentUser?.userId || currentUser?.id);
    return familyMembers.some(
      (member) =>
        Number(member.userId) === currentUserId &&
        (member.isFamilyAdmin || member.role === 'Admin' || member.role === 'Superadmin'),
    );
  }, [familyMembers, currentUser?.userId, currentUser?.id]);

  const membersNotInTreeUserIds = useMemo(() => {
    return new Set(
      (membersNotInTree || [])
        .map((m) => Number(m?.userId || m?.memberId || 0))
        .filter((id) => Number.isFinite(id) && id > 0),
    );
  }, [membersNotInTree]);

  const replacementCandidates = useMemo(() => {
    const seenUserIds = new Set();
    return (membersNotInTree || []).reduce((acc, member) => {
      const candidateUserId = Number(member?.userId || member?.memberId || member?.user?.id || 0);
      if (
        !candidateUserId ||
        !member?.user?.isAppUser ||
        member?.blockStatus?.isBlockedByMe ||
        seenUserIds.has(candidateUserId)
      ) {
        return acc;
      }

      seenUserIds.add(candidateUserId);
      acc.push(member);
      return acc;
    }, []);
  }, [membersNotInTree]);

  const filteredMembersNotInTree = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return membersNotInTree;
    return membersNotInTree.filter((member) =>
      String(member?.name || '').toLowerCase().includes(query),
    );
  }, [membersNotInTree, searchTerm]);

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
              {showNotInTreeBadge && member.membershipType === 'member' && membersNotInTreeUserIds.has(Number(member.userId)) && (
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
                {allowDelete && member.membershipType === 'member' && currentUser?.userId !== member.userId && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteMember(member.memberId, familyCode, member.userId, e);
                    }}
                    disabled={deletedMemberIds.has(member.memberId)}
                    className="p-1.5 rounded-lg bg-gray-50 text-gray-500 hover:bg-red-50 hover:text-red-600 hover:shadow-sm border border-transparent hover:border-red-100 transition-all tooltip"
                    title={memberIdsInTree.has(Number(member.userId)) && member.sourceFamilyCode === birthFamilyCode && member.user?.isAppUser ? 'Move to Members Not in Tree' : 'Delete'}
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
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 px-6 py-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Privacy Settings</h2>
            <p className="text-sm text-primary-100 mt-1">
              Choose whether your family-only posts, galleries, and events are visible to all connected families or only to selected families.
            </p>
          </div>
          <button
            type="button"
            onClick={handleSavePrivacySettings}
            disabled={isSavingPrivacySettings}
            className={
              'flex items-center gap-2 px-5 py-2.5 bg-white text-primary-700 font-semibold rounded-lg transition-all shadow-lg ' +
              (isSavingPrivacySettings ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-50')
            }
          >
            {isSavingPrivacySettings ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[
          { key: 'posts', label: 'Posts', icon: '📝', desc: 'Family-only posts and status updates' },
          { key: 'albums', label: 'Gallery', icon: '📷', desc: 'Family-only albums and gallery items' },
          { key: 'events', label: 'Events', icon: '📅', desc: 'Family-only events and celebrations' },
        ].map((entry) => {
          const setting = privacySettings?.[entry.key] || { visibility: 'all-members', familyCodes: [] };
          const selectedCodes = Array.isArray(setting.familyCodes) ? setting.familyCodes : [];

          return (
            <div key={entry.key} className="rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow">
              <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/50 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{entry.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{entry.label}</h3>
                    <p className="text-xs text-gray-500">{entry.desc}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <p className="text-xs font-semibold tracking-wide uppercase text-gray-500 mb-2">Visibility</p>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-gray-100 p-1">
                    <button
                      type="button"
                      onClick={() => updatePrivacySetting(entry.key, { visibility: 'all-members', familyCodes: [] })}
                      className={
                        'rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
                        (setting.visibility === 'all-members'
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900')
                      }
                    >
                      All Members
                    </button>
                    <button
                      type="button"
                      onClick={() => updatePrivacySetting(entry.key, { visibility: 'specific-family' })}
                      className={
                        'rounded-lg px-3 py-2 text-sm font-semibold transition-all ' +
                        (setting.visibility === 'specific-family'
                          ? 'bg-white text-primary-600 shadow-sm'
                          : 'text-gray-600 hover:text-gray-900')
                      }
                    >
                      Specific Families
                    </button>
                  </div>
                </div>

                {setting.visibility === 'all-members' ? (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4">
                    <p className="text-sm font-semibold text-gray-900">All connected families can view this family content</p>
                    <p className="mt-1 text-xs text-gray-500">
                      This includes your birth family plus linked and associated families that already have access to your family network.
                    </p>
                  </div>
                ) : (
                  <div>
                    <p className="text-xs font-semibold tracking-wide uppercase text-gray-500 mb-2">Select Families</p>
                    <div className="space-y-2">
                      {privacyFamilyOptions.map((family) => {
                        const isSelected = selectedCodes.includes(family.familyCode);
                        return (
                          <button
                            key={entry.key + '-' + family.familyCode}
                            type="button"
                            onClick={() => togglePrivacyFamilyCode(entry.key, family.familyCode)}
                            className={
                              'w-full text-left rounded-xl border px-4 py-3 transition-all ' +
                              (isSelected
                                ? 'border-primary-300 bg-primary-50 shadow-sm'
                                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50')
                            }
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-gray-900">{family.familyName}</p>
                                <p className="text-xs text-gray-500">{family.group} · {family.familyCode}</p>
                              </div>
                              <span
                                className={
                                  'inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs font-bold ' +
                                  (isSelected
                                    ? 'border-primary-600 bg-primary-600 text-white'
                                    : 'border-gray-300 text-transparent')
                                }
                              >
                                ✓
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-gray-500">
                      {selectedCodes.length > 0
                        ? selectedCodes.length + ' family code' + (selectedCodes.length > 1 ? 's are' : ' is') + ' selected.'
                        : 'No family selected yet. Until you select a family, only you will be able to view this family content.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

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
                {/* Desktop Tabs - Hidden on Mobile */}
                <div className="hidden sm:flex min-w-0 items-center gap-2 overflow-x-auto scrollbar-hide">
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

                {/* Mobile Dropdown - Hidden on Desktop */}
                <div className="sm:hidden flex-1 relative" ref={tabDropdownRef}>
                  <button
                    onClick={() => setIsTabDropdownOpen(!isTabDropdownOpen)}
                    className="w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-semibold text-gray-700 shadow-sm"
                  >
                    <span className="flex items-center gap-2">
                      {TABS.find(tab => tab.id === activeTab)?.label}
                      {TABS.find(tab => tab.id === activeTab)?.count !== null && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] tracking-wide font-bold bg-primary-100 text-primary-600">
                          {TABS.find(tab => tab.id === activeTab)?.count}
                        </span>
                      )}
                    </span>
                    <svg 
                      className={`w-4 h-4 text-gray-500 transition-transform ${isTabDropdownOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  
                  {isTabDropdownOpen && (
                    <div className="absolute z-50 mt-1 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                      {TABS.map((tab) => (
                        <button
                          key={tab.id}
                          onClick={() => {
                            setActiveTab(tab.id);
                            setIsTabDropdownOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium transition-colors ${
                            activeTab === tab.id 
                              ? 'bg-primary-50 text-primary-700' 
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          <span>{tab.label}</span>
                          {tab.count !== null && (
                            <span className={`px-2 py-0.5 rounded-md text-[10px] tracking-wide font-bold ${
                              activeTab === tab.id ? 'bg-primary-200 text-primary-800' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {tab.count}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
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
                        <h3 className="text-lg font-bold text-gray-900">Non-App Users And Removed Slots</h3>
                        <p className="text-sm text-gray-500">
                          Replace non-app users and removed-member slots with active app members not already placed in the tree.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          refreshFamilyManagementState().catch((error) => {
                            logger.error('Failed to refresh replacement section', error);
                          });
                        }}
                        className="inline-flex items-center justify-center px-3 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Refresh
                      </button>
                    </div>

                    {loadingNonAppUsers ? (
                      <div className="py-8 text-sm text-gray-500">Loading non-app users...</div>
                    ) : nonAppUsers.length === 0 ? (
                      <div className="py-8 text-sm text-gray-500 bg-gray-50 rounded-lg border border-gray-100 px-4">
                        No non-app users or removed-member slots found in this family tree.
                      </div>
                    ) : (
                      <div className="flex flex-col gap-3">
                        {nonAppUsers.map((dummy) => {
                          const dummyUserId = Number(dummy?.dummyUserId);
                          const replacementKey = getReplacementKey(dummy);
                          const selectedReplacement = Number(replacementSelections?.[replacementKey] || 0);
                          const isReplacing = replacingDummyIds.has(replacementKey);
                          return (
                            <div key={`dummy-${replacementKey}`} className="rounded-lg border border-gray-200 p-4 bg-gray-50/40">
                              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                                <div>
                                  <div className="flex flex-wrap items-center gap-2">
                                    <p className="text-sm font-semibold text-gray-900">
                                      {dummy?.name || 'Familyss User'}
                                    </p>
                                    {dummy?.isStructuralDummy && (
                                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">
                                        Removed Slot
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-gray-500">
                                    Dummy ID: {dummyUserId} | Node: {dummy?.nodeUid || '-'} | Generation: {dummy?.generation ?? '-'}
                                  </p>
                                  {dummy?.isStructuralDummy && (
                                    <p className="mt-1 text-xs text-amber-700">
                                      This slot came from a removed family member and can be filled directly from here.
                                    </p>
                                  )}
                                </div>
                                <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
                                  <select
                                    value={selectedReplacement || ''}
                                    onChange={(e) => {
                                      const nextValue = Number(e.target.value || 0);
                                      setReplacementSelections((prev) => ({
                                        ...prev,
                                        [replacementKey]: nextValue || '',
                                      }));
                                    }}
                                    className="min-w-[220px] rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700"
                                  >
                                    <option value="">Select replacement member</option>
                                    {replacementCandidates.map((candidate) => (
                                      <option key={`replace-${replacementKey}-${candidate.userId}`} value={candidate.userId}>
                                        {candidate.name} (#{candidate.userId})
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    onClick={() => handleReplaceDummy(dummy)}
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






