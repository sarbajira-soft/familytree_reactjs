import React, { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import RelationshipCalculator from "../../utils/relationshipCalculator";
import { useFamilyTreeLabels } from "../../Contexts/FamilyTreeContext";
import { useUser } from "../../Contexts/UserContext";
import { useTheme } from "../../Contexts/ThemeContext";
import {
  FiEye,
  FiShare2,
  FiMoreVertical,
  FiCopy,
  FiLink,
  FiUser,
} from "react-icons/fi";
import Swal from "sweetalert2";
import { useNavigate, useParams } from "react-router-dom";
import { authFetchResponse } from "../../utils/authFetch";
import { FaFemale, FaMale } from "react-icons/fa";
import { getTreeCardDimensions } from "../../utils/treeCardDimensions";
import { BlockButton } from "../block/BlockButton";
import { BlockedBadge } from "../block/BlockedBadge";
import { logger } from "../../utils/logger";

// Helper function to get inverse/opposite relationship code

const getInverseRelationship = (relationshipCode) => {
  if (!relationshipCode || relationshipCode === "SELF") return relationshipCode;
  // Mapping of relationships to their inverses

  const inverseMap = {
    // Spouse relationships (opposite gender)
    H: "W",
    W: "H",
    // Parent-child relationships (opposite direction)
    F: "S", // Father -> Son (from child's perspective, father becomes son)
    M: "D", // Mother -> Daughter (from child's perspective, mother becomes daughter)
    S: "F", // Son -> Father
    D: "M", // Daughter -> Mother
    // Sibling relationships (opposite gender, same age order)
    "B+": "Z+", // Elder brother -> Elder sister
    "B-": "Z-", // Younger brother -> Younger sister
    "Z+": "B+", // Elder sister -> Elder brother
    "Z-": "B-", // Younger sister -> Younger brother
    B: "Z", // Brother -> Sister
    Z: "B", // Sister -> Brother
  };
  // Parse the relationship code into components

  const components = [];
  let i = 0;

  while (i < relationshipCode.length) {
    let char = relationshipCode[i];
    let nextChar = relationshipCode[i + 1];
    // Check for two-character codes (like B+, B-, Z+, Z-)
    if (nextChar === "+" || nextChar === "-") {
      components.push(char + nextChar);
      i += 2;
    } else {
      // Single character code
      components.push(char);
      i += 1;
    }
  }

  // Inverse each component

  const inversedComponents = components.map((comp) => inverseMap[comp] || comp);

  // Reverse the order for complex paths

  // Example: "FB+" (Father's elder brother) becomes "Z+S" (Elder sister's son)

  // This is because from the uncle's perspective, you are his sibling's child

  inversedComponents.reverse();

  const result = inversedComponents.join("");

  logger.debug(
    ` Inverse relationship: ${relationshipCode} → ${result} (components: ${components.join(",")} → ${inversedComponents.join(",")})`,
  );

  return result;
};

// Helper function to get proper gender label

const getGenderLabel = (person, tree, currentUserId) => {
  if (!person.gender || person.gender === "unknown" || person.gender === "")
    return "";

  // Check if this person is a spouse of the current user

  const isSpouseOfCurrentUser = () => {
    if (!tree || !currentUserId) return false;

    // Find current user in tree

    const currentUser = Array.from(tree.people.values()).find(
      (p) => p.memberId === currentUserId || p.userId === currentUserId,
    );

    if (!currentUser) return false;

    // Check if person is in current user's spouse list

    let spouses;
    if (currentUser.spouses instanceof Set) {
      spouses = Array.from(currentUser.spouses);
    } else if (Array.isArray(currentUser.spouses)) {
      spouses = currentUser.spouses;
    } else {
      spouses = [];
    }

    return spouses.includes(person.id);
  };

  // If this person is a spouse, use H/W labels

  if (isSpouseOfCurrentUser()) {
    const genderLower = person.gender.toLowerCase();
    if (genderLower === "male") return "H";
    if (genderLower === "female") return "W";
    return "";
  }

  // For non-spouses, use standard gender labels

  const normalizedGender = person.gender.toLowerCase().trim();

  switch (normalizedGender) {
    case "male":
    case "m":
      return "M";
    case "female":
    case "f":
      return "F";
    case "unknown":
    case "":
    case "man": // Handle 'MAN' case
    case "woman":
      return "";
    default:
      // Don't show raw gender values like 'MAN' - return empty for unknown values

      return "";
  }
};

// Extracted helper: resolve profile image source to avoid nested ternary
function getProfileImageSrc(person) {
  if (person.imgPreview) return person.imgPreview;
  if (typeof person.img === "string" && person.img) return person.img;
  return "https://cdn-icons-png.flaticon.com/512/149/149071.png";
}

// Extracted helper: build navigation query params
function buildNavigationQuery(focusUserId, focusName, sourceCode, extraParams) {
  const queryParams = { ...extraParams };
  if (focusUserId) queryParams.focus = String(focusUserId);
  if (focusName) queryParams.focusName = focusName;
  if (sourceCode) queryParams.source = sourceCode;
  return new URLSearchParams(queryParams).toString();
}

// Extracted helper: compute source code for navigation
function computeSourceCode(relationshipCode) {
  if (!relationshipCode) return null;
  if (relationshipCode.endsWith("H") || relationshipCode.endsWith("W")) {
    return relationshipCode.length > 1
      ? relationshipCode.slice(0, -1)
      : relationshipCode;
  }
  return getInverseRelationship(relationshipCode);
}

// Extracted helper: save custom label via API
async function saveCustomLabel({ currentUserId, currentFamilyId, displayRelationshipCode, language, editLabelValue, userInfo }) {
  if (!currentUserId || !currentFamilyId) {
    Swal.fire({ icon: "warning", title: "Missing info", text: "User ID or Family Code missing. Cannot save label." });
    return false;
  }
  const apiLanguage = language === "tamil" ? "ta" : language;
  try {
    await authFetchResponse(`/custom-labels`, {
      method: "POST",
      skipThrow: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationshipKey: displayRelationshipCode,
        language: apiLanguage,
        custom_label: editLabelValue,
        creatorId: currentUserId,
        familyCode: currentFamilyId,
        scope: "user",
        gender: userInfo?.gender,
      }),
    });
    Swal.fire({ icon: "success", title: "Saved", text: "Label saved successfully." });
    return true;
  } catch (err) {
    logger.error("Failed to save custom label", err);
    Swal.fire({ icon: "error", title: "Save failed", text: "Failed to save label." });
    return false;
  }
}

// Extracted helper: share profile invite link
async function shareInviteLink(memberId, currentFamilyCode) {
  if (!memberId || !currentFamilyCode) {
    await Swal.fire({ icon: "warning", title: "Cannot share link", text: "Family or member information is missing for this person." });
    return;
  }
  const inviteUrl = `${globalThis.location.origin}/edit-profile?familyCode=${currentFamilyCode}&memberId=${memberId}`;
  try {
    if (navigator.share) {
      await navigator.share({ title: "Family Tree Invitation", text: "Update your family tree profile using this secure link.", url: inviteUrl });
    } else {
      await navigator.clipboard.writeText(inviteUrl);
      await Swal.fire({ icon: "success", title: "Invite Link Copied", text: "The profile invite link has been copied to your clipboard. You can share it via WhatsApp or any app." });
    }
  } catch (err) {
    logger.error("BLOCK OVERRIDE: Error sharing invite link from tree node", err);
    await Swal.fire({ icon: "error", title: "Share Failed", text: "Unable to share the invite link. Please try again." });
  }
}

// Extracted helper: determine navigation target family code
function getNavigationTargetFamilyCode(person, code, userInfo) {
  const currentViewFamilyCode = code || userInfo?.familyCode || "";
  const personBirthFamilyCode = person.primaryFamilyCode || person.familyCode || "";
  if (personBirthFamilyCode && personBirthFamilyCode !== currentViewFamilyCode) {
    return personBirthFamilyCode;
  }
  return null;
}

// Extracted helper: compute navigation targets
function computeNavigationTargets(person, code, userInfo) {
  const currentViewFamilyCode = code || userInfo?.familyCode || "";
  const navigationTargetFamilyCode = getNavigationTargetFamilyCode(person, code, userInfo);
  const rawCanonicalFamilyCode = person?.canonicalFamilyCode ? String(person.canonicalFamilyCode).trim() : "";
  const linkedTargetFamilyCode =
    person?.isExternalLinked && rawCanonicalFamilyCode && rawCanonicalFamilyCode !== currentViewFamilyCode
      ? rawCanonicalFamilyCode
      : null;
  const associatedTargetFamilyCode =
    navigationTargetFamilyCode && navigationTargetFamilyCode !== currentViewFamilyCode
      ? navigationTargetFamilyCode
      : null;
  const showLinkedTreeIcon = !!linkedTargetFamilyCode;
  const showAssociatedTreeIcon = !showLinkedTreeIcon && !!associatedTargetFamilyCode;
  return { linkedTargetFamilyCode, associatedTargetFamilyCode, showLinkedTreeIcon, showAssociatedTreeIcon };
}

// Extracted helper: navigate to a person's birth family
function navigateToBirthFamily({ associatedTargetFamilyCode, code, person, userInfo, relationshipCode, navigate }) {
  const personFamilyCode = associatedTargetFamilyCode;
  if (!personFamilyCode) {
    Swal.fire({ icon: "info", title: "No Family Tree Found", text: "This member does not have a family tree available.", confirmButtonColor: "#3f982c" });
    return;
  }
  if (code === personFamilyCode) {
    Swal.fire({ icon: "info", title: "Already Viewing", text: `You are already viewing ${person.name}'s family tree.`, confirmButtonColor: "#3f982c" });
    return;
  }
  logger.debug(` Navigation allowed: ${person.name} (${personFamilyCode})`);
  const focusUserId = person.memberId || person.userId;
  const focusName = person?.name ? String(person.name).trim() : "";
  const sourceCode = computeSourceCode(relationshipCode);
  const query = buildNavigationQuery(focusUserId, focusName, sourceCode);
  navigate(`/family-tree/${personFamilyCode}?${query}`);
}

// Extracted helper: navigate to a person's linked family
function navigateToLinkedFamily({ linkedTargetFamilyCode, code, person, navigate }) {
  const personFamilyCode = linkedTargetFamilyCode;
  if (!personFamilyCode) {
    Swal.fire({ icon: "info", title: "No Linked Family Tree Found", text: "This member does not have a linked family tree available.", confirmButtonColor: "#3f982c" });
    return;
  }
  if (code === personFamilyCode) {
    Swal.fire({ icon: "info", title: "Already Viewing", text: `You are already viewing ${person.name}'s linked family tree.`, confirmButtonColor: "#3f982c" });
    return;
  }
  const focusUserId = person.memberId || person.userId;
  const focusName = person?.name ? String(person.name).trim() : "";
  const query = buildNavigationQuery(focusUserId, focusName, null, { mode: "linked" });
  navigate(`/family-tree/${personFamilyCode}?${query}`);
}

// Extracted helper: compute relationship code
function computeRelationshipCode(isRoot, rootId, tree, personId, personName) {
  if (!isRoot && rootId && tree) {
    const calculator = new RelationshipCalculator(tree);
    const rel = calculator.calculateRelationship(rootId, personId);
    if (rel && rel.relationshipCode) {
      logger.debug(` Relationship for ${personName}: ${rel.relationshipCode}`);
      return rel.relationshipCode;
    }
  }
  return "";
}

// Extracted helper: determine if viewing birth family
function computeIsViewingBirthFamily(isLinkedMode, code, userFamilyCode) {
  if (isLinkedMode) return true;
  if (!code) return true;
  return code === userFamilyCode;
}

// Extracted helper: compute display relationship code
function computeDisplayRelationshipCode(relationshipCode, isViewingBirthFamily, urlSourceRelationship, sourceRelationship) {
  if (!relationshipCode) return "";
  if (isViewingBirthFamily) return relationshipCode;
  const sourceRel = urlSourceRelationship || sourceRelationship;
  if (sourceRel) return `A${sourceRel}+${relationshipCode}`;
  return relationshipCode;
}

// Extracted helper: compute relationship text
function computeRelationshipText(displayRelationshipCode, getLabel, isViewingBirthFamily, relationshipCode) {
  if (!displayRelationshipCode) return "";
  const primaryText = getLabel(displayRelationshipCode);
  if (!isViewingBirthFamily && relationshipCode && primaryText === displayRelationshipCode) {
    return getLabel(relationshipCode);
  }
  return primaryText;
}

// Extracted helper: get gender-based background gradient
function getGenderBackground(gender, dark) {
  if (dark) {
    if (gender === "male") return "linear-gradient(135deg, rgb(2 6 23) 0%, rgba(14, 165, 233, 0.14) 100%)";
    if (gender === "female") return "linear-gradient(135deg, rgb(2 6 23) 0%, rgba(244, 114, 182, 0.14) 100%)";
    return "linear-gradient(135deg, rgb(2 6 23) 0%, rgb(15 23 42) 100%)";
  }
  if (gender === "male") return "linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)";
  if (gender === "female") return "linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%)";
  return "linear-gradient(135deg, #f8fafc 0%, #e0f2fe 100%)";
}

// Extracted render helper: navigation icons
function renderNavigationIcons({ showLinkedTreeIcon, showAssociatedTreeIcon, person, handleViewPersonLinkedFamily, handleViewPersonBirthFamily }) {
  if (!showLinkedTreeIcon && !showAssociatedTreeIcon) return null;
  return (
    <div className="absolute top-1 left-1 flex flex-col items-center z-10">
      {showLinkedTreeIcon && (
        <button
          className="w-5 h-5 mb-1 bg-gradient-to-br from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 text-slate-700 rounded-full flex items-center justify-center shadow-md transition-all duration-200 border-2 border-slate-400 dark:from-slate-900 dark:to-slate-800 dark:hover:from-slate-800 dark:hover:to-slate-700 dark:text-slate-100 dark:border-slate-600"
          onClick={handleViewPersonLinkedFamily}
          title={`Go to ${person.name}'s Linked Family Tree`}
          style={{ width: "20px", height: "20px", top: "0px", left: "0px" }}
        >
          <FiLink size={12} />
        </button>
      )}
      {showAssociatedTreeIcon && (
        <button
          className="w-5 h-5 bg-gradient-to-br from-cyan-50 to-sky-50 hover:from-cyan-100 hover:to-sky-100 text-sky-700 rounded-full flex items-center justify-center shadow-md transition-all duration-200 border-2 border-cyan-400 dark:from-slate-900 dark:to-slate-800 dark:hover:from-slate-800 dark:hover:to-slate-700 dark:text-slate-100 dark:border-slate-600"
          onClick={handleViewPersonBirthFamily}
          title={`Go to ${person.name}'s Family Tree`}
          style={{ width: "20px", height: "20px", top: "0px", left: "0px" }}
        >
          <FiEye size={12} />
        </button>
      )}
    </div>
  );
}

// Extracted render helper: radial menu and action buttons
function renderRadialMenu({ effectiveViewOnly, memberCount, canShowMoreActionsButton, handleMenuToggle, isMenuOpen, menuRef, canShowBlockAction, personUserId, isBlocked, person, handleBlockStatusChange, isUidCopied, handleCopyNodeUid, canShare, handleShareClick, handleRadialMenuClick }) {
  if (effectiveViewOnly) return null;
  return (
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
            className="w-4 h-4 md:w-5 md:h-5 bg-white/90 hover:bg-white text-gray-700 hover:text-gray-900 rounded-full flex items-center justify-center shadow-md border border-gray-200 dark:bg-slate-900/90 dark:hover:bg-slate-900 dark:text-slate-200 dark:hover:text-slate-100 dark:border-slate-700"
            title="More actions"
          >
            <FiMoreVertical size={12} />
          </button>
          {isMenuOpen && (
            <div
              ref={menuRef}
              className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-20 dark:bg-slate-900 dark:border-slate-700"
            >
              {canShowBlockAction && (
                <div className="px-1 py-1">
                  <BlockButton
                    userId={personUserId}
                    isBlockedByMe={isBlocked}
                    location="memberCard"
                    userName={person?.name || 'this user'}
                    onStatusChange={handleBlockStatusChange}
                  />
                </div>
              )}
              {person?.nodeUid && (
                <div className="px-2 pb-1.5">
                  <div className="w-full px-2 py-1 text-left text-[11px] text-gray-600 bg-gray-50 rounded-md border border-gray-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700">
                    <div className="text-[10px] font-semibold text-gray-500 dark:text-slate-300 leading-tight">Uid</div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="min-w-0 truncate whitespace-nowrap overflow-hidden text-ellipsis">{String(person.nodeUid)}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        {isUidCopied && <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">Copied</span>}
                        <button type="button" className="flex-shrink-0 text-gray-500 hover:text-gray-700 dark:text-slate-300 dark:hover:text-slate-100" title="Copy Uid" onClick={(e) => { e.stopPropagation(); handleCopyNodeUid(); }}>
                          <FiCopy size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
      {canShare && (
        <button
          onClick={handleShareClick}
          className="w-4 h-4 md:w-5 md:h-5 bg-white/90 hover:bg-white text-sky-600 hover:text-sky-700 rounded-full flex items-center justify-center shadow-md border border-cyan-300 dark:bg-slate-900/90 dark:hover:bg-slate-900 dark:text-sky-300 dark:hover:text-sky-200 dark:border-slate-700"
          title="Share profile link"
        >
          <FiShare2 size={12} />
        </button>
      )}
      <button
        className="radial-menu-button w-4 h-4 md:w-5 md:h-5 bg-gradient-to-br from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 text-white rounded-full flex items-center justify-center font-bold text-[9px] shadow-lg hover:shadow-xl border-2 border-white"
        onClick={handleRadialMenuClick}
        style={{ boxShadow: "0 4px 14px rgba(6, 182, 212, 0.45)", width: memberCount > 50 ? "12px" : "18px", height: memberCount > 50 ? "12px" : "18px" }}
        title="Add family member"
      >
        +
      </button>
    </div>
  );
}

// Extracted render helper: profile picture
function renderProfilePicture({ profileSize, isRoot, isNew, isHighlighted, isSelected, effectiveViewOnly, person }) {
  return (
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
          <span className="absolute -top-1 -left-1 bg-red-600 text-white text-[10px] font-semibold px-[6px] py-[1px] rounded-sm rotate-[-12deg] shadow-lg select-none z-30" title="In Loving Memory">✝</span>
        )}
        <div
          className="relative z-20 rounded-full overflow-hidden bg-white border-4 shadow-lg dark:bg-slate-900"
          style={{ width: `${profileSize}px`, height: `${profileSize}px`, borderColor: getProfileBorderColor(isRoot, isSelected, person.gender), borderWidth: "4px", boxShadow: getProfileBoxShadow(isRoot, isSelected, person.gender) }}
        >
          <img src={getProfileImageSrc(person)} alt="Profile" className="w-full h-full object-cover" onError={(e) => { e.target.src = "https://cdn-icons-png.flaticon.com/512/149/149071.png"; }} />
        </div>
        {isNew && !effectiveViewOnly && (
          <span className="absolute -bottom-1 -right-1 bg-gradient-to-br from-cyan-500 to-sky-600 text-white rounded-full w-5 h-5 flex items-center justify-center font-bold text-xs shadow-lg" style={{ boxShadow: "0 4px 14px rgba(6, 182, 212, 0.45)" }}>+</span>
        )}
        {isHighlighted && (
          <span className="absolute -bottom-1 -right-1 bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold text-xs shadow-lg animate-pulse" style={{ boxShadow: "0 6px 18px rgba(236, 72, 153, 0.55)" }}>🔍</span>
        )}
      </div>
    </div>
  );
}

// Extracted render helper: card content (name, age, relationship)
function renderCardContent({ profileSize, person, fontSizeDetails, fontSizeName, fontSizeRelationship, isSelected, isNew, effectiveViewOnly, isHighlighted, language, tree, currentUserId, relationshipText, isEditingLabel, isViewingBirthFamily, viewOnly, handleEditLabelClick, editLabelValue, setEditLabelValue, handleSaveLabel, handleCancelEdit }) {
  return (
    <div className="w-full h-full flex justify-evenly flex-col" style={{ paddingTop: `${profileSize * 0.7}px` }}>
      {person.lifeStatus === "remembering" && (
        <div className="text-center mb-1 px-2 py-0.5 bg-red-50 text-red-700 text-xs font-semibold rounded dark:bg-red-900/30 dark:text-red-200">In Memory</div>
      )}
      <div className="grid grid-cols-3 gap-1 pl-2 pr-8 mb-1 items-center">
        <div className="text-center">
          {person.age && <div className="text-sky-600 font-extrabold whitespace-nowrap" style={{ fontSize: `${fontSizeDetails}px` }}>{person.age} Y</div>}
        </div>
        <div className="flex items-center justify-center">
          {isSelected && !isNew && !effectiveViewOnly && !isHighlighted && (
            <span className="bg-gradient-to-br from-pink-500 to-fuchsia-600 text-white rounded-full w-4 h-4 flex items-center justify-center font-bold text-[10px] shadow-lg" style={{ boxShadow: "0 4px 14px rgba(236, 72, 153, 0.45)" }} title="Selected">✓</span>
          )}
        </div>
        <div className="text-center">
          <div className="text-pink-600 font-extrabold flex justify-center" style={{ fontSize: `${fontSizeDetails}px` }}>
            {renderGenderIcon(getGenderLabel(person, tree, currentUserId))}
          </div>
        </div>
      </div>
      <div className="text-center px-2 mb-1">
        <h3 className="font-black text-gray-900 leading-tight dark:text-slate-100" style={{ fontSize: `${fontSizeName}px`, lineHeight: "1.2", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", textOverflow: "ellipsis" }} title={person.name || [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || "Unnamed"}>
          {person.name || [person.firstName, person.lastName].filter(Boolean).join(" ").trim() || (language === "tamil" ? "" : "Member")}
        </h3>
      </div>
      {relationshipText && !isEditingLabel && (
        <div className="px-2">
          <div
            className={`text-center py-1 px-2 rounded-lg font-bold transition-all duration-200 border-2 shadow-sm ${isViewingBirthFamily ? "bg-gradient-to-r from-cyan-50 to-sky-50 text-sky-700 border-cyan-400 dark:from-slate-900 dark:to-slate-800 dark:text-slate-100 dark:border-slate-600" : "bg-gradient-to-r from-pink-50 to-fuchsia-50 text-pink-700 border-pink-400 dark:from-slate-900 dark:to-slate-800 dark:text-slate-100 dark:border-slate-600"} ${viewOnly ? "" : "cursor-pointer hover:from-cyan-100 hover:to-sky-100 hover:shadow-md"}`}
            style={{ fontSize: `${fontSizeRelationship}px`, lineHeight: "1.2", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            {...(viewOnly ? {} : { title: "Click to edit label", onClick: handleEditLabelClick })}
          >
            {relationshipText}
            {!viewOnly && " ✏️"}
          </div>
        </div>
      )}
      {isEditingLabel && !viewOnly && (
        <div className="px-2 mt-auto">
          <div className="flex flex-col gap-1">
            <input type="text" className="w-full px-2 py-1.5 rounded-md border-2 border-blue-300 text-blue-700 font-semibold text-center focus:outline-none focus:ring-2 focus:ring-blue-400" value={editLabelValue} onChange={(e) => setEditLabelValue(e.target.value)} style={{ fontSize: `${fontSizeRelationship - 1}px` }} />
            <div className="flex items-center justify-center gap-1.5">
              <button type="button" className="w-7 h-7 rounded-full bg-blue-600 text-white font-bold text-[10px] shadow-sm hover:bg-blue-700 active:scale-95 transition-transform" onClick={handleSaveLabel} title="Save">✓</button>
              <button type="button" className="w-7 h-7 rounded-full bg-gray-200 text-gray-800 font-bold text-[10px] shadow-sm hover:bg-gray-300 active:scale-95 transition-transform dark:bg-slate-700 dark:text-slate-100 dark:hover:bg-slate-600" onClick={handleCancelEdit} title="Cancel">✕</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Extracted helper: compute card background
function computeCardBackground(isDark, isRoot, isNew, gender) {
  if (!isDark) {
    if (isRoot) return "linear-gradient(135deg, #fef2f2 0%, #ffe4e6 50%, #fce7f3 100%)";
    if (isNew) return "linear-gradient(135deg, #f0f9ff 0%, #dbeafe 50%, #e0f2fe 100%)";
    return getGenderBackground(gender, false);
  }
  if (isRoot) return "linear-gradient(135deg, rgb(2 6 23) 0%, rgb(15 23 42) 45%, rgb(30 41 59) 100%)";
  if (isNew) return "linear-gradient(135deg, rgb(2 6 23) 0%, rgba(14, 165, 233, 0.12) 55%, rgb(15 23 42) 100%)";
  return getGenderBackground(gender, true);
}

// Extracted helper: copy node UID to clipboard
async function copyNodeUid(person, setIsUidCopied) {
  if (!person?.nodeUid) return;
  try {
    await navigator.clipboard.writeText(String(person.nodeUid));
    setIsUidCopied(true);
    globalThis.setTimeout(() => setIsUidCopied(false), 1000);
  } catch (e) {
    logger.error("Failed to copy node UID to clipboard", e);
    setIsUidCopied(false);
  }
}

// Extracted helper: build card className
function buildCardClassName(person, isRoot, isNew, isSelected, isHighlighted, isSearchResult) {
  const classes = ["person", person.gender];
  if (isRoot) classes.push("root");
  if (isNew) classes.push("person-new");
  if (isSelected) classes.push("person-selected");
  if (person.lifeStatus === "remembering") classes.push("remembering");
  if (isHighlighted) classes.push("person-highlighted");
  if (isSearchResult) classes.push("person-search-result");
  classes.push("group transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:ring-4 hover:ring-green-200");
  return classes.join(" ");
}

// Extracted helper: build card style object
function buildCardStyle({ width, height, margin, padding, memberCount, cardOpacity, cardBackground, isHighlighted, isSearchResult, isRoot, isNew, isSelected, person, effectiveViewOnly }) {
  const isLargeTree = memberCount > 50;
  return {
    position: "relative",
    minWidth: width,
    maxWidth: isLargeTree ? 200 : 250,
    width,
    minHeight: height,
    height,
    margin,
    padding,
    opacity: person.lifeStatus === "remembering" ? 0.8 * cardOpacity : cardOpacity,
    background: cardBackground,
    border: getCardBorder(isHighlighted, isSearchResult, isRoot, isNew, isSelected, person.gender),
    borderRadius: isLargeTree ? 12 : 18,
    boxShadow: getCardShadow(isHighlighted, isSearchResult, isRoot, isSelected, person.gender),
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "flex-start",
    zIndex: 2,
    fontFamily: "Poppins, Arial, sans-serif",
    transition: "box-shadow 0.18s, border 0.18s, background 0.18s",
    overflow: "visible",
    cursor: effectiveViewOnly ? "default" : "pointer",
  };
}

// Extracted helper: build container style
function buildContainerStyle(person, width, height, isDeleted) {
  return {
    position: "absolute",
    left: `${person.x - width / 2}px`,
    top: `${person.y - height / 2}px`,
    zIndex: 10,
    opacity: isDeleted ? 0.15 : 1,
    filter: isDeleted ? "grayscale(100%)" : undefined,
    pointerEvents: isDeleted ? "none" : "auto",
  };
}

// Extracted helper: compute derived state flags
function computePersonFlags(person, userInfo, viewOnly, onClick, isRoot) {
  const effectiveViewOnly = viewOnly || typeof onClick !== "function";
  const isAdmin = !!(userInfo && (userInfo.role === 2 || userInfo.role === 3));
  const personUserId = person?.userId || person?.memberId || null;
  const canShare = !!personUserId;
  const canShowAdminMenu = isAdmin && !!personUserId;
  const isSelf = !!(
    personUserId &&
    userInfo?.userId &&
    Number(personUserId) === Number(userInfo.userId)
  );
  const canShowBlockAction = canShowAdminMenu && !isSelf && !isRoot;
  const canShowMoreActionsButton = canShowAdminMenu && canShowBlockAction;
  const isDeleted = !!person?.isDeleted;
  return { effectiveViewOnly, personUserId, canShare, canShowAdminMenu, canShowBlockAction, canShowMoreActionsButton, isDeleted };
}

const Person = ({
  person,
  isRoot,
  onClick,
  rootId,
  tree,
  language,
  isNew,
  isSelected,
  isHighlighted,
  isSearchResult,
  currentUserId,
  currentFamilyId,
  viewOnly,
  sourceRelationship,
}) => {
  const { theme } = useTheme();
  const [isUidCopied, setIsUidCopied] = useState(false);
  const handleCopyNodeUid = () => copyNodeUid(person, setIsUidCopied);

  const isDark = theme === "dark";
  const memberCount = tree ? tree.people.size : 0;
  const { userInfo } = useUser();
  const { code } = useParams();
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { effectiveViewOnly, personUserId, canShare, canShowBlockAction, canShowMoreActionsButton, isDeleted } = useMemo(
    () => computePersonFlags(person, userInfo, viewOnly, onClick, isRoot),
    [person, userInfo, viewOnly, onClick, isRoot],
  );
  const currentFamilyCode = code || userInfo?.familyCode || person.familyCode || "";

  const [blockStatus, setBlockStatus] = useState(() => ({
    isBlockedByMe: Boolean(person?.blockStatus?.isBlockedByMe),
    isBlockedByThem: Boolean(person?.blockStatus?.isBlockedByThem),
  }));
  const isBlocked = Boolean(blockStatus?.isBlockedByMe);
  const menuRef = useRef(null);

  const handleBlockStatusChange = (nextStatus) => {
    if (!nextStatus) return;
    setBlockStatus((prev) => ({ ...prev, ...nextStatus }));
  };

  const urlParams = new URLSearchParams(globalThis.location.search);
  const urlSourceRelationship = urlParams.get("source");
  const isLinkedMode = urlParams.get("mode") === "linked";
  const cardDimensions = useMemo(
    () => getTreeCardDimensions(memberCount, undefined, true),
    [memberCount],
  );

  useEffect(() => {
    setBlockStatus({
      isBlockedByMe: Boolean(person?.blockStatus?.isBlockedByMe),
      isBlockedByThem: Boolean(person?.blockStatus?.isBlockedByThem),
    });
  }, [person?.blockStatus?.isBlockedByMe, person?.blockStatus?.isBlockedByThem]);

  const { width, height, fontSizeName, fontSizeDetails, fontSizeRelationship, profileSize, padding, margin } = cardDimensions;

  const relationshipCode = useMemo(
    () => computeRelationshipCode(isRoot, rootId, tree, person.id, person.name),
    [isRoot, rootId, tree, person.id, person.name],
  );
  const isViewingBirthFamily = useMemo(
    () => computeIsViewingBirthFamily(isLinkedMode, code, userInfo?.familyCode),
    [code, userInfo?.familyCode, isLinkedMode],
  );
  const displayRelationshipCode = useMemo(
    () => computeDisplayRelationshipCode(relationshipCode, isViewingBirthFamily, urlSourceRelationship, sourceRelationship),
    [relationshipCode, isViewingBirthFamily, urlSourceRelationship, sourceRelationship],
  );

  const { getLabel, refreshLabels } = useFamilyTreeLabels();
  const relationshipText = useMemo(
    () => computeRelationshipText(displayRelationshipCode, getLabel, isViewingBirthFamily, relationshipCode),
    [displayRelationshipCode, getLabel, isViewingBirthFamily, relationshipCode],
  );

  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editLabelValue, setEditLabelValue] = useState("");
  const handleEditLabelClick = (e) => {
    e.stopPropagation();
    setEditLabelValue(relationshipText);
    setIsEditingLabel(true);
  };
  const handleSaveLabel = async (e) => {
    e.stopPropagation();
    const success = await saveCustomLabel({ currentUserId, currentFamilyId, displayRelationshipCode, language, editLabelValue, userInfo });
    if (!success) return;
    if (refreshLabels) refreshLabels();
    setIsEditingLabel(false);
  };
  const handleCancelEdit = (e) => {
    e.stopPropagation();
    setIsEditingLabel(false);
  };

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handler = (event) => {
      if (event?.target?.closest?.('[data-block-modal="true"]')) return;
      if (menuRef.current && !menuRef.current.contains(event.target)) setIsMenuOpen(false);
    };
    document.addEventListener("mousedown", handler, true);
    return () => document.removeEventListener("mousedown", handler, true);
  }, [isMenuOpen]);

  const handleCardClick = (e) => {
    if (!e.target.closest(".radial-menu-button")) onClick(person.id);
  };
  const handleRadialMenuClick = (e) => { e.stopPropagation(); onClick(person.id); };
  const handleShareClick = (e) => { e.stopPropagation(); shareInviteLink(person.memberId, currentFamilyCode); };
  const handleMenuToggle = (e) => { e.stopPropagation(); setIsMenuOpen((prev) => !prev); };

  const { linkedTargetFamilyCode, associatedTargetFamilyCode, showLinkedTreeIcon, showAssociatedTreeIcon } = useMemo(
    () => computeNavigationTargets(person, code, userInfo),
    [person, code, userInfo],
  );

  const handleViewPersonBirthFamily = (e) => { e.stopPropagation(); navigateToBirthFamily({ associatedTargetFamilyCode, code, person, userInfo, relationshipCode, navigate }); };
  const handleViewPersonLinkedFamily = (e) => { e.stopPropagation(); navigateToLinkedFamily({ linkedTargetFamilyCode, code, person, navigate }); };

  const cardOpacity = memberCount > 50 ? 0.95 : 1;
  const cardBackground = useMemo(
    () => computeCardBackground(isDark, isRoot, isNew, person.gender),
    [isDark, isRoot, isNew, person.gender],
  );
  const cardClassName = useMemo(
    () => buildCardClassName(person, isRoot, isNew, isSelected, isHighlighted, isSearchResult),
    [person, isRoot, isNew, isSelected, isHighlighted, isSearchResult],
  );
  const containerStyle = useMemo(
    () => buildContainerStyle(person, width, height, isDeleted),
    [person, width, height, isDeleted],
  );
  const cardStyle = useMemo(
    () => buildCardStyle({ width, height, margin, padding, memberCount, cardOpacity, cardBackground, isHighlighted, isSearchResult, isRoot, isNew, isSelected, person, effectiveViewOnly }),
    [width, height, margin, padding, memberCount, cardOpacity, cardBackground, isHighlighted, isSearchResult, isRoot, isNew, isSelected, person, effectiveViewOnly],
  );
  const cardKeyDown = effectiveViewOnly ? undefined : (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(e); } };

  return (
    <div id={`person-${person.id}`} className="person-container" style={containerStyle}>
      {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
      <div
        className={cardClassName}
        style={cardStyle}
        onClick={effectiveViewOnly ? undefined : handleCardClick}
        onKeyDown={cardKeyDown}
        tabIndex={effectiveViewOnly ? -1 : 0}
        data-person-id={person.id}
      >
        {renderNavigationIcons({ showLinkedTreeIcon, showAssociatedTreeIcon, person, handleViewPersonLinkedFamily, handleViewPersonBirthFamily })}
        {isBlocked && <div className="absolute top-1 right-8 z-20"><BlockedBadge /></div>}
        {renderRadialMenu({ effectiveViewOnly, memberCount, canShowMoreActionsButton, handleMenuToggle, isMenuOpen, menuRef, canShowBlockAction, personUserId, isBlocked, person, handleBlockStatusChange, isUidCopied, handleCopyNodeUid, canShare, handleShareClick, handleRadialMenuClick })}
        {renderProfilePicture({ profileSize, isRoot, isNew, isHighlighted, isSelected, effectiveViewOnly, person })}
        {renderCardContent({ profileSize, person, fontSizeDetails, fontSizeName, fontSizeRelationship, isSelected, isNew, effectiveViewOnly, isHighlighted, language, tree, currentUserId, relationshipText, isEditingLabel, isViewingBirthFamily, viewOnly, handleEditLabelClick, editLabelValue, setEditLabelValue, handleSaveLabel, handleCancelEdit })}
      </div>
    </div>
  );
};

// Helper functions extracted to reduce cognitive complexity
function getCardBorder(isHighlighted, isSearchResult, isRoot, isNew, isSelected, gender) {
  if (isHighlighted) return "3px solid #ec4899";
  if (isSearchResult) return "3px solid #06b6d4";
  if (isRoot) return "3px solid #db2777";
  if (isNew) return "2.5px dashed #0891b2";
  if (isSelected) return "3px solid #ec4899";
  if (gender === "male") return "3px solid #0ea5e9";
  if (gender === "female") return "3px solid #f472b6";
  return "3px solid #22d3ee";
}

function getCardShadow(isHighlighted, isSearchResult, isRoot, isSelected, gender) {
  if (isHighlighted) return "0 0 0 4px rgba(236, 72, 153, 0.3), 0 8px 24px rgba(236, 72, 153, 0.25), 0 4px 16px rgba(236, 72, 153, 0.2)";
  if (isSearchResult) return "0 0 0 4px rgba(6, 182, 212, 0.3), 0 8px 24px rgba(6, 182, 212, 0.25), 0 4px 16px rgba(6, 182, 212, 0.2)";
  if (isRoot) return "0 0 0 8px rgba(219, 39, 119, 0.4), 0 0 25px rgba(219, 39, 119, 0.5), 0 0 40px rgba(219, 39, 119, 0.35), 0 12px 32px rgba(219, 39, 119, 0.3)";
  if (isSelected) return "0 0 0 4px rgba(236, 72, 153, 0.35), 0 8px 24px rgba(236, 72, 153, 0.3), 0 4px 16px rgba(236, 72, 153, 0.25)";
  if (gender === "male") return "0 6px 16px rgba(14, 165, 233, 0.2), 0 3px 8px rgba(14, 165, 233, 0.15)";
  if (gender === "female") return "0 6px 16px rgba(244, 114, 182, 0.2), 0 3px 8px rgba(244, 114, 182, 0.15)";
  return "0 6px 16px rgba(34, 211, 238, 0.18), 0 3px 8px rgba(34, 211, 238, 0.12)";
}

function getProfileBorderColor(isRoot, isSelected, gender) {
  if (isRoot) return "#db2777";
  if (isSelected) return "#ec4899";
  if (gender === "male") return "#0ea5e9";
  if (gender === "female") return "#f472b6";
  return "#22d3ee";
}

function getProfileBoxShadow(isRoot, isSelected, gender) {
  if (isRoot) return "0 0 24px rgba(219, 39, 119, 0.45), 0 6px 16px rgba(219, 39, 119, 0.35)";
  if (isSelected) return "0 0 20px rgba(236, 72, 153, 0.4), 0 6px 14px rgba(236, 72, 153, 0.3)";
  if (gender === "male") return "0 6px 16px rgba(14, 165, 233, 0.25)";
  return "0 6px 16px rgba(244, 114, 182, 0.25)";
}

function renderGenderIcon(genderLabel) {
  if (["M", "H"].includes(genderLabel)) {
    return <FaMale className="mx-auto text-sky-600 text-lg" />;
  }
  if (["F", "W"].includes(genderLabel)) {
    return <FaFemale className="mx-auto text-pink-500 text-lg" />;
  }
  return <FiUser className="mx-auto text-slate-500 text-[18px]" />;
}

Person.propTypes = {
  person: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    nodeUid: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    userId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    memberId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    name: PropTypes.string,
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    gender: PropTypes.string,
    age: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    lifeStatus: PropTypes.string,
    familyCode: PropTypes.string,
    primaryFamilyCode: PropTypes.string,
    canonicalFamilyCode: PropTypes.string,
    isExternalLinked: PropTypes.bool,
    isDeleted: PropTypes.bool,
    img: PropTypes.string,
    imgPreview: PropTypes.string,
    x: PropTypes.number,
    y: PropTypes.number,
    spouses: PropTypes.oneOfType([
      PropTypes.instanceOf(Set),
      PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
    ]),
    associatedFamilyCodes: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.string),
      PropTypes.string,
    ]),
    blockStatus: PropTypes.shape({
      isBlockedByMe: PropTypes.bool,
      isBlockedByThem: PropTypes.bool,
    }),
  }).isRequired,
  isRoot: PropTypes.bool,
  onClick: PropTypes.func,
  rootId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  tree: PropTypes.shape({
    people: PropTypes.shape({
      size: PropTypes.number,
      values: PropTypes.func,
    }),
  }),
  language: PropTypes.string,
  isNew: PropTypes.bool,
  isSelected: PropTypes.bool,
  isHighlighted: PropTypes.bool,
  isSearchResult: PropTypes.bool,
  currentUserId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  currentFamilyId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  viewOnly: PropTypes.bool,
  sourceRelationship: PropTypes.string,
};

export default Person;
