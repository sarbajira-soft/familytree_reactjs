import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { getToken } from "../../utils/auth";
import { authFetch, authFetchResponse } from "../../utils/authFetch";
import { useTheme } from "../../Contexts/ThemeContext";
import { useLanguage } from "../../Contexts/LanguageContext";
import { fetchWatchTutorial } from "../../services/tutorial.service";

const DEFAULT_PRIMARY = "#1976D2";

function normalizeFamilyCode(val) {
  return String(val || "").trim().toUpperCase();
}

function extractDigits(val) {
  return String(val || "").replace(/\D+/g, "");
}

function formatFamilyCodeFromDigits(digits) {
  const d = extractDigits(digits).slice(0, 6);
  return d.length ? `FAM${d}` : "";
}

export default function LinkTreeModal({
  isOpen,
  onClose,
  senderPerson,
  token,
  primaryColor = DEFAULT_PRIMARY,
  onSent,
  currentFamilyCode,
  existingMemberIds = [],
  existingCanonicalKeys = [],
  allowedRelationshipTypes = null,
}) {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const senderNodeUid = String(senderPerson?.nodeUid || "").trim();

  const navigate = useNavigate();
  const { language } = useLanguage();
  const [loadingTutorial, setLoadingTutorial] = useState(false);

  const handleWatchLinkTreeTutorial = async () => {
    if (loadingTutorial) return;
    setLoadingTutorial(true);
    try {
      const res = await fetchWatchTutorial("link-tree", language);
      if (res && res.id) {
        navigate(`/tutorials/${res.id}?lang=${language}`);
        onClose();
      } else {
        await Swal.fire({
          icon: "info",
          title: "Tutorial not available",
          text: "The tutorial video for linking family trees is not available in your language yet.",
          confirmButtonColor: primaryColor,
        });
      }
    } catch (err) {
      console.error("Failed to load link-tree tutorial:", err);
      await Swal.fire({
        icon: "info",
        title: "Tutorial not available",
        text: "The tutorial video for linking family trees is not available in your language yet.",
        confirmButtonColor: primaryColor,
      });
    } finally {
      setLoadingTutorial(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    if (typeof onClose !== "function") return;
    if (!window.__appModalBackStack) window.__appModalBackStack = [];

    const handler = () => {
      onClose();
    };

    window.__appModalBackStack.push(handler);

    return () => {
      const stack = window.__appModalBackStack;
      if (!Array.isArray(stack)) return;
      const idx = stack.lastIndexOf(handler);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [isOpen, onClose]);

  const asList = (val) => {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (val instanceof Set) return Array.from(val);
    return [];
  };

  const getPersonImage = (p) => {
    const img = p?.img ?? p?.profileImage ?? p?.image ?? null;
    return typeof img === "string" && img.trim() ? img.trim() : "";
  };

  const normalizePhone = (val) => String(val || "").replace(/\D+/g, "");

  const getPersonPhones = (p) => {
    const candidates = [
      p?.phone,
      p?.phoneNumber,
      p?.mobile,
      p?.mobileNumber,
      p?.contact,
      p?.contactNumber,
      p?.whatsapp,
      p?.whatsappNumber,
    ];
    return candidates
      .map((x) => normalizePhone(x))
      .filter(Boolean);
  };

  const [receiverFamilyCodeDigits, setReceiverFamilyCodeDigits] = useState("");
  const [relationshipType, setRelationshipType] = useState("");

  const [loading, setLoading] = useState(false);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [people, setPeople] = useState([]);
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [receiverSearchMessage, setReceiverSearchMessage] = useState("");

  const [phoneLookup, setPhoneLookup] = useState({ phone: "", loading: false, result: null });

  const receiverNodeUid = String(selectedPerson?.nodeUid || "").trim();
  const receiverIsAppUser = Boolean(selectedPerson?.isAppUser || selectedPerson?.memberId);
  const senderUserId = Number(senderPerson?.memberId || senderPerson?.userId || 0);

  const senderParents = asList(senderPerson?.parents);
  const receiverParents = asList(selectedPerson?.parents);
  const senderHasParents = senderParents.length > 0;
  const receiverHasParents = receiverParents.length > 0;
  const parentAllowed = !senderHasParents;
  const siblingAllowed = senderHasParents && receiverHasParents;
  const isFirstGenerationSender = Number.isFinite(Number(senderPerson?.generation)) && Number(senderPerson?.generation) <= 1;

  const relationshipOptions = React.useMemo(() => {
    const baseOptions = isFirstGenerationSender ? ["sibling"] : senderHasParents ? ["sibling", "child"] : ["parent", "child"];
    const requestedOptions = Array.isArray(allowedRelationshipTypes)
      ? allowedRelationshipTypes
          .map((value) => String(value || "").trim().toLowerCase())
          .filter(
            (value, index, arr) =>
              value &&
              ["parent", "child", "sibling"].includes(value) &&
              arr.indexOf(value) === index,
          )
      : [];

    if (requestedOptions.length) {
      return requestedOptions;
    }

    return baseOptions;
  }, [allowedRelationshipTypes, isFirstGenerationSender, senderHasParents]);

  const relationshipFieldLocked = relationshipOptions.length <= 1;
  const siblingModeActive =
    relationshipType === "sibling" || (relationshipFieldLocked && relationshipOptions.includes("sibling"));
  const siblingValidationMessage =
    !relationshipOptions.includes("sibling") || !siblingModeActive
      ? ""
      : !selectedPerson
      ? "Select a receiver person to check sibling eligibility."
      : !senderHasParents && !receiverHasParents
      ? "Sibling link needs saved parents on both sender and receiver cards."
      : !senderHasParents
      ? "Sender card has no saved parents yet. Save/add parents first."
      : !receiverHasParents
      ? "Selected receiver card has no saved parents in that family tree yet. Ask that family to save the parents first."
      : "";
  const siblingValidationVisible = Boolean(siblingValidationMessage);

  const normalizeGender = (g) => {
    const s = String(g || "").toLowerCase().trim();
    if (s === "male" || s === "m" || s === "man") return "male";
    if (s === "female" || s === "f" || s === "woman") return "female";
    return "";
  };

  const parentRoleFromGender = (g) => {
    if (g === "male") return "father";
    if (g === "female") return "mother";
    return "";
  };

  const needsParentRole = relationshipType === "parent" || relationshipType === "child";
  const showParentRole = relationshipType === "parent";
  const senderGender = normalizeGender(senderPerson?.gender);
  const receiverGender = normalizeGender(selectedPerson?.gender);
  const derivedParentRole =
    relationshipType === "parent"
      ? parentRoleFromGender(senderGender)
      : relationshipType === "child"
      ? parentRoleFromGender(receiverGender)
      : "";
  const derivedParentLabel =
    derivedParentRole === "father"
      ? "Father"
      : derivedParentRole === "mother"
      ? "Mother"
      : "";
  const childParentRoleMissing =
    relationshipType === "child" && receiverNodeUid && !derivedParentRole;

  React.useEffect(() => {
    setRelationshipType((prev) => {
      if (relationshipOptions.includes(prev)) {
        if (prev === "sibling" && !siblingAllowed) {
          return relationshipOptions.find((option) => option !== "sibling") || prev;
        }
        if (prev === "parent" && !parentAllowed) {
          return relationshipOptions.find((option) => option !== "parent") || prev;
        }
        return prev;
      }

      const preferredOption = relationshipOptions.find((option) => {
        if (option === "sibling") return siblingAllowed;
        if (option === "parent") return parentAllowed;
        return true;
      });

      return preferredOption || relationshipOptions[0] || "";
    });
  }, [relationshipOptions, siblingAllowed, parentAllowed]);

  const formattedReceiverFamilyCode = formatFamilyCodeFromDigits(receiverFamilyCodeDigits);
  const normalizedCurrentFamilyCode = normalizeFamilyCode(currentFamilyCode);
  const sameFamilyReceiverCode =
    Boolean(formattedReceiverFamilyCode) &&
    normalizeFamilyCode(formattedReceiverFamilyCode) === normalizedCurrentFamilyCode;
  const canSubmit = Boolean(
    senderNodeUid &&
      formattedReceiverFamilyCode &&
      !sameFamilyReceiverCode &&
      receiverNodeUid &&
      ["parent", "child", "sibling"].includes(relationshipType) &&
      receiverIsAppUser &&
      (!needsParentRole || Boolean(derivedParentRole)),
  );

  const canSearchReceiverFamily =
    extractDigits(receiverFamilyCodeDigits).length === 6 && !sameFamilyReceiverCode;
  const searchDisabledReason = !receiverFamilyCodeDigits
    ? "Enter receiver family code"
    : extractDigits(receiverFamilyCodeDigits).length !== 6
    ? "Family code must be 6 digits"
    : sameFamilyReceiverCode
    ? "Link Tree works only with a different family code"
    : "";

  const submitDisabledReason = !senderNodeUid
    ? "Select a valid sender card"
    : !formattedReceiverFamilyCode
    ? "Enter receiver family code"
    : sameFamilyReceiverCode
    ? "Link Tree works only with a different family code"
    : !hasSearched
    ? "Search receiver family first"
    : !receiverNodeUid
    ? "Select a receiver person"
    : !receiverIsAppUser
    ? "Receiver must be an app user"
    : needsParentRole && !derivedParentRole
    ? "Set gender for the selected card"
    : relationshipType === "parent" && !parentAllowed
    ? "Sender already has parents"
    : relationshipType === "sibling" && !siblingAllowed
    ? "Sibling requires parents on both sides"
    : "";

  useEffect(() => {
    if (!isOpen) return;
    // Reset form every time modal opens (prevents stale values).
    setReceiverFamilyCodeDigits("");
    setRelationshipType("");
    setPeople([]);
    setPersonSearch("");
    setSelectedPerson(null);
    setLoading(false);
    setPeopleLoading(false);
    setHasSearched(false);
    setReceiverSearchMessage("");
    setPhoneLookup({ phone: "", loading: false, result: null });
  }, [isOpen]);

  const filteredPeople = useMemo(() => {
    const q = String(personSearch || "").trim().toLowerCase();
    const base = Array.isArray(people) ? people : [];

    // Receiver list should show app users only and exclude spouse/associated members.
    // Heuristic:
    // - app user: `isAppUser` true
    // - primary-in-this-family: person.primaryFamilyCode (preferred) must match person.treeFamilyCode (the tree being viewed)
    //   (fallback to person.familyCode when primaryFamilyCode is missing)
    const normalizeCode = (val) => String(val || "").trim().toUpperCase();
    const eligible = base.filter((p) => {
      const isApp = Boolean(p?.isAppUser);
      if (!isApp) return false;

      const primary = normalizeCode(p?.primaryFamilyCode || p?.familyCode);
      const tree = normalizeCode(p?.treeFamilyCode);
      if (primary && tree && primary !== tree) return false;
      return true;
    });

    const existingMemberSet = new Set(
      (Array.isArray(existingMemberIds) ? existingMemberIds : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0),
    );
    const existingCanonicalSet = new Set(
      (Array.isArray(existingCanonicalKeys) ? existingCanonicalKeys : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean),
    );

    const notAlreadyInTree = (p) => {
      const mid = Number(p?.memberId || p?.userId || 0);
      if (mid && existingMemberSet.has(mid)) return false;
      const key = `${String(p?.canonicalFamilyCode || "").trim()}|${String(p?.canonicalNodeUid || "").trim()}`;
      if (String(p?.canonicalFamilyCode || "").trim() && String(p?.canonicalNodeUid || "").trim()) {
        if (existingCanonicalSet.has(key)) return false;
      }
      return true;
    };

    const withDisabledState = eligible.map((p) => {
      const candidateUserId = Number(p?.memberId || p?.userId || 0);
      const isSameAccount =
        senderUserId > 0 && candidateUserId > 0 && Number(senderUserId) === Number(candidateUserId);
      const isSelectable = !isSameAccount && notAlreadyInTree(p);
      return {
        person: p,
        disabled: !isSelectable,
        disabledReason: isSameAccount ? "Same account" : !isSelectable ? "Already in tree" : "",
      };
    });

    if (!q) return withDisabledState.slice(0, 30);

    return withDisabledState
      .filter(({ person: p }) => {
        const name = String(p?.name || "").toLowerCase();
        const id = String(p?.personId ?? "").toLowerCase();
        const qPhone = normalizePhone(q);
        const phones = getPersonPhones(p);
        const phoneMatch = qPhone ? phones.some((ph) => ph.includes(qPhone)) : false;
        return name.includes(q) || id.includes(q) || phoneMatch;
      })
      .slice(0, 30);
  }, [people, personSearch, existingMemberIds, existingCanonicalKeys, senderUserId]);

  React.useEffect(() => {
    // If the current selection becomes disallowed (already in tree), clear it.
    if (!selectedPerson) return;
    const existingMemberSet = new Set(
      (Array.isArray(existingMemberIds) ? existingMemberIds : [])
        .map((x) => Number(x))
        .filter((x) => Number.isFinite(x) && x > 0),
    );
    const existingCanonicalSet = new Set(
      (Array.isArray(existingCanonicalKeys) ? existingCanonicalKeys : [])
        .map((x) => String(x || "").trim())
        .filter(Boolean),
    );
    const mid = Number(selectedPerson?.memberId || selectedPerson?.userId || 0);
    const key = `${String(selectedPerson?.canonicalFamilyCode || "").trim()}|${String(selectedPerson?.canonicalNodeUid || "").trim()}`;
    const isSameAccount =
      senderUserId > 0 && mid > 0 && Number(senderUserId) === Number(mid);
    const alreadyInTree =
      (mid && existingMemberSet.has(mid)) ||
      (String(selectedPerson?.canonicalFamilyCode || "").trim() &&
        String(selectedPerson?.canonicalNodeUid || "").trim() &&
        existingCanonicalSet.has(key));

    if (alreadyInTree || isSameAccount) {
      setSelectedPerson(null);
    }
  }, [selectedPerson, existingMemberIds, existingCanonicalKeys, senderUserId]);

  const fetchReceiverFamilyPeople = async (digitsOverride) => {
    const digits = extractDigits(digitsOverride ?? receiverFamilyCodeDigits).slice(0, 6);
    const code = formatFamilyCodeFromDigits(digits);
    if (!digits || digits.length !== 6 || !code) {
      await Swal.fire({
        icon: "warning",
        title: "Receiver family code required",
        text: "Please enter a valid 6-digit family code to search.",
        confirmButtonColor: primaryColor,
      });
      return [];
    }

    if (normalizeFamilyCode(code) === normalizedCurrentFamilyCode) {
      setHasSearched(true);
      setPeople([]);
      setPersonSearch("");
      setSelectedPerson(null);
      setReceiverSearchMessage("Link Tree works only between different families. Choose another family code.");
      return [];
    }

    try {
      setHasSearched(true);
      setReceiverSearchMessage("");
      setPeopleLoading(true);
      const authToken = token || getToken();
      if (!authToken) throw new Error("Your session has expired. Please log in again.");

      const res = await authFetchResponse(`/family/tree-link-candidates/${encodeURIComponent(code)}`, {
        method: "GET",
        skipThrow: true,
        headers: {
          accept: "application/json",
        },
      });
      if (!res.ok) {
        throw new Error("We couldn’t load that family right now.");
      }
      const data = await res.json();
      const nextPeople = Array.isArray(data?.people) ? data.people : [];
      const existingMemberSet = new Set(
        (Array.isArray(existingMemberIds) ? existingMemberIds : [])
          .map((x) => Number(x))
          .filter((x) => Number.isFinite(x) && x > 0),
      );
      const existingCanonicalSet = new Set(
        (Array.isArray(existingCanonicalKeys) ? existingCanonicalKeys : [])
          .map((x) => String(x || "").trim())
          .filter(Boolean),
      );
      const eligibleReceivers = nextPeople.filter((person) => {
        if (!person?.isAppUser) return false;
        const primary = normalizeFamilyCode(person?.primaryFamilyCode || person?.familyCode);
        const treeCode = normalizeFamilyCode(person?.treeFamilyCode || person?.familyCode);
        if (primary && treeCode && primary !== treeCode) return false;

        const candidateUserId = Number(person?.memberId || person?.userId || 0);
        if (senderUserId > 0 && candidateUserId > 0 && Number(senderUserId) === Number(candidateUserId)) {
          return false;
        }
        if (candidateUserId && existingMemberSet.has(candidateUserId)) {
          return false;
        }

        const key = `${String(person?.canonicalFamilyCode || "").trim()}|${String(person?.canonicalNodeUid || "").trim()}`;
        if (
          String(person?.canonicalFamilyCode || "").trim() &&
          String(person?.canonicalNodeUid || "").trim() &&
          existingCanonicalSet.has(key)
        ) {
          return false;
        }

        return true;
      });
      setPeople(nextPeople);
      setPersonSearch("");
      setSelectedPerson(eligibleReceivers.length === 1 ? eligibleReceivers[0] : null);

      if (!nextPeople.length) {
        setReceiverSearchMessage(
          data?.message ||
            "No members are available to link from this family. Ask the admin to create/save the family tree first.",
        );
      }

      return nextPeople;
    } catch (e) {
      setHasSearched(true);
      setReceiverSearchMessage("");
      await Swal.fire({
        icon: "error",
        title: "Search failed",
        text: e?.message || "Unable to load the target family members.",
        confirmButtonColor: primaryColor,
      });
      return [];
    } finally {
      setPeopleLoading(false);
    }
  };

  const handlePhoneLookup = async () => {
    const cleaned = extractDigits(phoneLookup.phone).slice(0, 10);
    if (cleaned.length !== 10) return;

    setPhoneLookup((p) => ({ ...p, loading: true, result: null }));
    try {
      const data = await authFetch(`/user/lookup?phone=${encodeURIComponent(cleaned)}`, {
        method: "GET",
      });
      const famCode = normalizeFamilyCode(data?.user?.familyCode);
      const sameFamily = Boolean(famCode) && famCode === normalizeFamilyCode(currentFamilyCode);
      const alreadyInTree = Boolean(data?.user?.id) && existingMemberIds?.includes?.(Number(data.user.id));
      const notInTree = data?.exists && (Boolean(data?.user?.notInTree) || !famCode);

      const nextResult = { ...data, sameFamily, alreadyInTree, notInTree, cleaned };
      setPhoneLookup((p) => ({ ...p, loading: false, result: nextResult }));

      if (data?.exists && famCode && !sameFamily && !alreadyInTree) {
        if (data.user.notInTree) {
          setSelectedPerson(null);
          await Swal.fire({
            icon: "warning",
            title: "User not in tree",
            text: "This user is not placed in their family tree yet. They must be added to their tree first.",
            confirmButtonColor: primaryColor,
          });
          return;
        }

        setReceiverFamilyCodeDigits(extractDigits(famCode));
        const loaded = await fetchReceiverFamilyPeople(extractDigits(famCode));
        const uid = Number(data?.user?.id);
        const match = Array.isArray(loaded)
          ? loaded.find((pp) => Number(pp?.memberId || pp?.userId) === uid)
          : null;
        if (match) {
          setSelectedPerson(match);
        } else {
          setPhoneLookup((p) => ({
            ...p,
            result: { ...p.result, notInTree: true }
          }));
          setSelectedPerson(null);
          await Swal.fire({
            icon: "warning",
            title: "User not in tree",
            text: "This user is not placed in their family tree yet. They must be added to their tree first.",
            confirmButtonColor: primaryColor,
          });
        }
      } else if (data?.exists && (!famCode || notInTree)) {
        await Swal.fire({
          icon: "warning",
          title: "User not in tree",
          text: "This user is not placed in their family tree yet. They must be added to their tree first.",
          confirmButtonColor: primaryColor,
        });
      }
    } catch (e) {
      setPhoneLookup((p) => ({ ...p, loading: false }));
      await Swal.fire({
        icon: "error",
        title: "Lookup failed",
        text: e?.message || "Please try again.",
        confirmButtonColor: primaryColor,
      });
    }
  };

  const sendLinkRequest = async () => {
    if (!senderNodeUid) {
      await Swal.fire({
        icon: "warning",
        title: "Can’t send link request",
        text: "This card is missing a node ID. Please try another card.",
        confirmButtonColor: primaryColor,
      });
      return;
    }

    const code = formatFamilyCodeFromDigits(receiverFamilyCodeDigits);
    if (!code || !receiverNodeUid) {
      await Swal.fire({
        icon: "warning",
        title: "Missing details",
        text: "Please search the receiver family and select a person to link.",
        confirmButtonColor: primaryColor,
      });
      return;
    }

    if (!receiverIsAppUser) {
      await Swal.fire({
        icon: "info",
        title: "This person isn’t on the app yet",
        text: "Link Tree works only for app users. Ask them to join the app first, then try again.",
        confirmButtonColor: primaryColor,
      });
      return;
    }

    // Mirror radial menu rule: cannot add parents if the sender already has parents.
    if (relationshipType === "parent" && !parentAllowed) {
      await Swal.fire({
        icon: "info",
        title: "Parents already added",
        text: "This card already has parents. You can’t add another parent link.",
        confirmButtonColor: primaryColor,
      });
      return;
    }

    if (relationshipType === "sibling" && !siblingAllowed) {
      await Swal.fire({
        icon: "info",
        title: "Sibling link not available",
        text: "Sibling relationship needs parents on both sides. Please add parents first, then try again.",
        confirmButtonColor: primaryColor,
      });
      return;
    }

    // Override warning: in link-tree flow, the risky overwrite case is adding a child link
    // when the receiver already has parents.
    if (relationshipType === "child" && receiverHasParents) {
      const { isConfirmed } = await Swal.fire({
        icon: "warning",
        title: "Override existing cards?",
        text: "This person already has parents/relationships in their tree. If you proceed, the link may override existing parent cards after approval. Continue?",
        showCancelButton: true,
        confirmButtonColor: primaryColor,
        confirmButtonText: "Yes, override",
        cancelButtonText: "No",
      });
      if (!isConfirmed) {
        return;
      }
    }

    if (needsParentRole && !derivedParentRole) {
      await Swal.fire({
        icon: "warning",
        title: "Parent role can’t be detected",
        text: "Please set gender for the parent card (Male/Female). We’ll auto‑detect Father/Mother.",
        confirmButtonColor: primaryColor,
      });
      return;
    }

    try {
      setLoading(true);
      const authToken = token || getToken();
      if (!authToken) throw new Error("Your session has expired. Please log in again.");

      const res = await authFetchResponse(`/family/request-tree-link`, {
        method: "POST",
        skipThrow: true,
        headers: {
          accept: "application/json",
        },
        body: JSON.stringify({
          senderNodeUid,
          receiverFamilyCode: code,
          receiverNodeUid,
          relationshipType,
          ...(needsParentRole && derivedParentRole ? { parentRole: derivedParentRole } : {}),
        }),
      });

      if (!res.ok) {
        throw new Error("We couldn’t send the link request. Please try again.");
      }
      const data = await res.json().catch(() => ({}));

      const requestId = Number(data?.requestId);
      const message = String(data?.message || "");

      if (message.toLowerCase().includes("already pending") && requestId > 0) {
        const pendingChoice = await Swal.fire({
          icon: "info",
          title: "Link request already pending",
          text: "A link request for these families is already pending. Do you want to revoke (cancel) it?",
          showCancelButton: true,
          confirmButtonColor: primaryColor,
          confirmButtonText: "Revoke request",
          cancelButtonText: "Keep pending",
        });

        if (pendingChoice.isConfirmed) {
          try {
            const revokeRes = await authFetchResponse(`/family/revoke-tree-link-request`, {
              method: "POST",
              skipThrow: true,
              headers: {
                accept: "application/json",
              },
              body: JSON.stringify({ treeLinkRequestId: requestId }),
            });
            if (!revokeRes.ok) {
              throw new Error("We couldn’t revoke that request.");
            }
            const revokeData = await revokeRes.json().catch(() => ({}));
            await Swal.fire({
              icon: "success",
              title: "Request revoked",
              text: revokeData?.message || "Link request revoked.",
              confirmButtonColor: primaryColor,
            });
          } catch (e) {
            await Swal.fire({
              icon: "error",
              title: "Revoke failed",
              text: e?.message || "Unable to revoke the request.",
              confirmButtonColor: primaryColor,
            });
          }
        }
        return;
      }

      await Swal.fire({
        icon: "success",
        title: "Link request sent",
        text: data?.message || "Your link request was sent successfully.",
        confirmButtonColor: primaryColor,
      });

      onSent?.(data);
      onClose?.();
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Couldn’t send request",
        text: e?.message || "Please try again.",
        confirmButtonColor: primaryColor,
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="link-tree-modal"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Link Family Tree"
    >
      <div
        className="link-tree-modal-panel"
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "calc(100vh - 24px)",
          height: "auto",
          background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(255, 255, 255, 0.9)",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
          border: `1px solid ${primaryColor}20`,
          display: "flex",
          flexDirection: "column",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "14px 18px",
            background: `linear-gradient(90deg, ${primaryColor} 0%, ${primaryColor}CC 100%)`,
            color: "#fff",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: 800,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 18 }}>Link Tree</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <button
  type="button"
  onClick={handleWatchLinkTreeTutorial}
  disabled={loadingTutorial}
  className="flex items-center gap-2 px-2 py-2 rounded-full backdrop-blur-md bg-white/80 border border-white shadow-md hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5"
>
  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-r from-[#1976D2] to-[#42A5F5] text-white">
    <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
      <path d="M8 5v14l11-7z" />
    </svg>
  </div>

  <span className="font-medium text-gray-700">
    {loadingTutorial ? "Loading..." : "Help Video"}
  </span>
</button>
            <button
              type="button"
              onClick={onClose}
              style={{
                border: "none",
                background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(255, 255, 255, 0.2)",
                color: "#fff",
                borderRadius: 10,
                padding: "6px 10px",
                cursor: "pointer",
                fontWeight: 800,
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
        </div>

        <div style={{ padding: 18, overflowY: "auto", flex: 1 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Search by mobile number</div>
            <div style={{ display: "flex", gap: 10 }}>
              <input
                type="text"
                placeholder="10-digit mobile"
                value={phoneLookup.phone}
                maxLength={10}
                inputMode="numeric"
                onChange={(e) =>
                  setPhoneLookup((p) => ({
                    ...p,
                    phone: extractDigits(e.target.value).slice(0, 10),
                  }))
                }
                style={{
                  flex: 1,
                  borderRadius: 12,
                  border: `2px solid ${primaryColor}22`,
                  padding: "12px 14px",
                  outline: "none",
                  fontWeight: 700,
                }}
              />
              <button
                type="button"
                onClick={handlePhoneLookup}
                disabled={extractDigits(phoneLookup.phone).length !== 10 || phoneLookup.loading}
                style={{
                  borderRadius: 12,
                  padding: "12px 14px",
                  border: `2px solid ${primaryColor}`,
                  background: primaryColor,
                  color: "#fff",
                  cursor:
                    extractDigits(phoneLookup.phone).length !== 10 || phoneLookup.loading
                      ? "not-allowed"
                      : "pointer",
                  fontWeight: 900,
                }}
              >
                {phoneLookup.loading ? "Searching..." : "Search"}
              </button>
            </div>

            {phoneLookup.result && (
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: isDark ? "#f1f5f9" : "#333" }}>
                {phoneLookup.result.exists ? (
                  <>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 900 }}>User:</span> {phoneLookup.result.user?.fullName || "Unknown"}
                    </div>
                    <div style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 900 }}>Family Code:</span> {phoneLookup.result.user?.familyCode || "N/A"}
                    </div>
                    {phoneLookup.result.sameFamily && (
                      <div style={{ color: primaryColor, fontWeight: 900 }}>Already in same family</div>
                    )}
                    {phoneLookup.result.alreadyInTree && (
                      <div style={{ color: "#b45309", fontWeight: 900 }}>Already in your tree</div>
                    )}
                     {!phoneLookup.result.user?.familyCode && (
                      <div style={{ color: "#b45309", fontWeight: 900 }}>This user has no family code</div>
                    )}
                    {phoneLookup.result.notInTree && (
                      <div style={{ color: "#dc2626", fontWeight: 900, marginTop: 4 }}>
                        This user is not placed in their family tree yet. They must be added to their tree first.
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ color: "#6b7280", fontWeight: 800 }}>
                    {phoneLookup.result.message || "User not found"}
                  </div>
                )}
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              margin: "12px 0 16px",
            }}
          >
            <div style={{ flex: 1, height: 1, background: `${primaryColor}22` }} />
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: "#6b7280",
                letterSpacing: 0.6,
              }}
            >
              OR
            </div>
            <div style={{ flex: 1, height: 1, background: `${primaryColor}22` }} />
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Receiver family code</div>
              <div style={{ display: "flex", gap: 10 }}>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    borderRadius: 12,
                    border: `2px solid ${primaryColor}22`,
                    padding: "12px 14px",
                    background: isDark ? "rgba(15, 23, 42, 0.6)" : "#fff",
                  }}
                >
                  <div style={{ fontWeight: 900, color: isDark ? "#f1f5f9" : "#333", marginRight: 10 }}>FAM</div>
                  <input
                    value={receiverFamilyCodeDigits}
                    onChange={(e) => setReceiverFamilyCodeDigits(extractDigits(e.target.value).slice(0, 6))}
                    onPaste={(e) => {
                      const text = e.clipboardData?.getData("text") || "";
                      const digits = extractDigits(text).slice(0, 6);
                      if (digits) {
                        e.preventDefault();
                        setReceiverFamilyCodeDigits(digits);
                      }
                    }}
                    placeholder="Enter family code"
                    maxLength={6}
                    inputMode="numeric"
                    style={{
                      flex: 1,
                      border: "none",
                      outline: "none",
                      fontWeight: 700,
                      minWidth: 0,
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => fetchReceiverFamilyPeople()}
                  disabled={peopleLoading || !canSearchReceiverFamily}
                  style={{
                    borderRadius: 12,
                    padding: "12px 14px",
                    border: `2px solid ${primaryColor}33`,
                    background: isDark ? "rgba(15, 23, 42, 0.6)" : "#fff",
                    cursor: peopleLoading || !canSearchReceiverFamily ? "not-allowed" : "pointer",
                    fontWeight: 900,
                    color: primaryColor,
                  }}
                >
                  {peopleLoading ? "Searching..." : "Search"}
                </button>
              </div>
              {!peopleLoading && !hasSearched && searchDisabledReason && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#6b7280", fontWeight: 700 }}>
                  {searchDisabledReason}
                </div>
              )}
              {!peopleLoading && hasSearched && receiverSearchMessage && (
                <div style={{ marginTop: 8, fontSize: 12, color: "#b45309", fontWeight: 700 }}>
                  {receiverSearchMessage}
                </div>
              )}
            </div>

            <div style={{ width: 200, minWidth: 200 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Relationship</div>
              <select
                value={relationshipType}
                onChange={(e) => {
                  const next = e.target.value;
                  setRelationshipType(next);
                }}
                disabled={relationshipFieldLocked}
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: `2px solid ${primaryColor}22`,
                  padding: "12px 14px",
                  outline: "none",
                  fontWeight: 700,
                  background: relationshipFieldLocked ? "#f8fafc" : "#fff",
                  color: relationshipFieldLocked ? "#374151" : "#111827",
                  cursor: relationshipFieldLocked ? "not-allowed" : "pointer",
                  opacity: 1,
                }}
              >
                {relationshipOptions.includes("sibling") && (
                  <option value="sibling" disabled={!relationshipFieldLocked && !siblingAllowed}>
                    sibling
                  </option>
                )}
                {relationshipOptions.includes("parent") && (
                  <option value="parent" disabled={!relationshipFieldLocked && !parentAllowed}>
                    parent
                  </option>
                )}
                {relationshipOptions.includes("child") && <option value="child">child</option>}
              </select>
              {siblingValidationVisible && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                  {siblingValidationMessage}
                </div>
              )}
            </div>
          </div>

          {showParentRole && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Parent role</div>
              <div
                style={{
                  borderRadius: 12,
                  border: `2px solid ${primaryColor}22`,
                  padding: "12px 14px",
                  background: isDark ? "rgba(15, 23, 42, 0.6)" : "rgba(255, 255, 255, 0.9)",
                  fontWeight: 700,
                }}
              >
                {derivedParentLabel || "Unknown"}
              </div>
              <div
                style={{
                  marginTop: 6,
                  fontSize: 12,
                  color: derivedParentRole ? "#0f766e" : "#b91c1c",
                  fontWeight: 600,
                }}
              >
                {derivedParentRole
                  ? `Auto‑detected as ${derivedParentLabel} based on this card’s gender.`
                  : "Set gender for this card to continue."}
              </div>
            </div>
          )}

          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Receiver person</div>
            <input
              value={personSearch}
              onChange={(e) => setPersonSearch(e.target.value)}
              placeholder={
                peopleLoading
                  ? "Loading receiver family..."
                  : people?.length
                  ? "Search by name / personId / phone"
                  : hasSearched
                  ? "No members found"
                  : "Enter family code and click Search"
              }
              disabled={!people?.length}
              style={{
                width: "100%",
                borderRadius: 12,
                border: `2px solid ${primaryColor}22`,
                padding: "12px 14px",
                outline: "none",
                fontWeight: 600,
                background: people?.length ? (isDark ? "rgba(15, 23, 42, 0.6)" : "#fff") : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)"),
              }}
            />
            {(Boolean(people?.length) || hasSearched) && (
              <div
                style={{
                  marginTop: 10,
                  border: `1px solid ${primaryColor}22`,
                  borderRadius: 12,
                  maxHeight: 220,
                  overflow: "auto",
                  background: isDark ? "rgba(15, 23, 42, 0.6)" : "#fff",
                }}
              >
                {!people?.length ? (
                  <div style={{ padding: 12, color: "#666", fontWeight: 700 }}>
                    {receiverSearchMessage || "No members available."}
                  </div>
                ) : filteredPeople.length === 0 ? (
                  <div style={{ padding: 12, color: "#666", fontWeight: 600 }}>
                    No matches. Try name, personId, or phone digits.
                  </div>
                ) : (
                  filteredPeople.map(({ person: p, disabled, disabledReason }) => {
                    const isSelected = String(selectedPerson?.nodeUid || "") === String(p?.nodeUid || "");
                    const avatarUrl = getPersonImage(p);
                    return (
                      <button
                        key={String(p?.nodeUid || p?.personId || Math.random())}
                        type="button"
                        onClick={() => {
                          if (disabled) return;
                          setSelectedPerson(p);
                        }}
                        disabled={disabled}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          border: "none",
                          background: isSelected ? `${primaryColor}12` : "transparent",
                          cursor: disabled ? "not-allowed" : "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                          opacity: disabled ? 0.55 : 1,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt=""
                              style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", flex: "0 0 auto" }}
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: "50%",
                                background: "rgba(0,0,0,0.08)",
                                flex: "0 0 auto",
                              }}
                            />
                          )}
                          <div style={{ fontWeight: 800, color: isDark ? "#f1f5f9" : "#333", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {p?.name || "Unnamed"}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          {disabled && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#6b7280",
                                background: "rgba(107,114,128,0.12)",
                                padding: "2px 6px",
                                borderRadius: 999,
                              }}
                            >
                              {disabledReason || "Disabled"}
                            </span>
                          )}
                          {!p?.isAppUser && !p?.memberId && (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 800,
                                color: "#b91c1c",
                                background: "#fee2e2",
                                padding: "2px 6px",
                                borderRadius: 999,
                              }}
                            >
                              No App
                            </span>
                          )}
                          <div style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.8 }}>
                            {String(p?.nodeUid || "").slice(0, 8)}…
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {childParentRoleMissing && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>
              Set gender for the selected parent card to continue.
            </div>
          )}

          {selectedPerson && !receiverIsAppUser && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#b91c1c", fontWeight: 700 }}>
              This person doesn’t have an app account yet. Ask them to join the app, then try again.
            </div>
          )}

          {!canSubmit && submitDisabledReason && (
            <div style={{ marginBottom: 12, fontSize: 12, color: "#6b7280", fontWeight: 800 }}>
              {submitDisabledReason}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                borderRadius: 12,
                padding: "12px 14px",
                border: "2px solid rgba(0,0,0,0.15)",
                background: isDark ? "rgba(15, 23, 42, 0.6)" : "#fff",
                cursor: "pointer",
                fontWeight: 900,
              }}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={sendLinkRequest}
              disabled={!canSubmit || loading}
              style={{
                opacity: loading ? 0.85 : 1,
                borderRadius: 12,
                padding: "12px 14px",
                border: `2px solid ${canSubmit && !loading ? primaryColor : "rgba(0,0,0,0.18)"}`,
                background: canSubmit && !loading ? primaryColor : "rgba(0,0,0,0.18)",
                cursor: canSubmit && !loading ? "pointer" : "not-allowed",
                fontWeight: 900,
                color: canSubmit && !loading ? "#fff" : "rgba(255,255,255,0.9)",
              }}
            >
              {loading ? "Sending..." : "Send Link Request"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}






