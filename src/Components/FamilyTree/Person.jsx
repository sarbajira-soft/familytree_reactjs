import React, { useEffect, useMemo, useRef, useState } from 'react';
import RelationshipCalculator from '../../utils/relationshipCalculator';
import { useFamilyTreeLabels } from '../../Contexts/FamilyTreeContext';
import { useUser } from '../../Contexts/UserContext';
import { useTheme } from '../../Contexts/ThemeContext';
import { FiEye, FiShare2, FiMoreVertical, FiUserX, FiUserCheck } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { useNavigate, useParams } from 'react-router-dom';
import { getToken } from '../../utils/auth';
import { Mars, Venus } from 'lucide-react';
import { FaFemale, FaMale } from 'react-icons/fa';

// Helper function to get inverse/opposite relationship code
const getInverseRelationship = (relationshipCode) => {
    if (!relationshipCode || relationshipCode === 'SELF') return relationshipCode;
    

    

    // Mapping of relationships to their inverses
    const inverseMap = {
        // Spouse relationships (opposite gender)
        'H': 'W',
        'W': 'H',
        
        // Parent-child relationships (opposite direction)
        'F': 'S',  // Father -> Son (from child's perspective, father becomes son)
        'M': 'D',  // Mother -> Daughter (from child's perspective, mother becomes daughter)
        'S': 'F',  // Son -> Father
        'D': 'M',  // Daughter -> Mother
        
        // Sibling relationships (opposite gender, same age order)
        'B+': 'Z+', // Elder brother -> Elder sister
        'B-': 'Z-', // Younger brother -> Younger sister
        'Z+': 'B+', // Elder sister -> Elder brother
        'Z-': 'B-', // Younger sister -> Younger brother
        'B': 'Z',   // Brother -> Sister
        'Z': 'B',   // Sister -> Brother
    };
    
    // Parse the relationship code into components
    const components = [];
    let i = 0;
    
    while (i < relationshipCode.length) {
        let char = relationshipCode[i];
        let nextChar = relationshipCode[i + 1];
        
        // Check for two-character codes (like B+, B-, Z+, Z-)
        if (nextChar === '+' || nextChar === '-') {
            components.push(char + nextChar);
            i += 2;
        } else {
            // Single character code
            components.push(char);
            i += 1;
        }
    }
    
    // Inverse each component
    const inversedComponents = components.map(comp => inverseMap[comp] || comp);
    
    // Reverse the order for complex paths
    // Example: "FB+" (Father's elder brother) becomes "Z+S" (Elder sister's son)
    // This is because from the uncle's perspective, you are his sibling's child
    inversedComponents.reverse();
    
    const result = inversedComponents.join('');
    console.log(` Inverse relationship: ${relationshipCode} → ${result} (components: ${components.join(',')} → ${inversedComponents.join(',')})`);
    
    return result;
};

// Helper function to get proper gender label
const getGenderLabel = (person, tree, currentUserId) => {
    if (!person.gender || person.gender === 'unknown' || person.gender === '') return '';
    
    // Check if this person is a spouse of the current user
    const isSpouseOfCurrentUser = () => {
        if (!tree || !currentUserId) return false;
        
        // Find current user in tree
        const currentUser = Array.from(tree.people.values()).find(p => 
            p.memberId === currentUserId || p.userId === currentUserId
        );
        
        if (!currentUser) return false;
        
        // Check if person is in current user's spouse list
        const spouses = currentUser.spouses instanceof Set 
            ? Array.from(currentUser.spouses)
            : Array.isArray(currentUser.spouses) 
            ? currentUser.spouses 
            : [];
            
        return spouses.includes(person.id);
    };
    
    // If this person is a spouse, use H/W labels
    if (isSpouseOfCurrentUser()) {
        return person.gender.toLowerCase() === 'male' ? 'H' : 
               person.gender.toLowerCase() === 'female' ? 'W' : '';
    }
    
    // For non-spouses, use standard gender labels
    const normalizedGender = person.gender.toLowerCase().trim();
    switch (normalizedGender) {
        case 'male':
        case 'm':
            return 'M';
        case 'female':
        case 'f':
            return 'F';
        case 'unknown':
        case '':
        case 'man': // Handle 'MAN' case
        case 'woman':
            return '';
        default:
            // Don't show raw gender values like 'MAN' - return empty for unknown values
            return '';
    }
};

const Person = ({ person, isRoot, onClick, rootId, tree, language, isNew, isSelected, isHighlighted, isSearchResult, currentUserId, currentFamilyId, viewOnly, sourceRelationship }) => {
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    // Dynamic sizing based on tree size
    const memberCount = tree ? tree.people.size : 0;
    const { userInfo } = useUser();
    const { code } = useParams(); // Get current family code from URL
    const navigate = useNavigate();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const effectiveViewOnly = viewOnly || typeof onClick !== 'function';
    const isAdmin = !!(userInfo && (userInfo.role === 2 || userInfo.role === 3));
    const canShare = !!person.memberId;
    const canShowAdminMenu = isAdmin && !!person.memberId;
    const currentFamilyCode = code || userInfo?.familyCode || person.familyCode || '';
    const isSelf = !!(person.memberId && userInfo?.userId && person.memberId === userInfo.userId);
    const isBlocked = !!person.isBlocked;
    const isDeleted = !!person?.isDeleted;
    const canShowBlockAction = canShowAdminMenu && !isSelf && !isRoot;
    const canShowMoreActionsButton = canShowAdminMenu && canShowBlockAction;
    const menuRef = useRef(null);

    // Get source relationship from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const urlSourceRelationship = urlParams.get('source');
    
    const cardDimensions = useMemo(() => {
        const isMobile = window.innerWidth <= 640; // Tailwind sm breakpoint
        
        if (memberCount > 100) {
            // Compact for very large trees
            return {
                width: isMobile ? 120 : 170,
                height: isMobile ? 125 : 165,
                fontSizeName: isMobile ? 12 : 14,
                fontSizeDetails: isMobile ? 10 : 11,
                fontSizeRelationship: isMobile ? 10 : 11,
                profileSize: isMobile ? 70 : 90,
                padding: '0px',
                margin: '2px'
            };
        } else if (memberCount > 50) {
            // Medium trees
            return {
                width: isMobile ? 130 : 180,
                height: isMobile ? 135 : 175,
                fontSizeName: isMobile ? 13 : 15,
                fontSizeDetails: isMobile ? 11 : 12,
                fontSizeRelationship: isMobile ? 11 : 12,
                profileSize: isMobile ? 75 : 95,
                padding: '0px',
                margin: '3px'
            };
        } else {
            // Small trees - Premium
            return {
                width: isMobile ? 140 : 190,
                height: isMobile ? 145 : 185,
                fontSizeName: isMobile ? 12 : 14,
                fontSizeDetails: isMobile ? 12 : 13,
                fontSizeRelationship: isMobile ? 12 : 14,
                profileSize: isMobile ? 80 : 100,
                padding: '0px',
                margin: isMobile ? '3px' : '5px'
            };
        }
    }, [memberCount]);

    const { width, height, fontSizeName, fontSizeDetails, fontSizeRelationship, profileSize, padding, margin } = cardDimensions;
    
    const ageText = person.age ? ` (Age: ${person.age})` : '';
    const isRemembering = person.lifeStatus === 'remembering';

    // Calculate relationship code to root (memoized for performance)
    const relationshipCode = useMemo(() => {
        if (!isRoot && rootId && tree) {
            const calculator = new RelationshipCalculator(tree);
            const rel = calculator.calculateRelationship(rootId, person.id);
            if (rel && rel.relationshipCode) {
                console.log(` Relationship for ${person.name}: ${rel.relationshipCode}`);
                return rel.relationshipCode;
            }
        }
        return '';
    }, [isRoot, rootId, tree, person.id]);

    // Determine if we're viewing birth family or associated family
    const isViewingBirthFamily = useMemo(() => {
        // If no code in URL, we're viewing user's birth family
        if (!code) return true;
        // If code matches user's birth family code, we're viewing birth family
        if (code === userInfo?.familyCode) return true;
        // Otherwise, we're viewing an associated family
        return false;
    }, [code, userInfo?.familyCode]);

    // Enhanced relationship code display with proper family context
    const displayRelationshipCode = useMemo(() => {
        if (!relationshipCode) return '';
        
        // For birth family: show normal codes (F, M, B+, B-, etc.)
        if (isViewingBirthFamily) {
            return relationshipCode;
        }
        
        // For associated family: use the source relationship from URL or prop
        // If viewing from SS (Son's Son), all codes should be ASS+[original]
        // If viewing from M (Mother), all codes should be AM+[original]
        // If viewing from F (Father), all codes should be AF+[original]
        
        const sourceRel = urlSourceRelationship || sourceRelationship;
        if (sourceRel) {
            return `A${sourceRel}+${relationshipCode}`;
        }

        return relationshipCode;
    }, [relationshipCode, isViewingBirthFamily, urlSourceRelationship, sourceRelationship]);

    // Use context to get label - use displayRelationshipCode for translation consistency
    const { getLabel, refreshLabels } = useFamilyTreeLabels();
    const relationshipText = useMemo(() => {
        if (!displayRelationshipCode) return '';

        const primaryText = getLabel(displayRelationshipCode);

        // If the prefixed association key has no label, getLabel falls back to the key itself.
        // In that case, fall back to the base relationshipCode label.
        if (
            !isViewingBirthFamily &&
            relationshipCode &&
            primaryText === displayRelationshipCode
        ) {
            return getLabel(relationshipCode);
        }

        return primaryText;
    }, [displayRelationshipCode, getLabel, isViewingBirthFamily, relationshipCode]);

    // Inline edit state for relationship label
    const [isEditingLabel, setIsEditingLabel] = useState(false);
    const [editLabelValue, setEditLabelValue] = useState('');

    // Handler to start editing
    const handleEditLabelClick = (e) => {
        e.stopPropagation();
        setEditLabelValue(relationshipText);
        setIsEditingLabel(true);
    };

    // Handler to save label
    const handleSaveLabel = async (e) => {
        e.stopPropagation();
        if (!currentUserId || !currentFamilyId) {
            Swal.fire({ icon: 'warning', title: 'Missing info', text: 'User ID or Family Code missing. Cannot save label.' });
            return;
        }
        const apiLanguage = language === 'tamil' ? 'ta' : language;
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        try {
            await fetch(`${baseUrl}/custom-labels`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    relationshipKey: displayRelationshipCode,
                    language: apiLanguage,
                    custom_label: editLabelValue,
                    creatorId: currentUserId, // FIXED: use correct param name
                    familyCode: currentFamilyId, // FIXED: use correct param name
                    scope: 'user', // or 'family'/'global' as needed
                    gender: userInfo?.gender
                })           
            });
            if (refreshLabels) refreshLabels();
            setIsEditingLabel(false);
            Swal.fire({ icon: 'success', title: 'Saved', text: 'Label saved successfully.' });
        } catch (err) {
            Swal.fire({ icon: 'error', title: 'Save failed', text: 'Failed to save label.' });
        }
    };

    // Handler to cancel editing
    const handleCancelEdit = (e) => {
        e.stopPropagation();
        setIsEditingLabel(false);
    };

    useEffect(() => {
      if (!isMenuOpen) return;

      function handleClickOutside(event) {
        if (menuRef.current && !menuRef.current.contains(event.target)) {
          setIsMenuOpen(false);
        }
      }

      document.addEventListener("mousedown", handleClickOutside, true);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside, true);
      };
    }, [isMenuOpen]);

    const handleCardClick = (e) => {
        // Only trigger onClick if the click is not on the radial menu button
        if (!e.target.closest('.radial-menu-button')) {
            onClick(person.id);
        }
    };

    const handleRadialMenuClick = (e) => {
        e.stopPropagation();
        onClick(person.id);
    };

    const handleShareClick = async (e) => {
        e.stopPropagation();

        if (!person.memberId || !currentFamilyCode) {
            await Swal.fire({
                icon: 'warning',
                title: 'Cannot share link',
                text: 'Family or member information is missing for this person.',
            });
            return;
        }

        const inviteUrl = `${window.location.origin}/edit-profile?familyCode=${currentFamilyCode}&memberId=${person.memberId}`;

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
            console.error('Error sharing invite link from tree node:', err);
            await Swal.fire({
                icon: 'error',
                title: 'Share Failed',
                text: 'Unable to share the invite link. Please try again.',
            });
        }
    };

    const handleToggleBlock = async (e, shouldBlock) => {
        e.stopPropagation();

        if (!person.memberId || !currentFamilyCode) {
            await Swal.fire({
                icon: 'warning',
                title: 'Cannot update member',
                text: 'Family or member information is missing for this person.',
            });
            return;
        }

        const token = getToken();
        if (!token) {
            await Swal.fire({
                icon: 'warning',
                title: 'Session expired',
                text: 'Please log in again to manage family members.',
            });
            return;
        }

        const actionLabel = shouldBlock ? 'block' : 'unblock';
        const confirm = await Swal.fire({
            icon: 'warning',
            title: `Are you sure you want to ${actionLabel} this member?`,
            text: shouldBlock
                ? 'They will no longer be able to view or edit this family tree and members.'
                : 'They will regain access to this family.',
            showCancelButton: true,
            confirmButtonText: `Yes, ${actionLabel}`,
            cancelButtonText: 'Cancel',
            confirmButtonColor: shouldBlock ? '#e53e3e' : '#16a34a',
        });

        if (!confirm.isConfirmed) return;

        try {
            const endpoint = shouldBlock ? 'block' : 'unblock';
            const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/family/member/${endpoint}/${person.memberId}/${currentFamilyCode}`;
            const res = await fetch(apiUrl, {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
            });

            const json = await res.json().catch(() => null);

            if (!res.ok) {
                const msg = json?.message || `Failed to ${actionLabel} member`;
                throw new Error(msg);
            }

            await Swal.fire({
                icon: 'success',
                title: `Member ${shouldBlock ? 'Blocked' : 'Unblocked'}`,
                text: json?.message || `Family member has been ${shouldBlock ? 'blocked' : 'unblocked'} successfully.`,
            });

            setIsMenuOpen(false);
            window.location.reload();
        } catch (err) {
            console.error(`Error trying to ${actionLabel} member from tree node:`, err);
            await Swal.fire({
                icon: 'error',
                title: 'Action Failed',
                text: err.message || `Unable to ${actionLabel} this member. Please try again.`,
            });
        }
    };

    const handleMenuToggle = (e) => {
        e.stopPropagation();
        setIsMenuOpen((prev) => !prev);
    };

    // Determine if this person has an associated family tree
    const getAssociatedCodes = () => {
        let codes = [];
        if (Array.isArray(person.associatedFamilyCodes)) {
            codes = person.associatedFamilyCodes.filter(code => code && !code.startsWith('REL_'));
        } else if (typeof person.associatedFamilyCodes === 'string' && person.associatedFamilyCodes) {
            try {
                const arr = JSON.parse(person.associatedFamilyCodes);
                if (Array.isArray(arr)) codes = arr.filter(code => code && !code.startsWith('REL_'));
            } catch {
                if (!person.associatedFamilyCodes.startsWith('REL_')) codes = [person.associatedFamilyCodes];
            }
        }
        return Array.from(new Set(codes));
    };

    // Check if person has spouse relationships
    const hasSpouse = () => {
        if (!person.spouses) return false;
        
        // Handle different spouse data formats
        const spouses = person.spouses instanceof Set 
            ? Array.from(person.spouses)
            : Array.isArray(person.spouses) 
            ? person.spouses 
            : [];
            
        return spouses.length > 0;
    };

    const getNavigationTargetFamilyCode = () => {
        const currentViewFamilyCode = code || userInfo?.familyCode || '';
        const personBirthFamilyCode = person.primaryFamilyCode || person.familyCode || '';

        // Prefer explicit birth family if it differs from the currently viewed family tree
        if (personBirthFamilyCode && personBirthFamilyCode !== currentViewFamilyCode) {
            return personBirthFamilyCode;
        }

        return null;
    };

    const navigationTargetFamilyCode = getNavigationTargetFamilyCode();
    const hasAssociatedTree = !!navigationTargetFamilyCode;

    // Enhanced handler with comprehensive family code validation
    const handleViewPersonBirthFamily = (e) => {
        e.stopPropagation();
        
        const personFamilyCode = navigationTargetFamilyCode;
        
        // Validation 1: Check if person has a family code
        if (!personFamilyCode) {
            Swal.fire({
                icon: 'info',
                title: 'No Family Tree Found',
                text: 'This member does not have a family tree available.',
                confirmButtonColor: '#3f982c',
            });
            return;
        }
        
        // Validation 2: Check if already viewing this person's family tree (current URL)
        if (code === personFamilyCode) {
            Swal.fire({
                icon: 'info',
                title: 'Already Viewing',
                text: `You are already viewing ${person.name}'s family tree.`,
                confirmButtonColor: '#3f982c',
            });
            return;
        }
        
        // All validations passed - proceed with navigation
        console.log(` Navigation allowed: ${person.name} (${personFamilyCode}) → Current: ${code} → User: ${userInfo?.familyCode}`);
        
        // Determine focus and source based on relationship type.
        // Focus must be the clicked person (the one whose family tree is opened).
        const focusUserId = person.memberId || person.userId;
        const focusName = person?.name ? String(person.name).trim() : '';
        let sourceCode = null;

        if (relationshipCode && (relationshipCode.endsWith('H') || relationshipCode.endsWith('W'))) {
            // For single-letter spouse codes (H/W), slice would produce an empty string.
            // In that case, keep the code itself so association prefixing works (A{source}+...).
            sourceCode = relationshipCode.length > 1 ? relationshipCode.slice(0, -1) : relationshipCode;
        } else if (relationshipCode) {
            sourceCode = getInverseRelationship(relationshipCode);
        }

        const queryParams = {};

        if (focusUserId) {
            queryParams.focus = String(focusUserId);
        }

        if (focusName) {
            queryParams.focusName = focusName;
        }
        
        if (sourceCode) {
            queryParams.source = sourceCode;
        }
        
        const query = new URLSearchParams(queryParams).toString();
        
        navigate(`/family-tree/${personFamilyCode}?${query}`);
    };

    // Optimize rendering for large trees
    const isLargeTree = memberCount > 50;
    const cardOpacity = isLargeTree ? 0.95 : 1;
    const shadowIntensity = isLargeTree ? 0.05 : 0.08;

    const cardBackground = useMemo(() => {
        if (!isDark) {
            return isRoot
                ? "linear-gradient(135deg, #fef2f2 0%, #ffe4e6 50%, #fce7f3 100%)"
                : isNew
                ? "linear-gradient(135deg, #f0f9ff 0%, #dbeafe 50%, #e0f2fe 100%)"
                : person.gender === "male"
                ? "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)"
                : person.gender === "female"
                ? "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)"
                : "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)";
        }

        return isRoot
            ? "linear-gradient(135deg, rgb(2 6 23) 0%, rgb(15 23 42) 45%, rgb(30 41 59) 100%)"
            : isNew
            ? "linear-gradient(135deg, rgb(2 6 23) 0%, rgba(14, 165, 233, 0.12) 55%, rgb(15 23 42) 100%)"
            : person.gender === "male"
            ? "linear-gradient(135deg, rgb(2 6 23) 0%, rgba(14, 165, 233, 0.14) 100%)"
            : person.gender === "female"
            ? "linear-gradient(135deg, rgb(2 6 23) 0%, rgba(244, 114, 182, 0.14) 100%)"
            : "linear-gradient(135deg, rgb(2 6 23) 0%, rgb(15 23 42) 100%)";
    }, [isDark, isRoot, isNew, person.gender]);

    return (
      <div
        id={`person-${person.id}`}
        className="person-container"
        style={{
          position: "absolute",
          left: `${person.x - width / 2}px`,
          top: `${person.y - height / 2}px`,
          zIndex: 10,
          opacity: isDeleted ? 0.15 : 1,
          filter: isDeleted ? 'grayscale(100%)' : undefined,
          pointerEvents: isDeleted ? 'none' : 'auto',
        }}
      >
        {/* Main Person Card */}
        <div
          className={`person ${person.gender} ${isRoot ? "root" : ""} ${
            isNew ? "person-new" : ""
          } ${isSelected ? "person-selected" : ""} ${
            person.lifeStatus === "remembering" ? "remembering" : ""
          } ${isHighlighted ? "person-highlighted" : ""} ${
            isSearchResult ? "person-search-result" : ""
          } group transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:ring-4 hover:ring-green-200`}
          style={{
            position: "relative",
            minWidth: width,
            maxWidth: memberCount > 50 ? 200 : 250,
            width: width, // Fixed width instead of fit-content
            minHeight: height,
            height: height, // Fixed height
            margin: margin,
            padding: padding,
            // borderRadius, display, flexDirection, alignItems, justifyContent defined later with more specific logic
            opacity:
              person.lifeStatus === "remembering"
                ? 0.8 * cardOpacity
                : cardOpacity,
            background: cardBackground,
            border: isHighlighted
              ? "3px solid #ec4899" // vibrant pink border for highlighted
              : isSearchResult
              ? "3px solid #06b6d4" // vibrant cyan border for search results
              : isRoot
              ? "3px solid #db2777" // deep pink border for root
              : isNew
              ? "2.5px dashed #0891b2" // vibrant cyan border for new
              : isSelected
              ? "3px solid #ec4899" // vibrant pink border for selected
              : person.gender === "male"
              ? "3px solid #0ea5e9" // vibrant sky blue border for males
              : person.gender === "female"
              ? "3px solid #f472b6" // vibrant pink border for females
              : "3px solid #22d3ee", // vibrant cyan border for others
            borderRadius: memberCount > 50 ? 12 : 18,
            boxShadow: isHighlighted
              ? "0 0 0 4px rgba(236, 72, 153, 0.3), 0 8px 24px rgba(236, 72, 153, 0.25), 0 4px 16px rgba(236, 72, 153, 0.2)" // vibrant pink glow
              : isSearchResult
              ? "0 0 0 4px rgba(6, 182, 212, 0.3), 0 8px 24px rgba(6, 182, 212, 0.25), 0 4px 16px rgba(6, 182, 212, 0.2)" // vibrant cyan glow
              : isRoot
              ? "0 0 0 8px rgba(219, 39, 119, 0.4), 0 0 25px rgba(219, 39, 119, 0.5), 0 0 40px rgba(219, 39, 119, 0.35), 0 12px 32px rgba(219, 39, 119, 0.3)" // premium pink glitter for root
              : isSelected
              ? "0 0 0 4px rgba(236, 72, 153, 0.35), 0 8px 24px rgba(236, 72, 153, 0.3), 0 4px 16px rgba(236, 72, 153, 0.25)" // vibrant pink for selected
              : person.gender === "male"
              ? "0 6px 16px rgba(14, 165, 233, 0.2), 0 3px 8px rgba(14, 165, 233, 0.15)" // vibrant sky blue shadow
              : person.gender === "female"
              ? "0 6px 16px rgba(244, 114, 182, 0.2), 0 3px 8px rgba(244, 114, 182, 0.15)" // vibrant pink shadow
              : "0 6px 16px rgba(34, 211, 238, 0.18), 0 3px 8px rgba(34, 211, 238, 0.12)", // vibrant cyan shadow
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "flex-start",
            zIndex: 2,
            fontFamily: "Poppins, Arial, sans-serif",
            transition: "box-shadow 0.18s, border 0.18s, background 0.18s",
            overflow: "visible",
          }}
          onClick={effectiveViewOnly ? undefined : handleCardClick}
          data-person-id={person.id}
        >
          {/* Family Tree Navigation Icon (simple approach using person.familyCode) */}
          {hasAssociatedTree && (
            <div className="absolute top-1 left-1 flex flex-col items-center z-10">
              <button
                className="w-6 h-6 bg-gradient-to-br from-cyan-50 to-sky-50 hover:from-cyan-100 hover:to-sky-100 text-sky-700 rounded-full flex items-center justify-center shadow-md transition-all duration-200 border-2 border-cyan-400 dark:from-slate-900 dark:to-slate-800 dark:hover:from-slate-800 dark:hover:to-slate-700 dark:text-slate-100 dark:border-slate-600"
                onClick={handleViewPersonBirthFamily}
                title={`Go to ${person.name}'s Family Tree`}
                style={{
                  width: "24px",
                  height: "24px",
                  top: memberCount > 50 ? "0px" : "0px",
                  left: memberCount > 50 ? "0px" : "0px",
                }}
              >
                <FiEye size={16} />
              </button>
            </div>
          )}
          {/* Radial Menu Button - Top Right Corner (hide in viewOnly mode) */}
          {!effectiveViewOnly && (
            <div
              className="absolute flex flex-col items-center space-y-1 z-30"
              style={{
                top: memberCount > 50 ? "2px" : "8px",
                right: memberCount > 50 ? "2px" : "8px",
              }}
            >
              {canShowMoreActionsButton && (
                <div className="relative">
                  <button
                    onClick={handleMenuToggle}
                    className="w-5 h-5 md:w-6 md:h-6 bg-white/90 hover:bg-white text-gray-700 hover:text-gray-900 rounded-full flex items-center justify-center shadow-md border border-gray-200 dark:bg-slate-900/90 dark:hover:bg-slate-900 dark:text-slate-200 dark:hover:text-slate-100 dark:border-slate-700"
                    title="More actions"
                  >
                    <FiMoreVertical size={14} />
                  </button>
                  {isMenuOpen && (
                    <div ref={menuRef} className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 dark:bg-slate-900 dark:border-slate-700">
                      {canShowBlockAction && (
                        <button
                          onClick={(e) => handleToggleBlock(e, !isBlocked)}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 bg-white flex items-center space-x-2 dark:bg-slate-900 dark:text-slate-200"
                        >
                          {isBlocked ? (
                            <>
                              <FiUserCheck
                                size={14}
                                className="text-green-600"
                              />
                              <span>Unblock member</span>
                            </>
                          ) : (
                            <>
                              <FiUserX size={14} className="text-red-600" />
                              <span>Block member</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
              {canShare && (
                <button
                  onClick={handleShareClick}
                  className="w-5 h-5 md:w-6 md:h-6 bg-white/90 hover:bg-white text-sky-600 hover:text-sky-700 rounded-full flex items-center justify-center shadow-md border border-cyan-300 dark:bg-slate-900/90 dark:hover:bg-slate-900 dark:text-sky-300 dark:hover:text-sky-200 dark:border-slate-700"
                  title="Share profile link"
                >
                  <FiShare2 size={14} />
                </button>
              )}
              <button
                className="radial-menu-button w-5 h-5 md:w-6 md:h-6 bg-gradient-to-br from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white rounded-full flex items-center justify-center font-bold text-xs shadow-lg hover:shadow-xl border-2 border-white"
                onClick={handleRadialMenuClick}
                style={{
                  boxShadow: "0 4px 14px rgba(6, 182, 212, 0.45)",
                  width: memberCount > 50 ? "16px" : "24px",
                  height: memberCount > 50 ? "16px" : "24px",
                }}
                title="Add family member"
              >
                +
              </button>
            </div>
          )}
          {/* Profile Picture - Overlapping Top Edge */}
          <div
            className="absolute left-1/2 transform -translate-x-1/2 z-20"
            style={{ top: `-${profileSize / 3}px` }}
          >
            <div className="relative">
              {isRoot && (
                <>
                  <span aria-hidden className="ft-beat-ring ft-beat-ring--a" />
                  <span aria-hidden className="ft-beat-ring ft-beat-ring--b" />
                </>
              )}
              {person.lifeStatus === "remembering" && (
                <span
                  className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] font-semibold px-[6px] py-[1px] rounded-sm rotate-[-12deg] shadow-lg select-none z-30"
                  title="In Loving Memory"
                >
                  ✝
                </span>
              )}
              <div
                className="relative z-20 rounded-full overflow-hidden bg-white border-4 shadow-lg dark:bg-slate-900"
                style={{
                  width: `${profileSize}px`,
                  height: `${profileSize}px`,
                  borderColor: isRoot
                    ? "#db2777"
                    : isSelected
                    ? "#ec4899"
                    : person.gender === "male"
                    ? "#0ea5e9"
                    : person.gender === "female"
                    ? "#f472b6"
                    : "#22d3ee",
                  borderWidth: "4px",
                  boxShadow: isRoot
                    ? "0 0 24px rgba(219, 39, 119, 0.45), 0 6px 16px rgba(219, 39, 119, 0.35)"
                    : isSelected
                    ? "0 0 20px rgba(236, 72, 153, 0.4), 0 6px 14px rgba(236, 72, 153, 0.3)"
                    : person.gender === "male"
                    ? "0 6px 16px rgba(14, 165, 233, 0.25)"
                    : "0 6px 16px rgba(244, 114, 182, 0.25)",
                }}
              >
                <img
                  src={
                    person.imgPreview
                      ? person.imgPreview
                      : typeof person.img === "string" && person.img
                      ? person.img
                      : "https://cdn-icons-png.flaticon.com/512/149/149071.png"
                  }
                  alt="Profile"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.target.src =
                      "https://cdn-icons-png.flaticon.com/512/149/149071.png";
                  }}
                />
              </div>
              {isNew && !effectiveViewOnly && (
                <span
                  className="absolute -bottom-1 -right-1 bg-gradient-to-br from-cyan-500 to-sky-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs shadow-lg"
                  style={{ boxShadow: "0 4px 14px rgba(6, 182, 212, 0.45)" }}
                >
                  +
                </span>
              )}
              {isSelected && !isNew && !effectiveViewOnly && !isHighlighted && (
                <span
                  className="absolute -bottom-1 -right-1 bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs shadow-lg"
                  style={{ boxShadow: "0 4px 14px rgba(236, 72, 153, 0.45)" }}
                >
                  ✓
                </span>
              )}
              {isHighlighted && (
                <span
                  className="absolute -bottom-1 -right-1 bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow-lg animate-pulse"
                  style={{ boxShadow: "0 6px 18px rgba(236, 72, 153, 0.55)" }}
                >
                  🔍
                </span>
              )}
            </div>
          </div>

          {/* Card Content - Grid Layout */}
          <div
            className="w-full h-full flex justify-evenly flex-col"
            style={{ paddingTop: `${profileSize * 0.7}px` }}
          >
            {person.lifeStatus === "remembering" && (
              <div className="text-center mb-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-semibold rounded dark:bg-red-900/30 dark:text-red-200">
                In Memory
              </div>
            )}

            {/* 2-Column Grid for Age & Gender */}
            <div className="grid grid-cols-2 gap-1 px-2 mb-1">
              {person.age && (
                <div className="text-center">
                  <div
                    className="text-sky-600 font-extrabold"
                    style={{ fontSize: `${fontSizeDetails}px` }}
                  >
                    {person.age} Yrs
                  </div>
                  {/* <div className="text-cyan-500 text-[8px] font-bold uppercase tracking-wider">AGE</div> */}
                </div>
              )}
              {getGenderLabel(person, tree, currentUserId) && (
                <div className="text-center">
                  <div className="text-pink-600 font-extrabold  flex justify-center" style={{ fontSize: `${fontSizeDetails}px` }}>
                                {['M', 'H'].includes(getGenderLabel(person, tree, currentUserId)) ? <FaMale className="mx-auto text-sky-600 text-2xl" /> : 
                                            ['F', 'W'].includes(getGenderLabel(person, tree, currentUserId)) ? <FaFemale className="mx-auto text-pink-500 text-2xl" /> : null}

                            </div>
                  {/* <div className="text-fuchsia-500 text-[8px] font-bold uppercase tracking-wider">GENDER</div> */}
                </div>
              )}
            </div>

            {/* Name - Clean, No Background - AFTER Age/Gender */}
            <div className="text-center px-2 mb-1">
              <h3
                className="font-black text-gray-900 leading-tight dark:text-slate-100"
                style={{
                  fontSize: `${fontSizeName}px`,
                  lineHeight: "1.2",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
                title={
                  person.name ||
                  [person.firstName, person.lastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                  "Unnamed"
                }
              >
                {person.name ||
                  [person.firstName, person.lastName]
                    .filter(Boolean)
                    .join(" ")
                    .trim() ||
                  (language === "tamil" ? "பெயரில்லாத" : "Member")}
              </h3>
            </div>

                {/* Relationship Label - Clean with Border (viewOnly shows label without editing) */}
                {relationshipText && !isEditingLabel && (
                    <div className="px-2">
                        <div
                            className={`text-center py-1 px-2 rounded-lg font-bold transition-all duration-200 border-2 shadow-sm ${
                                isViewingBirthFamily
                                    ? 'bg-gradient-to-r from-cyan-50 to-sky-50 text-sky-700 border-cyan-400 dark:from-slate-900 dark:to-slate-800 dark:text-slate-100 dark:border-slate-600'
                                    : 'bg-gradient-to-r from-pink-50 to-fuchsia-50 text-pink-700 border-pink-400 dark:from-slate-900 dark:to-slate-800 dark:text-slate-100 dark:border-slate-600'
                            } ${!viewOnly ? 'cursor-pointer hover:from-cyan-100 hover:to-sky-100 hover:shadow-md' : ''}`}
                            style={{
                                fontSize: `${fontSizeRelationship}px`,
                                lineHeight: '1.2',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                            }}
                            {...(!viewOnly
                                ? {
                                    title: 'Click to edit label',
                                    onClick: handleEditLabelClick,
                                }
                                : {})}
                        >
                            {relationshipText}
                            {!viewOnly && ' ✏️'}
                        </div>
                        {displayRelationshipCode && (
                            <div
                                className="text-center mt-1 text-gray-600 font-semibold dark:text-slate-300"
                                style={{ fontSize: `${Math.max(9, fontSizeRelationship - 3)}px` }}
                            >
                                {displayRelationshipCode}
                            </div>
                        )}
                    </div>
                )}

            {/* Editing UI */}
            {isEditingLabel && !viewOnly && (
              <div className="px-2 mt-auto">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    className="flex-1 px-2 py-1 rounded border-2 border-blue-300 text-blue-700 font-semibold text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={editLabelValue}
                    onChange={(e) => setEditLabelValue(e.target.value)}
                    style={{ fontSize: `${fontSizeRelationship - 1}px` }}
                  />
                  <button
                    className="px-2 py-1 rounded bg-blue-500 text-white font-bold text-xs"
                    onClick={handleSaveLabel}
                  >
                    ✓
                  </button>
                  <button
                    className="px-2 py-1 rounded bg-gray-300 text-gray-700 font-bold text-xs"
                    onClick={handleCancelEdit}
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
};

export default Person;

