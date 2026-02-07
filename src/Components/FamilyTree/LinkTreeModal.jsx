import React, { useEffect, useMemo, useState } from "react";
import Swal from "sweetalert2";
import { throwIfNotOk } from "../../utils/apiMessages";

const DEFAULT_PRIMARY = "#1976D2";

function normalizeFamilyCode(val) {
  return String(val || "").trim().toUpperCase();
}

export default function LinkTreeModal({
  isOpen,
  onClose,
  senderPerson,
  token,
  primaryColor = DEFAULT_PRIMARY,
  onSent,
}) {
  const senderNodeUid = String(senderPerson?.nodeUid || "").trim();

  const [receiverFamilyCode, setReceiverFamilyCode] = useState("");
  const [relationshipType, setRelationshipType] = useState("sibling");

  const [loading, setLoading] = useState(false);
  const [peopleLoading, setPeopleLoading] = useState(false);
  const [people, setPeople] = useState([]);
  const [personSearch, setPersonSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState(null);

  const receiverNodeUid = String(selectedPerson?.nodeUid || "").trim();
  const receiverIsAppUser = Boolean(selectedPerson?.isAppUser || selectedPerson?.memberId);

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

  const canSubmit = Boolean(
    senderNodeUid &&
      normalizeFamilyCode(receiverFamilyCode) &&
      receiverNodeUid &&
      ["parent", "child", "sibling"].includes(relationshipType) &&
      receiverIsAppUser &&
      (!needsParentRole || Boolean(derivedParentRole)),
  );

  useEffect(() => {
    if (!isOpen) return;
    // Reset form every time modal opens (prevents stale values).
    setReceiverFamilyCode("");
    setRelationshipType("sibling");
    setPeople([]);
    setPersonSearch("");
    setSelectedPerson(null);
    setLoading(false);
    setPeopleLoading(false);
  }, [isOpen]);

  const filteredPeople = useMemo(() => {
    const q = String(personSearch || "").trim().toLowerCase();
    const base = Array.isArray(people) ? people : [];
    if (!q) return base.slice(0, 30);

    return base
      .filter((p) => {
        const name = String(p?.name || "").toLowerCase();
        const id = String(p?.personId ?? "").toLowerCase();
        return name.includes(q) || id.includes(q);
      })
      .slice(0, 30);
  }, [people, personSearch]);

  const fetchReceiverFamilyPeople = async () => {
    const code = normalizeFamilyCode(receiverFamilyCode);
    if (!code) {
      await Swal.fire({
        icon: "warning",
        title: "Receiver family code required",
        text: "Please enter a valid family code to search.",
        confirmButtonColor: primaryColor,
      });
      return;
    }

    // Boundary: avoid absurdly long inputs that can lead to slow queries / bad UX.
    if (code.length > 30) {
      await Swal.fire({
        icon: "warning",
        title: "Family code looks invalid",
        text: "Please check the family code and try again.",
        confirmButtonColor: primaryColor,
      });
      return;
    }

    try {
      setPeopleLoading(true);
      const authToken = token || localStorage.getItem("access_token");
      if (!authToken) throw new Error("Your session has expired. Please log in again.");

      const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
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
    } catch (e) {
      await Swal.fire({
        icon: "error",
        title: "Search failed",
        text: e?.message || "Unable to load the target family members.",
        confirmButtonColor: primaryColor,
      });
    } finally {
      setPeopleLoading(false);
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

    const code = normalizeFamilyCode(receiverFamilyCode);
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
          background: "rgba(255,255,255,0.98)",
          borderRadius: 18,
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
          overflow: "hidden",
          border: `1px solid ${primaryColor}20`,
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
            <span style={{ fontSize: 12, opacity: 0.9, fontWeight: 600 }}>
              (Admin only)
            </span>
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

        <div style={{ padding: 18 }}>
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Sender nodeUid</div>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `2px solid ${primaryColor}22`,
                background: "rgba(255,255,255,0.9)",
                fontFamily: "monospace",
                fontSize: 12,
                wordBreak: "break-all",
              }}
            >
              {senderNodeUid || "—"}
            </div>
          </div>

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>Receiver family code</div>
              <div style={{ display: "flex", gap: 10 }}>
                <input
                  value={receiverFamilyCode}
                  onChange={(e) => setReceiverFamilyCode(e.target.value)}
                  placeholder="Enter family code"
                  maxLength={30}
                  style={{
                    flex: 1,
                    borderRadius: 12,
                    border: `2px solid ${primaryColor}22`,
                    padding: "12px 14px",
                    outline: "none",
                    textTransform: "uppercase",
                    fontWeight: 700,
                  }}
                />
                <button
                  type="button"
                  onClick={fetchReceiverFamilyPeople}
                  disabled={peopleLoading}
                  style={{
                    borderRadius: 12,
                    padding: "12px 14px",
                    border: `2px solid ${primaryColor}33`,
                    background: "#fff",
                    cursor: peopleLoading ? "not-allowed" : "pointer",
                    fontWeight: 900,
                    color: primaryColor,
                  }}
                >
                  {peopleLoading ? "Searching..." : "Search"}
                </button>
              </div>
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
                <option value="sibling">sibling</option>
                <option value="parent">parent</option>
                <option value="child">child</option>
              </select>
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
                people?.length ? "Search by name/personId" : "Search after loading the receiver family"
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
            {Boolean(people?.length) && (
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
                {filteredPeople.length === 0 ? (
                  <div style={{ padding: 12, color: "#666", fontWeight: 600 }}>
                    No matches.
                  </div>
                ) : (
                  filteredPeople.map((p) => {
                    const isSelected = String(selectedPerson?.nodeUid || "") === String(p?.nodeUid || "");
                    return (
                      <button
                        key={String(p?.nodeUid || p?.personId || Math.random())}
                        type="button"
                        onClick={() => setSelectedPerson(p)}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "10px 12px",
                          border: "none",
                          background: isSelected ? `${primaryColor}12` : "transparent",
                          cursor: "pointer",
                          display: "flex",
                          justifyContent: "space-between",
                          gap: 10,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: "#222" }}>
                          {p?.name || "Unnamed"}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Receiver nodeUid</div>
            <div
              style={{
                padding: "10px 12px",
                borderRadius: 12,
                border: `2px solid ${primaryColor}22`,
                background: "rgba(255,255,255,0.9)",
                fontFamily: "monospace",
                fontSize: 12,
                wordBreak: "break-all",
                minHeight: 42,
              }}
            >
              {receiverNodeUid || "—"}
            </div>
          </div>

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
              disabled={loading || !canSubmit}
              style={{
                borderRadius: 12,
                padding: "12px 14px",
                border: "none",
                background: loading || !canSubmit ? "rgba(0,0,0,0.2)" : primaryColor,
                color: "#fff",
                cursor: loading || !canSubmit ? "not-allowed" : "pointer",
                fontWeight: 900,
                minWidth: 160,
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
