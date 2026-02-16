import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { throwIfNotOk } from "../../utils/apiMessages";

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
}) {
  const senderNodeUid = String(senderPerson?.nodeUid || "").trim();

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
  const [relationshipType, setRelationshipType] = useState("parent");

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

  const senderParents = asList(senderPerson?.parents);
  const receiverParents = asList(selectedPerson?.parents);
  const senderHasParents = senderParents.length > 0;
  const receiverHasParents = receiverParents.length > 0;
  const parentAllowed = !senderHasParents;
  const siblingAllowed = senderHasParents && receiverHasParents;

  const relationshipOptions = React.useMemo(() => {
    if (senderHasParents) {
      return ["sibling", "child"];
    }
    return ["parent", "child"];
  }, [senderHasParents]);

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
    // Keep the selected relationship valid as sender/receiver changes.
    // This mirrors the radial menu behavior:
    // - sender has no parents => allow parent + child
    // - sender has parents    => allow sibling + child
    setRelationshipType((prev) => {
      // If current selection is still valid, keep it.
      if (relationshipOptions.includes(prev)) {
        // Extra safety: if sibling is selected but receiver doesn't have parents, fallback to child.
        if (prev === "sibling" && !siblingAllowed) return "child";
        // If parent is selected but sender already has parents, fallback to child.
        if (prev === "parent" && !parentAllowed) return "child";
        return prev;
      }

      // Otherwise choose a sensible default.
      if (senderHasParents) {
        return siblingAllowed ? "sibling" : "child";
      }
      return "parent";
    });
  }, [relationshipOptions, siblingAllowed, parentAllowed, senderHasParents]);

  const formattedReceiverFamilyCode = formatFamilyCodeFromDigits(receiverFamilyCodeDigits);
  const canSubmit = Boolean(
    senderNodeUid &&
      formattedReceiverFamilyCode &&
      receiverNodeUid &&
      ["parent", "child", "sibling"].includes(relationshipType) &&
      receiverIsAppUser &&
      (!needsParentRole || Boolean(derivedParentRole)),
  );

  const canSearchReceiverFamily = extractDigits(receiverFamilyCodeDigits).length === 6;
  const searchDisabledReason = !receiverFamilyCodeDigits
    ? "Enter receiver family code"
    : extractDigits(receiverFamilyCodeDigits).length !== 6
    ? "Family code must be 6 digits"
    : "";

  const submitDisabledReason = !senderNodeUid
    ? "Select a valid sender card"
    : !formattedReceiverFamilyCode
    ? "Enter receiver family code"
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
    setRelationshipType(asList(senderPerson?.parents).length > 0 ? "child" : "parent");
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
      const isSelectable = notAlreadyInTree(p);
      return {
        person: p,
        disabled: !isSelectable,
        disabledReason: !isSelectable ? "Already in tree" : "",
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
  }, [people, personSearch, existingMemberIds, existingCanonicalKeys]);

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
    const alreadyInTree =
      (mid && existingMemberSet.has(mid)) ||
      (String(selectedPerson?.canonicalFamilyCode || "").trim() &&
        String(selectedPerson?.canonicalNodeUid || "").trim() &&
        existingCanonicalSet.has(key));

    if (alreadyInTree) {
      setSelectedPerson(null);
    }
  }, [selectedPerson, existingMemberIds, existingCanonicalKeys]);

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

    try {
      setHasSearched(true);
      setReceiverSearchMessage("");
      setPeopleLoading(true);
      const authToken = token || localStorage.getItem("access_token");
      if (!authToken) throw new Error("Your session has expired. Please log in again.");

      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const res = await fetch(`${API_BASE}/family/tree/${encodeURIComponent(code)}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          accept: "application/json",
        },
      });
      await throwIfNotOk(res, { fallback: "We couldn’t load that family right now." });
      const data = await res.json();
      const nextPeople = Array.isArray(data?.people) ? data.people : [];
      setPeople(nextPeople);
      setPersonSearch("");
      setSelectedPerson(null);

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
      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
      const res = await fetch(`${API_BASE}/user/lookup?phone=${encodeURIComponent(cleaned)}`);
      const data = await res.json().catch(() => ({}));
      const famCode = normalizeFamilyCode(data?.user?.familyCode);
      const sameFamily = Boolean(famCode) && famCode === normalizeFamilyCode(currentFamilyCode);
      const alreadyInTree = Boolean(data?.user?.id) && existingMemberIds?.includes?.(Number(data.user.id));

      const nextResult = { ...data, sameFamily, alreadyInTree, cleaned };
      setPhoneLookup((p) => ({ ...p, loading: false, result: nextResult }));

      if (data?.exists && famCode && !sameFamily && !alreadyInTree) {
        setReceiverFamilyCodeDigits(extractDigits(famCode));
        const loaded = await fetchReceiverFamilyPeople(extractDigits(famCode));
        const uid = Number(data?.user?.id);
        const match = Array.isArray(loaded)
          ? loaded.find((pp) => Number(pp?.memberId || pp?.userId) === uid)
          : null;
        if (match) {
          setSelectedPerson(match);
        }
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
      const authToken = token || localStorage.getItem("access_token");
      if (!authToken) throw new Error("Your session has expired. Please log in again.");

      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
      const res = await fetch(`${API_BASE}/family/request-tree-link`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
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

      await throwIfNotOk(res, { fallback: "We couldn’t send the link request. Please try again." });
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
            const revokeRes = await fetch(`${API_BASE}/family/revoke-tree-link-request`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${authToken}`,
                accept: "application/json",
              },
              body: JSON.stringify({ treeLinkRequestId: requestId }),
            });
            await throwIfNotOk(revokeRes, { fallback: "We couldn’t revoke that request." });
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
        style={{
          width: "100%",
          maxWidth: 680,
          maxHeight: "calc(100vh - 24px)",
          height: "auto",
          background: "rgba(255,255,255,0.98)",
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
          <button
            type="button"
            onClick={onClose}
            style={{
              border: "none",
              background: "rgba(255,255,255,0.2)",
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
              <div style={{ marginTop: 10, fontSize: 13, fontWeight: 700, color: "#111" }}>
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
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#111", marginRight: 10 }}>FAM</div>
                  <input
                    value={receiverFamilyCodeDigits}
                    onChange={(e) => setReceiverFamilyCodeDigits(extractDigits(e.target.value).slice(0, 6))}
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
                    background: "#fff",
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
                style={{
                  width: "100%",
                  borderRadius: 12,
                  border: `2px solid ${primaryColor}22`,
                  padding: "12px 14px",
                  outline: "none",
                  fontWeight: 700,
                  background: "#fff",
                }}
              >
                {relationshipOptions.includes("sibling") && (
                  <option value="sibling" disabled={!siblingAllowed}>
                    sibling
                  </option>
                )}
                {relationshipOptions.includes("parent") && (
                  <option value="parent" disabled={!parentAllowed}>
                    parent
                  </option>
                )}
                {relationshipOptions.includes("child") && <option value="child">child</option>}
              </select>
              {relationshipOptions.includes("sibling") && !siblingAllowed && (
                <div style={{ marginTop: 6, fontSize: 12, color: "#b45309", fontWeight: 600 }}>
                  Sibling is enabled only when both sender and receiver have parents.
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
                  background: "rgba(255,255,255,0.9)",
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
                background: people?.length ? "#fff" : "rgba(0,0,0,0.03)",
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
                  background: "#fff",
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
                          <div style={{ fontWeight: 800, color: "#222", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
                background: "#fff",
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
