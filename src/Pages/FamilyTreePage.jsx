import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";

import { useUser } from "../Contexts/UserContext";

import { FamilyTree } from "../utils/FamilyTree";

import { autoArrange } from "../utils/TreeLayout";

import { calculateHierarchicalLayout } from "../utils/HierarchicalTreeLayout";

import Person from "../Components/FamilyTree/Person";

import TreeConnections from "../Components/FamilyTree/TreeConnections";

import HierarchicalConnections from "../Components/FamilyTree/HierarchicalConnections";

import RadialMenu from "../Components/FamilyTree/RadialMenu";

import AddPersonModal from "../Components/FamilyTree/AddPersonModal";
import LinkTreeModal from "../Components/FamilyTree/LinkTreeModal";

import SearchBar from "../Components/FamilyTree/SearchBar";

import NoFamilyView from "../Components/NoFamilyView";

import PendingApprovalView from "../Components/PendingApprovalView";

import CreateFamilyModal from "../Components/CreateFamilyModal";

import JoinFamilyModal from "../Components/JoinFamilyModal";

import { useLanguage } from "../Contexts/LanguageContext";

import RelationshipCalculator from "../utils/relationshipCalculator";

import html2canvas from "html2canvas";

import LanguageSwitcher from "../Components/LanguageSwitcher";

import LoadingSpinner from "../Components/LoadingSpinner";

import Swal from "sweetalert2";

import { FaPlus, FaSave, FaArrowLeft, FaHome, FaMinus } from "react-icons/fa";

import {
  deleteFamilyMember,
  deletePerson as deletePersonApi,
  fetchFamilyTreeAggregate,
  getMembersNotInTree,
  permanentlyDeleteStructuralDummy as permanentlyDeleteStructuralDummyApi,
  replaceStructuralDummy as replaceStructuralDummyApi,
  selfRemoveFromFamily,
} from "../utils/familyTreeApi";

import { useLocation, useNavigate, useParams } from "react-router-dom";

import { FamilyTreeProvider } from "../Contexts/FamilyTreeContext";

import { authFetchResponse } from "../utils/authFetch";
import { clearAuthData, getToken } from "../utils/auth";

// Utility for authenticated fetch with logout on 401 or error

const authFetch = async (url, options = {}) => {
  try {
    const response = await authFetchResponse(url, {
      ...options,
      skipThrow: true,
    });
    if (response.status === 401) {
      clearAuthData();
      window.location.href = "/login";

      return null;
    }

    return response;
  } catch (err) {
    // Only logout on 401, not on network error

    Swal.fire({
      icon: "error",

      title: "Network Error",

      text: "Network error or server error. Please try again.",
    });

    return null;
  }
};

const normalizeExternalLinked = (value) =>
  value === true || value === 1 || value === "true" || value === "1";

const createStructuralDummyDialogState = () => ({
  isOpen: false,
  mode: "",
  person: null,
  candidates: [],
  loadingCandidates: false,
  selectedReplacementUserId: "",
  submitting: false,
  error: "",
});

const FamilyTreePage = () => {
  const [tree, setTree] = useState(null);

  const [stats, setStats] = useState({
    total: 1,

    male: 1,

    female: 0,

    generations: 1,
  });

  const [dagreGraph, setDagreGraph] = useState(null);

  const [dagreLayoutOffsetX, setDagreLayoutOffsetX] = useState(0);

  const [dagreLayoutOffsetY, setDagreLayoutOffsetY] = useState(0);

  const [hierarchicalLayout, setHierarchicalLayout] = useState({
    positions: new Map(),

    connections: [],
  });

  const [useHierarchical, setUseHierarchical] = useState(true); // Use hierarchical layout by default

  const unlinkExternalCard = async (person) => {
    if (!person) return;

    const familyCodeToUse = code || (userInfo && userInfo.familyCode);

    if (!familyCodeToUse || !person.nodeUid) {
      await Swal.fire({
        icon: "error",

        title: "Missing Data",

        text: "Missing familyCode or nodeUid",
      });

      return;
    }

    const result = await Swal.fire({
      icon: "warning",

      title: "Unlink this card?",

      text: "This will remove the linked card from this tree (it will not delete the person in their original family).",

      showCancelButton: true,

      confirmButtonText: "Yes, unlink",

      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const response = await authFetch(
      `${import.meta.env.VITE_API_BASE_URL}/family/unlink-tree-link`,

      {
        method: "POST",

        headers: {
          "Content-Type": "application/json",

          accept: "application/json",
        },

        body: JSON.stringify({
          familyCode: familyCodeToUse,

          nodeUid: person.nodeUid,
        }),
      },
    );

    if (!response) return;

    if (!response.ok) {
      let msg = "Failed to unlink";

      try {
        const errBody = await response.json();

        if (errBody?.message) msg = errBody.message;
      } catch (e) { }

      await Swal.fire({
        icon: "error",

        title: "Unlink Failed",

        text: msg,
      });

      return;
    }

    await Swal.fire({
      icon: "success",

      title: "Unlinked",

      text: "Linked card removed successfully.",
    });

    setHasUnsavedChanges(false);

    window.location.reload();
  };

  const [radialMenu, setRadialMenu] = useState({
    isActive: false,

    position: { x: 0, y: 0 },

    items: [],

    activePersonId: null,
  });

  const [modal, setModal] = useState({
    isOpen: false,

    action: { type: "", person: null },
  });

  const [linkTreeModal, setLinkTreeModal] = useState({
    isOpen: false,
    person: null,
  });
  const [structuralDummyDialog, setStructuralDummyDialog] = useState(
    createStructuralDummyDialogState,
  );

  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);

  const [isJoinFamilyModalOpen, setIsJoinFamilyModalOpen] = useState(false);

  const [debugPanel, setDebugPanel] = useState(false);

  const containerRef = useRef(null);

  const treeCanvasRef = useRef(null);

  const [saveStatus, setSaveStatus] = useState("idle"); // idle | loading | success | error

  const [saveMessage, setSaveMessage] = useState("");

  const [selectedPersonId, setSelectedPersonId] = useState(null);

  const [treeLoading, setTreeLoading] = useState(true);

  const [zoom, setZoom] = useState(1);

  const [showMobileHeader, setShowMobileHeader] = useState(true);

  const [lastScrollY, setLastScrollY] = useState(0);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // Track changes

  // Search state

  const [searchResults, setSearchResults] = useState([]);

  const [highlightedPersonId, setHighlightedPersonId] = useState(null);

  const [isSearchActive, setIsSearchActive] = useState(false);

  // Touch zoom/pinch state

  const [isPinching, setIsPinching] = useState(false);

  const pinchStateRef = useRef({ startDist: 0, startZoom: 1 });

  const lastTapRef = useRef(0);
  const bootstrapRootAutoSavePendingRef = useRef(false);

  const { language } = useLanguage();

  const { userInfo, userLoading } = useUser();

  const navigate = useNavigate();

  const location = useLocation();

  const { code } = useParams(); // Get familyCode from URL if present

  // Allow editing only when viewing user's own birth family tree and role permits

  const isOwnTree = !code || (userInfo && code === userInfo.familyCode);

  const isLinkedMode = useMemo(() => {
    try {
      const params = new URLSearchParams(location.search);

      return params.get("mode") === "linked";
    } catch (_) {
      return false;
    }
  }, [location.search]);

  const canEdit =
    !isLinkedMode &&
    isOwnTree &&
    userInfo &&
    (userInfo.role === 2 || userInfo.role === 3);

  // Determine current family code used for this view

  const familyCodeToUse = code || (userInfo && userInfo.familyCode);

  const isCurrentUserPlacedInTree = useMemo(() => {
    if (!tree || !userInfo?.userId) return true;

    try {
      return Array.from(tree.people.values()).some(
        (p) => Number(p?.memberId) === Number(userInfo.userId),
      );
    } catch (_) {
      return true;
    }
  }, [tree, userInfo?.userId]);

  // Only show the "joined but not placed" banner for the user's own active family.

  // When viewing spouse/associated families via /family-tree/:code, the viewer may not be a member

  // and should NOT be treated as a joined-but-not-placed member.

  const needsPlacementBanner =
    isOwnTree && !canEdit && !isCurrentUserPlacedInTree;

  // Zoom helper functions

  const zoomIn = () => setZoom((prev) => Math.min(2, prev + 0.1));

  const zoomOut = () => setZoom((prev) => Math.max(0.5, prev - 0.1));

  // Auto-hide mobile header on scroll

  useEffect(() => {
    const handleScroll = () => {
      const currentScrollY = window.scrollY;

      if (currentScrollY < lastScrollY || currentScrollY < 50) {
        // Scrolling up or at top - show header

        setShowMobileHeader(true);
      } else if (currentScrollY > lastScrollY && currentScrollY > 100) {
        // Scrolling down - hide header

        setShowMobileHeader(false);
      }

      setLastScrollY(currentScrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [lastScrollY]);

  const resetZoom = () => setZoom(1);

  // Set initial zoom based on screen size

  useEffect(() => {
    const bucketRef = { current: null };
    let rafId = null;

    const computeBucketAndZoom = () => {
      const w = window.innerWidth;
      if (w <= 640) return { bucket: "mobile", zoom: 0.7 };
      if (w <= 1024) return { bucket: "tablet", zoom: 0.85 };
      return { bucket: "desktop", zoom: 1 };
    };

    const applyZoomForViewport = () => {
      const next = computeBucketAndZoom();
      if (bucketRef.current === next.bucket) return;
      bucketRef.current = next.bucket;
      setZoom((prev) => (prev === next.zoom ? prev : next.zoom));
    };

    const handleResize = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        applyZoomForViewport();
      });
    };

    applyZoomForViewport();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
    };
  }, []);

  // Check approval status and familyCode

  useEffect(() => {
    if (userLoading) return; // Wait for user data to load

    if (!userInfo) {
      // User not logged in, redirect to login

      navigate("/login");

      return;
    }

    // Access gates handled in-page
  }, [userInfo, userLoading, navigate]);

  const handleCreateFamily = () => {
    setIsCreateFamilyModalOpen(true);
  };

  const handleJoinFamily = () => {
    setIsJoinFamilyModalOpen(true);
  };

  const handleFamilyCreated = () => {
    setIsCreateFamilyModalOpen(false);
    globalThis.location.reload();
  };

  const handleFamilyJoined = () => {
    setIsJoinFamilyModalOpen(false);
    globalThis.location.reload();
  };

  const showAccessLoading = userLoading || !userInfo;

  const hasFamily = Boolean(userInfo?.familyCode);
  const pendingFamilyCode = userInfo?.pendingFamilyCode || '';
  const hasPendingRequest = userInfo?.approveStatus === "pending" && Boolean(pendingFamilyCode);

  const isApproved = userInfo?.approveStatus === "approved";

  const accessView = !hasFamily && !hasPendingRequest ? (
    <NoFamilyView
      onCreateFamily={handleCreateFamily}
      onJoinFamily={handleJoinFamily}
    />
  ) : !isApproved ? (
    <PendingApprovalView
      familyCode={pendingFamilyCode || userInfo.familyCode}
      onJoinFamily={handleJoinFamily}
    />
  ) : null;

  const showFullScreenLoading = showAccessLoading || (!tree && treeLoading);

  const showWaitForAdmin =
    !showAccessLoading &&
    !accessView &&
    !canEdit &&
    (!tree || tree.people.size === 0);

  // Search handlers - memoized to prevent infinite re-renders

  const handleSearchResults = useCallback((results) => {
    setSearchResults(results);

    setIsSearchActive(results.length > 0);
  }, []);

  const handleFocusPerson = useCallback(
    (personId, person) => {
      setHighlightedPersonId(personId);

      setSelectedPersonId(personId);

      // Scroll to the person's position accounting for zoom level

      if (containerRef.current && person) {
        const memberCount = tree ? tree.people.size : 0;

        const personSize = memberCount > 50 ? 80 : 100;

        // Apply zoom scaling to the person's coordinates

        const scaledX = person.x * zoom;

        const scaledY = person.y * zoom;

        const targetX = scaledX - containerRef.current.clientWidth / 2;

        const targetY = scaledY - containerRef.current.clientHeight / 2;

        containerRef.current.scrollTo({
          left: targetX,

          top: targetY,

          behavior: "smooth",
        });
      }
    },

    [tree, zoom],
  );

  const handleClearSearch = useCallback(() => {
    setSearchResults([]);

    setHighlightedPersonId(null);

    setIsSearchActive(false);

    setSelectedPersonId(null);
  }, []);

  // Helpers for pinch-to-zoom on mobile

  const clampZoom = (z) => Math.max(0.1, Math.min(2, z));

  const distance = (touches) => {
    const [a, b] = [touches[0], touches[1]];

    const dx = a.clientX - b.clientX;

    const dy = a.clientY - b.clientY;

    return Math.hypot(dx, dy);
  };

  const handleTouchStart = (e) => {
    if (!containerRef.current) return;

    if (e.touches.length === 2) {
      // Start pinch

      setIsPinching(true);

      pinchStateRef.current.startDist = distance(e.touches);

      pinchStateRef.current.startZoom = zoom;
    } else if (e.touches.length === 1) {
      const now = Date.now();

      if (now - lastTapRef.current < 300) {
        // Double tap to zoom in

        setZoom((prev) => clampZoom(+(prev + 0.2).toFixed(2)));
      }

      lastTapRef.current = now;
    }
  };

  const handleTouchMove = (e) => {
    if (!containerRef.current) return;

    if (isPinching && e.touches.length === 2) {
      e.preventDefault();

      const newDist = distance(e.touches);

      const scale = newDist / Math.max(1, pinchStateRef.current.startDist);

      const newZoom = clampZoom(
        +(pinchStateRef.current.startZoom * scale).toFixed(3),
      );

      setZoom(newZoom);
    }
  };

  const handleTouchEnd = () => {
    if (isPinching) setIsPinching(false);
  };

  // Warn user before leaving page with unsaved changes

  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges) {
        e.preventDefault();

        e.returnValue =
          "You have unsaved changes. Are you sure you want to leave?";

        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  // Initialize tree (now with API/sample data support)

  useEffect(() => {
    const initializeTree = async () => {
      // Use code from URL if present, else fallback to user's main familyCode

      const familyCodeToUse = code || (userInfo && userInfo.familyCode);

      console.log(" Debug - code from URL:", code);

      console.log(" Debug - userInfo.familyCode:", userInfo?.familyCode);

      console.log(" Debug - familyCodeToUse:", familyCodeToUse);

      // Read optional focus user and source from query string (use local var; state would be async)

      let focusFromQuery = null;

      let focusNameFromQuery = null;

      let sourceFromQuery = null;

      try {
        const params = new URLSearchParams(window.location.search);

        const focus = params.get("focus");

        focusFromQuery = focus ? String(focus) : null;

        const fName = params.get("focusName");

        focusNameFromQuery = fName ? String(fName) : null;

        const source = params.get("source");

        sourceFromQuery = source ? String(source) : null;
      } catch { }

      if (!userInfo || !familyCodeToUse) {
        console.log(" Debug - Missing userInfo or familyCodeToUse");

        setTreeLoading(false);

        return;
      }

      setTreeLoading(true);

      let data = null;

      try {
        const apiUrl = `${import.meta.env.VITE_API_BASE_URL
          }/family/tree/${familyCodeToUse}`;

        console.log(" Debug - Making API call to:", apiUrl);

        const response = await authFetch(apiUrl, {
          headers: { accept: "*/*" },
        });

        // authFetch can return null on 401 or network error

        if (!response) {
          setTreeLoading(false);

          return;
        }

        console.log(" Debug - Response status:", response.status);

        if (response.status === 403) {
          // BLOCK OVERRIDE: Removed legacy family-level block UI state view.
          const result = await Swal.fire({
            icon: "error",
            title: "Access Restricted",
            text: "You do not have permission to view this family tree.",
            showCloseButton: true,
            showCancelButton: true,
            confirmButtonText: "Go to My Family",
            cancelButtonText: "Close",
            allowOutsideClick: true,
            allowEscapeKey: true,
          });

          if (result.isConfirmed) {
            navigate("/my-family");
          }

          setTree(null);
          setTreeLoading(false);

          return;
        }

        if (response.ok) {
          data = await response.json();

          console.log(" Debug - API response data:", data);
        } else {
          console.log(
            " Debug - API call failed with status:",

            response.status,
          );
        }
      } catch (err) {
        console.log(" Debug - API call error:", err);

        data = null;
      }

      if (!data || !data.people || data.people.length === 0) {
        // No saved tree yet

        if (!canEdit) {
          bootstrapRootAutoSavePendingRef.current = false;
          setTree(null);
        } else {
          // Admin can start a new tree with logged-in user as root

          if (!userInfo) return; // Wait for userInfo to load

          const newTree = new FamilyTree();

          newTree.addPerson({
            name: userInfo.name,

            gender: userInfo.gender,

            age: userInfo.age,

            img: userInfo.profileUrl,

            dob: userInfo.dob,

            memberId: userInfo.userId, // Ensure root has userId
          });

          setTree(newTree);
          // This is a local draft root (no DB tree exists yet); trigger one-shot autosave.
          setHasUnsavedChanges(true);
          bootstrapRootAutoSavePendingRef.current = true;

          updateStats(newTree);

          setTree((prev) => {
            const arranged = arrangeTree(newTree);
            return arranged || newTree;
          });
        }
      } else {
        bootstrapRootAutoSavePendingRef.current = false;
        // Data exists, build tree from data

        const newTree = new FamilyTree();

        newTree.people = new Map();

        data.people.forEach((person) => {
          newTree.people.set(person.id, {
            ...person,

            isExternalLinked: normalizeExternalLinked(person.isExternalLinked),

            memberId: person.memberId !== undefined ? person.memberId : null,

            // Preserve userId explicitly for robust matching

            userId:
              person.userId !== undefined
                ? person.userId
                : person.memberId !== undefined
                  ? person.memberId
                  : null,

            // Normalize name for matching

            name:
              typeof person.name === "string"
                ? person.name.trim()
                : person.name,

            parents: new Set((person.parents || []).map((id) => Number(id))),

            children: new Set((person.children || []).map((id) => Number(id))),

            spouses: new Set((person.spouses || []).map((id) => Number(id))),

            siblings: new Set((person.siblings || []).map((id) => Number(id))),
          });
        });

        newTree.nextId =
          Math.max(...data.people.map((p) => parseInt(p.id))) + 1;

        // Set rootId priority: focus param -> logged-in user's userId (only if placed) -> family admin/creator -> top-most generation -> first person

        let rootPersonId = null;

        const focusStr = focusFromQuery;

        if (focusStr) {
          for (const [personId, personObj] of newTree.people.entries()) {
            // Prefer memberId match (this is the canonical user id in most payloads), then fallback to userId

            if (
              (personObj.memberId && String(personObj.memberId) === focusStr) ||
              (personObj.userId && String(personObj.userId) === focusStr)
            ) {
              rootPersonId = personId;

              break;
            }
          }
        }

        // Fallback: focus by name if id-based match fails

        if (rootPersonId === null && focusNameFromQuery) {
          const targetName = String(focusNameFromQuery).trim().toLowerCase();

          // Exact (case-insensitive) match

          for (const [personId, personObj] of newTree.people.entries()) {
            if (
              personObj.name &&
              String(personObj.name).trim().toLowerCase() === targetName
            ) {
              rootPersonId = personId;

              break;
            }
          }

          // StartsWith match

          if (rootPersonId === null) {
            for (const [personId, personObj] of newTree.people.entries()) {
              if (
                personObj.name &&
                String(personObj.name)
                  .trim()

                  .toLowerCase()

                  .startsWith(targetName)
              ) {
                rootPersonId = personId;

                break;
              }
            }
          }

          // Includes match

          if (rootPersonId === null) {
            for (const [personId, personObj] of newTree.people.entries()) {
              if (
                personObj.name &&
                String(personObj.name).trim().toLowerCase().includes(targetName)
              ) {
                rootPersonId = personId;

                break;
              }
            }
          }
        }

        const isViewerPlacedInThisTree = (() => {
          try {
            const userIdStr = String(userInfo.userId);

            for (const [, personObj] of newTree.people.entries()) {
              if (
                personObj.memberId &&
                String(personObj.memberId) === userIdStr
              ) {
                return true;
              }
            }
          } catch (_) { }

          return false;
        })();

        if (rootPersonId === null && isViewerPlacedInThisTree) {
          const userIdStr = String(userInfo.userId);

          for (const [personId, personObj] of newTree.people.entries()) {
            if (
              personObj.memberId &&
              String(personObj.memberId) === userIdStr
            ) {
              rootPersonId = personId;

              break;
            }
          }
        }

        // Only attempt a name-based root match when the viewer is already placed in the tree.

        if (rootPersonId === null && isViewerPlacedInThisTree) {
          for (const [personId, personObj] of newTree.people.entries()) {
            if (personObj.name && personObj.name === userInfo.name) {
              rootPersonId = personId;

              break;
            }
          }
        }

        // If viewer is not placed yet, start from the family creator/admin if possible.

        if (rootPersonId === null && !isViewerPlacedInThisTree) {
          try {
            const familyRes = await fetch(
              `${import.meta.env.VITE_API_BASE_URL}/family/code/${familyCodeToUse}`,

              { headers: { accept: "application/json" } },
            );

            const familyJson = await familyRes.json().catch(() => null);

            const createdBy =
              familyJson?.createdBy ?? familyJson?.data?.createdBy;

            if (createdBy) {
              const createdByStr = String(createdBy);

              for (const [personId, personObj] of newTree.people.entries()) {
                if (
                  personObj.memberId &&
                  String(personObj.memberId) === createdByStr
                ) {
                  rootPersonId = personId;

                  break;
                }
              }
            }
          } catch (_) {
            // ignore
          }
        }

        // Fallback: top-most generation (smallest generation value)

        if (rootPersonId === null) {
          let bestId = null;

          let bestGen = Infinity;

          for (const [personId, personObj] of newTree.people.entries()) {
            const g = Number(personObj?.generation);

            if (!Number.isFinite(g)) continue;

            if (g < bestGen) {
              bestGen = g;

              bestId = personId;
            }
          }

          if (bestId !== null) rootPersonId = bestId;
        }

        // Final fallback: use the first person in the data

        if (rootPersonId !== null) {
          console.log("Focus selection -> using root person", {
            rootPersonId,

            focusFromQuery,

            focusNameFromQuery,
          });

          newTree.rootId = rootPersonId;
        } else {
          console.warn("Focus selection -> falling back to first person", {
            focusFromQuery,

            focusNameFromQuery,
          });

          newTree.rootId = data.people[0].id;
        }

        // FIX GENERATION INCONSISTENCIES: Ensure spouses have same generation

        newTree.people.forEach((person) => {
          if (person.spouses && person.spouses.size > 0) {
            person.spouses.forEach((spouseId) => {
              const spouse = newTree.people.get(spouseId);

              if (spouse && spouse.generation !== person.generation) {
                console.log(
                  ` Initial load: Fixing generation for spouse ${spouse.name}: ${spouse.generation} → ${person.generation}`,
                );

                spouse.generation = person.generation;
              }
            });
          }
        });

        setTree(newTree);

        updateStats(newTree);

        setTree((prev) => {
          const arranged = arrangeTree(newTree);
          return arranged || newTree;
        });
      }

      setTreeLoading(false);
    };

    if (userInfo) initializeTree();
  }, [userInfo, code]);

  const updateStats = (treeInstance) => {
    setStats(treeInstance.getStats());
  };

  const arrangeTree = useCallback((treeInstance) => {
    // For large trees, show loading state during arrangement

    const memberCount = treeInstance.people.size;

    if (useHierarchical) {
      // Use hierarchical layout (GoJS-inspired)

      const layout = calculateHierarchicalLayout(treeInstance);

      // CRITICAL FIX: Create a NEW tree instance with positions applied (immutable update)
      const positionedTree = new FamilyTree();
      positionedTree.people = new Map();
      positionedTree.nextId = treeInstance.nextId;
      positionedTree.rootId = treeInstance.rootId;

      // Copy all people with updated positions (immutable)
      treeInstance.people.forEach((person, id) => {
        const position = layout.positions.get(id);
        positionedTree.people.set(id, {
          ...person,
          x: position ? position.x : person.x,
          y: position ? position.y : person.y,
        });
      });

      // Update layout state
      setHierarchicalLayout({
        positions: layout.positions,
        connections: layout.connections,
      });

      // Return the positioned tree for functional state updates
      return positionedTree;
    } else {
      // Use dagre layout (old method)

      if (memberCount > 50) {
        setTreeLoading(true);

        setTimeout(() => {
          const layout = autoArrange(treeInstance);

          if (layout) {
            setDagreGraph(layout.g);
            setDagreLayoutOffsetX(layout.dagreLayoutOffsetX);
            setDagreLayoutOffsetY(layout.dagreLayoutOffsetY);
          }

          // CRITICAL FIX: Return a new tree instance instead of mutating
          const dagreTree = new FamilyTree();
          dagreTree.people = new Map(treeInstance.people);
          dagreTree.nextId = treeInstance.nextId;
          dagreTree.rootId = treeInstance.rootId;

          // Apply dagre positions immutably
          if (layout && layout.g) {
            layout.g.nodes().forEach((nodeId) => {
              const node = layout.g.node(nodeId);
              const person = dagreTree.people.get(Number(nodeId));
              if (person && node) {
                dagreTree.people.set(Number(nodeId), {
                  ...person,
                  x: node.x,
                  y: node.y,
                });
              }
            });
          }

          setTree(dagreTree);
          setTreeLoading(false);
        }, 100);
        return null; // Async update, no tree to return
      } else {
        const layout = autoArrange(treeInstance);

        if (layout) {
          setDagreGraph(layout.g);
          setDagreLayoutOffsetX(layout.dagreLayoutOffsetX);
          setDagreLayoutOffsetY(layout.dagreLayoutOffsetY);
        }

        // CRITICAL FIX: Create new tree with dagre positions
        const dagreTree = new FamilyTree();
        dagreTree.people = new Map(treeInstance.people);
        dagreTree.nextId = treeInstance.nextId;
        dagreTree.rootId = treeInstance.rootId;

        // Apply dagre positions immutably
        if (layout && layout.g) {
          layout.g.nodes().forEach((nodeId) => {
            const node = layout.g.node(nodeId);
            const person = dagreTree.people.get(Number(nodeId));
            if (person && node) {
              dagreTree.people.set(Number(nodeId), {
                ...person,
                x: node.x,
                y: node.y,
              });
            }
          });
        }

        return dagreTree;
      }
    }
  }, [useHierarchical]);

  const hydrateTreeFromPeople = useCallback(
    (people, preferredRootId = null) => {
      if (!Array.isArray(people) || people.length === 0) {
        setTree(null);
        setStats({ total: 0, male: 0, female: 0, generations: 0 });
        setSelectedPersonId(null);
        return null;
      }

      const newTree = new FamilyTree();
      newTree.people = new Map();

      people.forEach((person) => {
        const normalizedId = Number(person?.id);
        if (!Number.isFinite(normalizedId)) return;

        newTree.people.set(normalizedId, {
          ...person,
          id: normalizedId,
          isExternalLinked: normalizeExternalLinked(person?.isExternalLinked),
          memberId: person?.memberId !== undefined ? person.memberId : null,
          userId:
            person?.userId !== undefined
              ? person.userId
              : person?.memberId !== undefined
                ? person.memberId
                : null,
          name:
            typeof person?.name === "string"
              ? person.name.trim()
              : person?.name,
          parents: new Set((person?.parents || []).map((id) => Number(id))),
          children: new Set((person?.children || []).map((id) => Number(id))),
          spouses: new Set((person?.spouses || []).map((id) => Number(id))),
          siblings: new Set((person?.siblings || []).map((id) => Number(id))),
        });
      });

      const personIds = Array.from(newTree.people.keys());
      newTree.nextId = personIds.length ? Math.max(...personIds) + 1 : 1;

      const preferredId = Number(preferredRootId);
      const currentRootId = Number(tree?.rootId);
      if (Number.isFinite(preferredId) && newTree.people.has(preferredId)) {
        newTree.rootId = preferredId;
      } else if (Number.isFinite(currentRootId) && newTree.people.has(currentRootId)) {
        newTree.rootId = currentRootId;
      } else {
        newTree.rootId = personIds[0] || null;
      }

      updateStats(newTree);
      setSelectedPersonId((prev) => {
        const currentSelected = Number(prev);
        if (Number.isFinite(currentSelected) && newTree.people.has(currentSelected)) {
          return currentSelected;
        }
        return newTree.rootId || null;
      });
      setTree((prev) => {
        const arranged = arrangeTree(newTree);
        return arranged || newTree;
      });
      return newTree;
    },
    [arrangeTree, tree?.rootId],
  );

  const refreshTreeFromServer = useCallback(
    async (preferredRootId = null) => {
      if (!familyCodeToUse) return null;
      const data = await fetchFamilyTreeAggregate(familyCodeToUse);
      const people = Array.isArray(data?.nodes)
        ? data.nodes
        : Array.isArray(data?.people)
          ? data.people
          : [];
      hydrateTreeFromPeople(people, preferredRootId);
      setHasUnsavedChanges(false);
      return data;
    },
    [familyCodeToUse, hydrateTreeFromPeople],
  );

  const getMissingParentTypes = useCallback((person) => {
    if (!tree || !person) {
      return [];
    }

    const parentIds = Array.from(person?.parents || []).map((id) => Number(id));
    if (!parentIds.length) {
      return ["father", "mother"];
    }

    const presentRoles = new Set();
    parentIds.forEach((parentId) => {
      const parent = tree.people.get(parentId);
      const gender = String(parent?.gender || "").trim().toLowerCase();
      if (gender === "male" || gender === "m" || gender === "man") {
        presentRoles.add("father");
      } else if (gender === "female" || gender === "f" || gender === "woman") {
        presentRoles.add("mother");
      }
    });

    const missing = [];
    if (!presentRoles.has("father")) missing.push("father");
    if (!presentRoles.has("mother")) missing.push("mother");

    if (!missing.length && parentIds.length < 2) {
      return ["father", "mother"];
    }

    return parentIds.length >= 2 ? [] : missing;
  }, [tree]);

  const canPermanentlyDeletePlaceholder = useCallback((person) => {
    if (!tree || !person) {
      return false;
    }
    const childCount = Array.from(person?.children || []).filter((id) => Number.isFinite(Number(id))).length;
    if (childCount > 0) {
      return false;
    }
    return tree.people.size > 1;
  }, [tree]);

  const getPlaceholderProtectionMessage = useCallback((person) => {
    if (!tree || !person) {
      return "This empty slot must stay in the tree for now.";
    }

    const childCount = Array.from(person?.children || []).filter((id) => Number.isFinite(Number(id))).length;
    if (tree.people.size <= 1) {
      return "This empty slot is the only remaining card in the tree, so it cannot be cleared.";
    }
    if (childCount > 0) {
      return "This empty slot still protects children or descendants. Replace it with a real member instead of clearing it.";
    }
    return "This empty slot can be cleared safely.";
  }, [tree]);

  const closeStructuralDummyDialog = useCallback(() => {
    setStructuralDummyDialog(createStructuralDummyDialogState());
  }, []);

  const openStructuralDummyDialog = useCallback((mode, person) => {
    if (!person) return;
    setStructuralDummyDialog({
      ...createStructuralDummyDialogState(),
      isOpen: true,
      mode,
      person,
      loadingCandidates: mode === "replace",
    });
  }, []);

  const showStructuralDummyProtectionInfo = useCallback((person) => {
    openStructuralDummyDialog("info", person);
  }, [openStructuralDummyDialog]);

  const structuralDummyDialogDetails = useMemo(() => {
    const person = structuralDummyDialog?.person;
    const childIds = Array.from(person?.children || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    const childNames = childIds
      .map((id) => tree?.people?.get?.(id)?.name || `#${id}`)
      .filter(Boolean)
      .slice(0, 4);

    return {
      person,
      childCount: childIds.length,
      childNames,
      hasMoreChildren: childIds.length > childNames.length,
      canDelete: person ? canPermanentlyDeletePlaceholder(person) : false,
      protectionMessage: person ? getPlaceholderProtectionMessage(person) : "",
    };
  }, [
    canPermanentlyDeletePlaceholder,
    getPlaceholderProtectionMessage,
    structuralDummyDialog?.person,
    tree,
  ]);

  const loadStructuralDummyCandidates = useCallback(async (person) => {
    if (!person?.id || !familyCodeToUse) {
      return;
    }

    setStructuralDummyDialog((prev) => {
      if (
        !prev?.isOpen ||
        prev?.mode !== "replace" ||
        Number(prev?.person?.id) !== Number(person.id)
      ) {
        return prev;
      }

      return {
        ...prev,
        loadingCandidates: true,
        error: "",
      };
    });

    try {
      const response = await getMembersNotInTree(familyCodeToUse);
      const rawCandidates = Array.isArray(response?.data) ? response.data : [];
      const seenUserIds = new Set();
      const candidates = rawCandidates.reduce((acc, candidate) => {
        const candidateUserId = Number(
          candidate?.user?.id || candidate?.userId || candidate?.memberId,
        );
        if (
          !candidateUserId ||
          candidateUserId === Number(person?.userId) ||
          seenUserIds.has(candidateUserId)
        ) {
          return acc;
        }

        seenUserIds.add(candidateUserId);
        const candidateProfile = candidate?.user?.userProfile || {};
        const candidateName =
          String(candidate?.user?.fullName || candidate?.name || "").trim() ||
          [candidateProfile?.firstName, candidateProfile?.lastName]
            .filter(Boolean)
            .join(" ")
            .trim() ||
          `Member #${candidateUserId}`;

        acc.push({
          userId: candidateUserId,
          name: candidateName,
          familyRole: candidate?.familyRole || "Member",
          contact:
            candidateProfile?.contactNumber ||
            candidate?.user?.mobile ||
            candidate?.mobile ||
            "",
        });
        return acc;
      }, []);

      setStructuralDummyDialog((prev) => {
        if (
          !prev?.isOpen ||
          prev?.mode !== "replace" ||
          Number(prev?.person?.id) !== Number(person.id)
        ) {
          return prev;
        }

        return {
          ...prev,
          candidates,
          loadingCandidates: false,
          selectedReplacementUserId:
            prev?.selectedReplacementUserId ||
            String(candidates?.[0]?.userId || ""),
          error: candidates.length
            ? ""
            : "No approved members outside the tree are available right now.",
        };
      });
    } catch (error) {
      setStructuralDummyDialog((prev) => {
        if (
          !prev?.isOpen ||
          prev?.mode !== "replace" ||
          Number(prev?.person?.id) !== Number(person.id)
        ) {
          return prev;
        }

        return {
          ...prev,
          candidates: [],
          loadingCandidates: false,
          error:
            error?.message ||
            "Unable to load approved members for this removed slot right now.",
        };
      });
    }
  }, [familyCodeToUse]);

  useEffect(() => {
    if (
      !structuralDummyDialog?.isOpen ||
      structuralDummyDialog?.mode !== "replace" ||
      !structuralDummyDialog?.person?.id
    ) {
      return;
    }

    loadStructuralDummyCandidates(structuralDummyDialog.person);
  }, [
    loadStructuralDummyCandidates,
    structuralDummyDialog?.isOpen,
    structuralDummyDialog?.mode,
    structuralDummyDialog?.person,
  ]);

  const submitStructuralDummyReplacement = useCallback(async () => {
    const person = structuralDummyDialog?.person;
    const replacementUserId = Number(
      structuralDummyDialog?.selectedReplacementUserId || 0,
    );

    if (!person?.id || !familyCodeToUse) {
      return;
    }

    if (!replacementUserId) {
      setStructuralDummyDialog((prev) => ({
        ...prev,
        error: "Select a member to replace this removed slot.",
      }));
      return;
    }

    setStructuralDummyDialog((prev) => ({
      ...prev,
      submitting: true,
      error: "",
    }));

    try {
      const result = await replaceStructuralDummyApi(
        person.id,
        familyCodeToUse,
        replacementUserId,
      );
      await refreshTreeFromServer(
        Number(person.id) === Number(tree?.rootId) ? person.id : tree?.rootId,
      );
      closeStructuralDummyDialog();
      await Swal.fire({
        icon: "success",
        title: "Removed Member Replaced",
        text:
          result?.message ||
          "The removed-member slot was filled successfully.",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      setStructuralDummyDialog((prev) => ({
        ...prev,
        submitting: false,
        error:
          error?.message ||
          "Unable to replace this removed-member slot right now.",
      }));
    }
  }, [
    closeStructuralDummyDialog,
    familyCodeToUse,
    refreshTreeFromServer,
    structuralDummyDialog?.person,
    structuralDummyDialog?.selectedReplacementUserId,
    tree?.rootId,
  ]);

  const submitStructuralDummyDelete = useCallback(async () => {
    const person = structuralDummyDialog?.person;

    if (!person?.id || !familyCodeToUse) {
      return;
    }

    if (!canPermanentlyDeletePlaceholder(person)) {
      setStructuralDummyDialog((prev) => ({
        ...prev,
        error: getPlaceholderProtectionMessage(person),
      }));
      return;
    }

    setStructuralDummyDialog((prev) => ({
      ...prev,
      submitting: true,
      error: "",
    }));

    try {
      const response = await permanentlyDeleteStructuralDummyApi(
        person.id,
        familyCodeToUse,
      );
      await refreshTreeFromServer(
        Number(person.id) === Number(tree?.rootId) ? null : tree?.rootId,
      );
      closeStructuralDummyDialog();
      await Swal.fire({
        icon: "success",
        title: "Slot Deleted",
        text:
          response?.message ||
          "The empty slot was cleared safely from the tree.",
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      setStructuralDummyDialog((prev) => ({
        ...prev,
        submitting: false,
        error:
          error?.message ||
          "Unable to delete this removed-member slot right now.",
      }));
    }
  }, [
    canPermanentlyDeletePlaceholder,
    closeStructuralDummyDialog,
    familyCodeToUse,
    getPlaceholderProtectionMessage,
    refreshTreeFromServer,
    structuralDummyDialog?.person,
    tree?.rootId,
  ]);

  const validateTreeBeforeSave = useCallback(() => {
    if (!tree) {
      return "No tree data available to save.";
    }

    const people = Array.from(tree.people.values());
    if (!people.length) {
      return "Add at least one member before saving the tree.";
    }

    const peopleById = new Map();
    const adjacency = new Map();
    const parentSets = new Map();

    const ensureAdjacency = (id) => {
      if (!adjacency.has(id)) {
        adjacency.set(id, new Set());
      }
      return adjacency.get(id);
    };

    const normalizeIds = (collection) => {
      const source = Array.isArray(collection)
        ? collection
        : collection instanceof Set
          ? Array.from(collection)
          : [];
      const seen = new Set();
      return source
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value) && value > 0 && !seen.has(value) && seen.add(value));
    };

    const addUndirectedEdge = (a, b) => {
      if (!Number.isFinite(a) || !Number.isFinite(b) || a === b) return;
      ensureAdjacency(a).add(b);
      ensureAdjacency(b).add(a);
    };

    const addParent = (childId, parentId) => {
      if (!parentSets.has(childId)) {
        parentSets.set(childId, new Set());
      }
      parentSets.get(childId).add(parentId);
    };

    for (const person of people) {
      const personId = Number(person?.id);
      const personName = String(person?.name || "").trim() || `Member #${personId || "?"}`;
      if (!Number.isFinite(personId) || personId <= 0) {
        return "One of the tree cards has an invalid id. Refresh the tree and try again.";
      }
      if (peopleById.has(personId)) {
        return "The tree contains duplicate cards. Refresh the tree and try saving again.";
      }
      peopleById.set(personId, person);
      ensureAdjacency(personId);

      const validateRefs = (refs, relationLabel, onValidRef) => {
        for (const refId of refs) {
          if (refId === personId) {
            return `${personName} cannot be connected to the same card.`;
          }
          if (!peopleById.has(refId) && !people.some((candidate) => Number(candidate?.id) === refId)) {
            return `${personName} has a ${relationLabel} link to a missing card. Refresh the tree and try again.`;
          }
          addUndirectedEdge(personId, refId);
          onValidRef?.(refId);
        }
        return null;
      };

      const parents = normalizeIds(person?.parents);
      const children = normalizeIds(person?.children);
      const spouses = normalizeIds(person?.spouses);
      const siblings = normalizeIds(person?.siblings);

      const relationError =
        validateRefs(parents, "parent", (refId) => addParent(personId, refId)) ||
        validateRefs(children, "child", (refId) => addParent(refId, personId)) ||
        validateRefs(spouses, "spouse") ||
        validateRefs(siblings, "sibling");

      if (relationError) {
        return relationError;
      }
    }

    const relationPairs = [
      { sourceKey: "parents", targetKey: "children", sourceLabel: "parent", targetLabel: "child" },
      { sourceKey: "children", targetKey: "parents", sourceLabel: "child", targetLabel: "parent" },
      { sourceKey: "spouses", targetKey: "spouses", sourceLabel: "spouse", targetLabel: "spouse" },
      { sourceKey: "siblings", targetKey: "siblings", sourceLabel: "sibling", targetLabel: "sibling" },
    ];

    for (const person of people) {
      const personId = Number(person?.id);
      const personName = String(person?.name || "").trim() || `Member #${personId || "?"}`;

      for (const pair of relationPairs) {
        const relatedIds = normalizeIds(person?.[pair.sourceKey]);
        for (const relatedId of relatedIds) {
          const relatedPerson = peopleById.get(relatedId);
          if (!relatedPerson) {
            continue;
          }
          const relatedName = String(relatedPerson?.name || "").trim() || `Member #${relatedId}`;
          const reciprocalIds = normalizeIds(relatedPerson?.[pair.targetKey]);
          if (!reciprocalIds.includes(personId)) {
            return `${personName} lists ${relatedName} as a ${pair.sourceLabel}, but ${relatedName} does not list ${personName} as a ${pair.targetLabel}. Refresh the tree and try again.`;
          }
        }
      }
    }

    for (const [childId, parentIds] of parentSets.entries()) {
      if (parentIds.size > 2) {
        const child = peopleById.get(childId);
        const childName = String(child?.name || "").trim() || `Member #${childId}`;
        return `${childName} has more than two parents. Keep only the valid father and/or mother cards before saving.`;
      }
    }

    if (people.length > 1) {
      const startId = Number(people[0]?.id);
      const queue = [startId];
      const visited = new Set();

      while (queue.length > 0) {
        const current = queue.shift();
        if (visited.has(current)) continue;
        visited.add(current);
        (adjacency.get(current) || new Set()).forEach((nextId) => {
          if (!visited.has(nextId)) {
            queue.push(nextId);
          }
        });
      }

      if (visited.size !== people.length) {
        const disconnected = people.find((person) => !visited.has(Number(person?.id)));
        const disconnectedName = String(disconnected?.name || "").trim() || `Member #${disconnected?.id || "?"}`;
        return `The tree has disconnected cards. ${disconnectedName} is not connected to the main family. Connect every card before saving.`;
      }
    }

    return null;
  }, [tree]);

  const handlePersonClick = (personId) => {
    if (!tree) return;

    const person = tree.people.get(personId);
    if (!person) return;

    let relationshipCodeToRoot = "";

    try {
      const calculator = new RelationshipCalculator(tree);
      const rel = calculator.calculateRelationship(tree.rootId, personId);
      relationshipCodeToRoot = rel?.relationshipCode
        ? String(rel.relationshipCode)
        : "";
    } catch (_) {}

    const isSpouseCard =
      typeof relationshipCodeToRoot === "string" &&
      (relationshipCodeToRoot.endsWith("H") ||
        relationshipCodeToRoot.endsWith("W"));

    const isMaternalAncestorCard =
      typeof relationshipCodeToRoot === "string" && /^M+$/.test(relationshipCodeToRoot);

    const isRestrictedCard = isSpouseCard || isMaternalAncestorCard;
    const isExternalLinkedCard =
      Boolean(person.isExternalLinked) ||
      Boolean(person.canonicalFamilyCode && person.canonicalNodeUid);
    const isStructuralDummyCard =
      Boolean(person?.isStructuralDummy) ||
      person?.nodeType === "structural_dummy";

    const canEditSelectedPersonDetails = !(
      person?.isAppUser &&
      person?.memberId &&
      userInfo?.userId &&
      Number(person.memberId) !== Number(userInfo.userId)
    );
    const currentTreeFamilyCode = String(familyCodeToUse || "").trim().toUpperCase();
    const personSourceFamilyCode = String(
      person?.sourceFamilyCode || person?.primaryFamilyCode || person?.familyCode || "",
    )
      .trim()
      .toUpperCase();
    const isCurrentFamilyAdminCard =
      Number(person?.role || 0) >= 2 &&
      Boolean(currentTreeFamilyCode) &&
      personSourceFamilyCode === currentTreeFamilyCode;

    setSelectedPersonId(personId);

    const icons = {
      "Add Parents": `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zM20 10h-2V8h-2v2h-2v2h2v2h2v-2h2v-2z"/></svg>`,
      "Add Spouse": `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
      "Add Child": `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
      "Add Sibling": `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM12 10h-2v2H8v-2H6V8h2V6h2v2h2v2z"/></svg>`,
      "Link Tree": `<svg viewBox="0 0 24 24"><path d="M3.9 12a5 5 0 015-5h3v2h-3a3 3 0 000 6h3v2h-3a5 5 0 01-5-5zm7.1 1h2v-2h-2v2zm4-6h3a5 5 0 010 10h-3v-2h3a3 3 0 000-6h-3V7z"/></svg>`,
      Edit: `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
      Delete: `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`,
      "Replace Removed Member": `<svg viewBox="0 0 24 24"><path d="M17.65 6.35A7.95 7.95 0 0012 4V1L7 6l5 5V7a5 5 0 11-4.9 6h-2.02A7 7 0 1017.65 6.35z"/></svg>`,
      "Delete Slot": `<svg viewBox="0 0 24 24"><path d="M9 3h6l1 1h4v2H4V4h4l1-1zm1 6h2v8h-2V9zm4 0h2v8h-2V9zM6 9h2v8H6V9z"/></svg>`,
      "Why Slot Is Locked": `<svg viewBox="0 0 24 24"><path d="M11 17h2v2h-2zm0-10h2v8h-2zm1-5C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z"/></svg>`,
    };

    const items = [];

    if (isStructuralDummyCard) {
      if (canEdit) {
        const slotCanBeDeleted = canPermanentlyDeletePlaceholder(person);
        items.push({
          label: "Replace Removed Member",
          action: () => replaceStructuralDummyCard(person),
          icon: icons["Replace Removed Member"],
        });
        items.push({
          label: "Delete Slot",
          action: () => permanentlyDeleteStructuralDummyCard(person),
          icon: icons["Delete Slot"],
        });
        if (!slotCanBeDeleted) {
          items.push({
            label: "Why Slot Is Locked",
            action: () => showStructuralDummyProtectionInfo(person),
            icon: icons["Why Slot Is Locked"],
          });
        }
      }
    } else if (isRestrictedCard) {
      items.push({
        label: "Add Spouse",
        action: () => {},
        icon: icons["Add Spouse"],
        disabled: true,
      });

      items.push({
        label: "Add Child",
        action: () =>
          setModal({ isOpen: true, action: { type: "children", person } }),
        icon: icons["Add Child"],
      });

      if (canEdit && !person?.isAppUser) {
        items.push({
          label: "Edit",
          action: () =>
            setModal({ isOpen: true, action: { type: "edit", person } }),
          icon: icons["Edit"],
        });
      }
    } else {
      if (!isExternalLinkedCard) {
        const missingParentTypes = getMissingParentTypes(person);
        if (missingParentTypes.length > 0) {
          items.push({
            label: "Add Parents",
            action: () =>
              setModal({
                isOpen: true,
                action: { type: "parents", person, missingParentTypes },
              }),
            icon: icons["Add Parents"],
          });
        }

        items.push({
          label: "Add Spouse",
          action: () =>
            setModal({ isOpen: true, action: { type: "spouse", person } }),
          icon: icons["Add Spouse"],
        });

        items.push({
          label: "Add Child",
          action: () =>
            setModal({ isOpen: true, action: { type: "children", person } }),
          icon: icons["Add Child"],
        });

        if (person.parents.size > 0) {
          items.push({
            label: "Add Sibling",
            action: () =>
              setModal({ isOpen: true, action: { type: "siblings", person } }),
            icon: icons["Add Sibling"],
          });
        }

        if (canEditSelectedPersonDetails) {
          items.push({
            label: "Edit",
            action: () =>
              setModal({ isOpen: true, action: { type: "edit", person } }),
            icon: icons["Edit"],
          });
        }
      }
    }

    if (
      canEdit &&
      !isStructuralDummyCard &&
      !isExternalLinkedCard &&
      !isSpouseCard &&
      String(person?.nodeUid || "").trim()
    ) {
      items.push({
        label: "Link Tree",
        action: () => setLinkTreeModal({ isOpen: true, person }),
        icon: icons["Link Tree"],
      });
    }

    if (canEdit && !isStructuralDummyCard && !isCurrentFamilyAdminCard) {
      items.push({
        label: "Remove Member",
        action: () => deletePerson(personId),
        icon: icons["Delete"],
      });
    }

    if (!items.length) {
      setRadialMenu({
        isActive: false,
        position: { x: 0, y: 0 },
        items: [],
        activePersonId: null,
      });
      return;
    }

    const personElement = document.querySelector(`[data-person-id="${personId}"]`);

    if (personElement) {
      const actionButton = personElement.querySelector(".radial-menu-button");
      const rect = actionButton
        ? actionButton.getBoundingClientRect()
        : personElement.getBoundingClientRect();

      setRadialMenu({
        isActive: true,
        position: {
          x: rect.left + rect.width / 2 + window.scrollX,
          y: rect.top + rect.height / 2 + window.scrollY,
        },
        items,
        activePersonId: personId,
      });
    }
  };

  const handleRadialMenuItemClick = async (item) => {
    await Promise.resolve(item?.action?.());
  };

  const handleAddPersons = (persons) => {
    if (!tree) return;

    if (!persons || persons.length === 0) {
      return;
    }

    const newTree = new FamilyTree();

    newTree.people = new Map(tree.people);

    newTree.nextId = tree.nextId;

    newTree.rootId = tree.rootId;

    // Map to hold the correct personId for each personData (existing or new)

    const personIdMap = new Map();

    let duplicateFound = false;

    const { type, person: basePerson } = modal.action;

    // Special handling for edit: only update, never create

    if (type === "edit" && basePerson) {
      const existingPerson = newTree.people.get(basePerson.id);

      if (existingPerson && persons.length > 0) {
        const updatedPerson = {
          ...existingPerson,

          name: persons[0].name,

          gender: persons[0].gender,

          age: persons[0].age,

          img:
            persons[0].img !== undefined ? persons[0].img : existingPerson.img,

          imgPreview:
            persons[0].imgPreview !== undefined
              ? persons[0].imgPreview
              : existingPerson.imgPreview,

          lifeStatus: persons[0].lifeStatus || "living",

          memberId: persons[0].memberId || persons[0].userId || null,
        };

        newTree.people.set(existingPerson.id, updatedPerson);
      }

      setTree((prev) => {
        const arranged = arrangeTree(newTree);
        return arranged || newTree;
      });

      updateStats(newTree);

      setHasUnsavedChanges(true); // Mark as changed

      return;
    }

    persons.forEach((personData) => {
      // Try to find an existing person by memberId or userId

      let existing = null;

      if (personData.memberId || personData.userId) {
        for (let p of newTree.people.values()) {
          if (
            (personData.memberId && p.memberId === personData.memberId) ||
            (personData.userId && p.memberId === personData.userId)
          ) {
            existing = p;

            break;
          }
        }
      }

      if (existing) {
        // Use existing person's id

        personIdMap.set(personData, existing.id);
      } else {
        // Create new person

        const person = newTree.addPerson({
          ...personData,

          memberId: personData.memberId || personData.userId || null,
        });

        // PATCH: preserve imgPreview for preview in tree

        if (person && personData.imgPreview) {
          person.imgPreview = personData.imgPreview;
        }

        if (!person) {
          // Only set duplicate if it's an existing member (has memberId)

          if (personData.memberId || personData.userId) {
            duplicateFound = true;
          }
        } else {
          personIdMap.set(personData, person.id);
        }
      }
    });

    if (duplicateFound) {
      Swal.fire({
        icon: "info",

        title: "Duplicate Member",

        text: "This member already exists in the tree.",
      });

      return;
    }

    // Add relationships based on action type

    // If basePerson is undefined (new tree), just add the persons without relationships

    if (!basePerson) {
      setTree((prev) => {
        const arranged = arrangeTree(newTree);
        return arranged || newTree;
      });

      updateStats(newTree);

      return;
    }

    // Make sure basePerson exists in the new tree

    const basePersonInNewTree = newTree.people.get(basePerson.id);

    if (!basePersonInNewTree) {
      console.error("Base person not found in tree");

      setTree((prev) => {
        const arranged = arrangeTree(newTree);
        return arranged || newTree;
      });

      updateStats(newTree);

      return;
    }

    if (type === "parents") {
      const existingParentIds = Array.from(basePersonInNewTree.parents || []).map((id) => Number(id));
      const incomingParentIds = persons
        .map((personData) => personIdMap.get(personData))
        .filter((id) => Number.isFinite(Number(id)))
        .map((id) => Number(id));
      const combinedParentIds = Array.from(
        new Set([...existingParentIds, ...incomingParentIds]),
      );

      if (combinedParentIds.length > 2) {
        Swal.fire({
          icon: "warning",
          title: "Parents already complete",
          text: "This child already has two parents in the tree. Remove the member or clear the empty slot first if you need to change them.",
        });
        return;
      }

      incomingParentIds.forEach((parentId) => {
        if (!existingParentIds.includes(parentId)) {
          newTree.addRelation(parentId, basePersonInNewTree.id, "parent-child");
        }
      });

      if (combinedParentIds.length === 2) {
        const [parent1, parent2] = combinedParentIds;
        if (parent1 && parent2) {
          newTree.addRelation(parent1, parent2, "spouse");
        }
      }
    } else if (type === "children") {
      persons.forEach((personData) => {
        const childId = personIdMap.get(personData);

        if (childId) {
          newTree.addRelation(basePersonInNewTree.id, childId, "parent-child");

          // Add to all spouses of the base person

          basePersonInNewTree.spouses.forEach((spouseId) => {
            const spouse = newTree.people.get(spouseId);

            if (spouse) {
              newTree.addRelation(spouseId, childId, "parent-child");
            }
          });
        }
      });
    } else if (type === "spouse") {
      const spouseId = personIdMap.get(persons[0]);

      if (spouseId) {
        newTree.addRelation(basePersonInNewTree.id, spouseId, "spouse");
      }
    } else if (type === "siblings") {
      persons.forEach((personData) => {
        const siblingId = personIdMap.get(personData);

        if (siblingId) {
          basePersonInNewTree.parents.forEach((parentId) => {
            const parent = newTree.people.get(parentId);

            if (parent) {
              newTree.addRelation(parentId, siblingId, "parent-child");
            }
          });
        }
      });
    }

    setTree((prev) => {
      const arranged = arrangeTree(newTree);
      return arranged || newTree;
    });
    updateStats(newTree);
    setHasUnsavedChanges(true); // Mark as changed
  };

  const replaceStructuralDummyCard = useCallback((person) => {
    openStructuralDummyDialog("replace", person);
  }, [openStructuralDummyDialog]);

  const permanentlyDeleteStructuralDummyCard = useCallback((person) => {
    openStructuralDummyDialog("delete", person);
  }, [openStructuralDummyDialog]);

  const escapeWarningHtml = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");

  const buildRemoveMemberWarning = ({
    currentPerson,
    useFamilyRemovalFlow,
    isExternalLinkedCard,
    isSelfRemoval,
  }) => {
    const displayName = escapeWarningHtml(currentPerson?.name || "This member");
    const normalizedNodeType = String(currentPerson?.nodeType || "member").toLowerCase();
    const isAssociatedCard = normalizedNodeType === "associated";
    const memberTypeLabel = currentPerson?.isAppUser ? "App User" : "Non-App User";
    const bullets = [];
    let title = "Remove This Member?";

    if (useFamilyRemovalFlow) {
      title = isSelfRemoval ? "Leave Family?" : "Remove From Family?";
      bullets.push(`${displayName} will be removed from this family.`);
      bullets.push(
        "The account itself will not be deleted, but this family will stop treating the member as active.",
      );
      bullets.push(
        "A Removed member slot will stay in the tree so parents, children, and spouse lines do not collapse.",
      );
      bullets.push(
        currentPerson?.isAppUser
          ? "Family-only content from that member becomes hidden from this family after removal."
          : "This non-app member card will stop acting like an active family member after removal.",
      );

      if (isSelfRemoval) {
        bullets.push("You will be taken out of the family and the page will refresh after success.");
      }
    } else if (isExternalLinkedCard) {
      title = "Remove Linked Member?";
      bullets.push(`${displayName} will be removed only from this family tree.`);
      bullets.push("The real member will remain safe in their own family.");
      bullets.push(
        "If this was the last bridge between the two families, the linked-family connection can also be cleaned up.",
      );
      bullets.push(
        "A placeholder slot may stay behind if the tree needs it to keep the structure stable.",
      );
    } else if (isAssociatedCard) {
      title = "Remove Associated Member?";
      bullets.push(`${displayName} will be removed only from this family tree.`);
      bullets.push("The real member will remain safe in the source family.");
      bullets.push(
        "If no other association bridge remains, the associated-family connection can also be cleaned up.",
      );
      bullets.push(
        "A placeholder slot may stay behind if the tree needs it to keep the structure stable.",
      );
    } else {
      bullets.push(`${displayName} will be removed from this tree.`);
      bullets.push(
        "A Removed member slot may stay behind so the family structure does not break.",
      );
    }

    return {
      title,
      html: `
        <div style="text-align:left;line-height:1.5;">
          <div style="margin-bottom:10px;font-weight:700;color:#1f2937;">
            ${memberTypeLabel} · ${escapeWarningHtml(normalizedNodeType.replace(/_/g, " "))}
          </div>
          <div style="margin-bottom:10px;color:#4b5563;">
            Please confirm after reviewing what will happen:
          </div>
          <ul style="margin:0 0 0 18px;padding:0;color:#111827;">
            ${bullets.map((item) => `<li style="margin-bottom:8px;">${item}</li>`).join("")}
          </ul>
        </div>
      `,
    };
  };

  const deletePerson = async (personId) => {
    if (!tree || !familyCodeToUse) return;

    const currentPerson = tree.people.get(personId);
    if (!currentPerson) return;

    if (
      currentPerson?.isStructuralDummy ||
      currentPerson?.nodeType === "structural_dummy"
    ) {
      await Swal.fire({
        icon: "info",
        title: "Removed Member Slot",
        text: canPermanentlyDeletePlaceholder(currentPerson)
          ? "This card is an empty slot that keeps the tree structure stable. You can replace it with a real member, or delete the slot if it is no longer needed."
          : `${getPlaceholderProtectionMessage(currentPerson)} Use Replace Removed Member to put a real member here, or open Delete Slot to see why it is protected.`,
      });
      return;
    }

    const normalizedTreeFamilyCode = String(familyCodeToUse || "")
      .trim()
      .toUpperCase();
    const sourceFamilyCode = String(
      currentPerson?.sourceFamilyCode ||
        currentPerson?.primaryFamilyCode ||
        currentPerson?.familyCode ||
        "",
    )
      .trim()
      .toUpperCase();
    const isExternalLinkedCard =
      Boolean(currentPerson?.isExternalLinked) ||
      Boolean(currentPerson?.canonicalFamilyCode && currentPerson?.canonicalNodeUid) ||
      currentPerson?.nodeType === "linked";
    const targetMemberId = Number(currentPerson?.memberId || currentPerson?.userId || 0);
    const isSelfRemoval =
      targetMemberId > 0 &&
      Number(targetMemberId) === Number(userInfo?.userId || 0);
    const useFamilyRemovalFlow =
      !isExternalLinkedCard &&
      Boolean(sourceFamilyCode) &&
      sourceFamilyCode === normalizedTreeFamilyCode &&
      targetMemberId > 0;

    const confirmWarning = buildRemoveMemberWarning({
      currentPerson,
      useFamilyRemovalFlow,
      isExternalLinkedCard,
      isSelfRemoval,
    });

    const result = await Swal.fire({
      icon: "warning",
      title: confirmWarning.title,
      html: confirmWarning.html,
      showCancelButton: true,
      confirmButtonText: isSelfRemoval ? "Leave family" : "Remove member",
      cancelButtonText: "Cancel",
      focusCancel: true,
    });

    if (!result.isConfirmed) {
      return;
    }

    try {
      let response;
      if (useFamilyRemovalFlow) {
        response = isSelfRemoval
          ? await selfRemoveFromFamily(familyCodeToUse)
          : await deleteFamilyMember(targetMemberId, familyCodeToUse);
      } else {
        response = await deletePersonApi(personId, familyCodeToUse, currentPerson?.nodeUid);
      }

      if (useFamilyRemovalFlow && isSelfRemoval) {
        window.location.reload();
        return;
      }

      await refreshTreeFromServer(
        Number(personId) === Number(tree?.rootId) ? personId : tree?.rootId,
      );
      setSelectedPersonId(personId);

      await Swal.fire({
        icon: "success",
        title: "Member Removed",
        text:
          response?.message ||
          (useFamilyRemovalFlow
            ? "The member was removed from the family and converted into a removed-member slot in the tree."
            : "The member card was removed and an empty slot was left in the tree to protect the structure."),
        timer: 2200,
        showConfirmButton: false,
      });
    } catch (error) {
      console.error("Error deleting person:", error);
      await Swal.fire({
        icon: "error",
        title: "Remove Failed",
        text: error?.message || "Unable to remove this member right now.",
      });
    }
  };
  const downloadTreeData = async () => {
    // Download the tree as an image (PNG)

    const treeCanvas = document.querySelector(".tree-canvas");

    if (!treeCanvas) return;

    // Step 1: Replace all images in the tree with a local image to avoid CORS issues

    const allImgs = treeCanvas.querySelectorAll("img");

    const originalSrcs = [];

    const localImg = "/public/assets/user.png"; // Adjust path if needed

    allImgs.forEach((img) => {
      originalSrcs.push(img.src);

      img.src = localImg;
    });

    // Save original styles

    const originalOverflow = treeCanvas.style.overflow;

    const originalWidth = treeCanvas.style.width;

    const originalHeight = treeCanvas.style.height;

    // Expand to fit content

    treeCanvas.style.overflow = "visible";

    treeCanvas.style.width = "auto";

    treeCanvas.style.height = "auto";

    try {
      // Use html2canvas with higher scale for better quality

      const canvas = await html2canvas(treeCanvas, {
        backgroundColor: "#fff", // Set a white background

        scale: 2, // Higher scale for better resolution

        useCORS: true,

        allowTaint: true,

        scrollX: 0,

        scrollY: 0,

        windowWidth: document.body.scrollWidth,

        windowHeight: document.body.scrollHeight,
      });

      // Restore original images

      allImgs.forEach((img, i) => {
        img.src = originalSrcs[i];
      });

      // Restore original styles

      treeCanvas.style.overflow = originalOverflow;

      treeCanvas.style.width = originalWidth;

      treeCanvas.style.height = originalHeight;

      const image = canvas.toDataURL("image/png");

      const a = document.createElement("a");

      a.href = image;

      a.download = "family-tree.png";

      document.body.appendChild(a);

      a.click();

      document.body.removeChild(a);
    } catch (err) {
      // Restore original images and styles on error

      allImgs.forEach((img, i) => {
        img.src = originalSrcs[i];
      });

      treeCanvas.style.overflow = originalOverflow;

      treeCanvas.style.width = originalWidth;

      treeCanvas.style.height = originalHeight;

      Swal.fire({
        icon: "error",

        title: "Export Failed",

        text: "Could not generate image. Try again or check for CORS issues.",
      });
    }
  };

  const useAdvancedAlgorithms = () => {
    Swal.fire({
      icon: "info",

      title: "Advanced Algorithms",

      text: "Advanced algorithms feature is available in the React version!",
    });
  };

  const centerTreeInView = () => {
    if (!containerRef.current) return;

    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;

    const memberCount = tree.people.size;

    const personSize = memberCount > 50 ? 80 : 100; // Dynamic person size

    tree.people.forEach((person) => {
      minX = Math.min(minX, person.x - personSize / 2);

      minY = Math.min(minY, person.y - personSize / 2);

      maxX = Math.max(maxX, person.x + personSize / 2);

      maxY = Math.max(maxY, person.y + personSize / 2);
    });

    const treeWidth = maxX - minX;

    const treeHeight = maxY - minY;

    // For large trees, center both horizontally and vertically

    if (memberCount > 50) {
      containerRef.current.scrollLeft =
        minX + treeWidth / 2 - containerRef.current.clientWidth / 2;

      containerRef.current.scrollTop =
        minY + treeHeight / 2 - containerRef.current.clientHeight / 2;
    } else {
      // For smaller trees, center horizontally, align to top vertically

      containerRef.current.scrollLeft =
        minX + treeWidth / 2 - containerRef.current.clientWidth / 2;

      containerRef.current.scrollTop = 0;
    }
  };

  useEffect(() => {
    if (tree && tree.people.size > 0) {
      centerTreeInView();
    }
  }, [tree]);

  // On mobile, always scroll to top and center horizontally after tree loads

  useEffect(() => {
    if (
      tree &&
      tree.people.size > 0 &&
      window.innerWidth <= 600 &&
      containerRef.current
    ) {
      const memberCount = tree.people.size;

      const personSize = memberCount > 50 ? 80 : 100; // Dynamic person size

      containerRef.current.scrollTop = 0;

      // Center horizontally

      let minX = Infinity,
        maxX = -Infinity;

      tree.people.forEach((person) => {
        minX = Math.min(minX, person.x - personSize / 2);

        maxX = Math.max(maxX, person.x + personSize / 2);
      });

      const treeWidth = maxX - minX;

      containerRef.current.scrollLeft =
        minX + treeWidth / 2 - containerRef.current.clientWidth / 2;
    }
  }, [tree]);

  // Recalculate radial menu position on scroll/resize if open

  useEffect(() => {
    if (!radialMenu.isActive || !radialMenu.activePersonId) return;

    function updateMenuPosition() {
      const personElement = document.querySelector(
        `[data-person-id="${radialMenu.activePersonId}"]`,
      );

      if (personElement) {
        const actionButton = personElement.querySelector(".radial-menu-button");
        const rect = actionButton
          ? actionButton.getBoundingClientRect()
          : personElement.getBoundingClientRect();

        setRadialMenu((prev) => ({
          ...prev,

          position: {
            x: rect.left + rect.width / 2 + window.scrollX,

            y: rect.top + rect.height / 2 + window.scrollY,
          },
        }));
      }
    }

    window.addEventListener("scroll", updateMenuPosition, true);

    window.addEventListener("resize", updateMenuPosition);

    return () => {
      window.removeEventListener("scroll", updateMenuPosition, true);

      window.removeEventListener("resize", updateMenuPosition);
    };
  }, [radialMenu.isActive, radialMenu.activePersonId]);

  // PERFORMANCE: Use useCallback to prevent function re-creation

  const saveTreeToApi = useCallback(async () => {
    console.log(" Save button clicked! Current status:", saveStatus);

    // CRITICAL FIX: Prevent multiple simultaneous saves

    if (saveStatus === "loading") {
      console.warn(" Save already in progress, ignoring click");

      return;
    }

    if (!tree) {
      console.warn(" No tree data to save");

      return;
    }

    // NEW: Check if there are unsaved changes

    if (!hasUnsavedChanges) {
      console.log(" No changes detected, skipping save");

      Swal.fire({
        icon: "info",

        title: "No Changes",

        text: "No changes have been made to save.",

        timer: 2000,

        showConfirmButton: false,
      });

      return;
    }

    const localValidationMessage = validateTreeBeforeSave();
    if (localValidationMessage) {
      await Swal.fire({
        icon: "warning",
        title: "Fix Tree Before Saving",
        text: localValidationMessage,
      });
      return;
    }

    console.log(` Starting save for ${tree.people.size} members`);

    setSaveStatus("loading");

    setSaveMessage("");

    try {
      // Calculate and attach relationshipCode for each person

      const calculator = new RelationshipCalculator(tree);

      const rootId = tree.rootId;

      for (const person of tree.people.values()) {
        if (person.id !== rootId) {
          const rel = calculator.calculateRelationship(rootId, person.id);

          person.relationshipCode = rel.relationshipCode;
        } else {
          person.relationshipCode = "SELF";
        }
      }

      const formData = new FormData();
      let index = 0;

      for (const person of tree.people.values()) {
        formData.append(`person_${index}_id`, person.id);
        formData.append(`person_${index}_name`, person.name);
        formData.append(`person_${index}_gender`, person.gender);
        formData.append(`person_${index}_age`, person.age);
        formData.append(`person_${index}_generation`, person.generation);
        formData.append(
          `person_${index}_lifeStatus`,
          person.lifeStatus || "living",
        );
        formData.append(`person_${index}_birthOrder`, person.birthOrder || 0);
        formData.append(`person_${index}_memberId`, person.memberId || "");

        formData.append(`person_${index}_nodeUid`, person.nodeUid || "");
        const isExternalLinked = normalizeExternalLinked(
          person.isExternalLinked,
        );
        formData.append(
          `person_${index}_isExternalLinked`,
          isExternalLinked ? "true" : "false",
        );
        formData.append(
          `person_${index}_canonicalFamilyCode`,
          isExternalLinked ? person.canonicalFamilyCode || "" : "",
        );
        formData.append(
          `person_${index}_canonicalNodeUid`,
          isExternalLinked ? person.canonicalNodeUid || "" : "",
        );

        const isStructuralDummy =
          Boolean(person?.isStructuralDummy) ||
          person?.nodeType === "structural_dummy";
        formData.append(
          `person_${index}_isStructuralDummy`,
          isStructuralDummy ? "true" : "false",
        );
        formData.append(
          `person_${index}_nodeType`,
          isStructuralDummy
            ? "structural_dummy"
            : person?.nodeType || (isExternalLinked ? "linked" : "birth"),
        );

        formData.append(
          `person_${index}_parents`,
          person.parents ? Array.from(person.parents).join(",") : "",
        );
        formData.append(
          `person_${index}_children`,
          person.children ? Array.from(person.children).join(",") : "",
        );
        formData.append(
          `person_${index}_spouses`,
          person.spouses ? Array.from(person.spouses).join(",") : "",
        );
        formData.append(
          `person_${index}_siblings`,
          person.siblings ? Array.from(person.siblings).join(",") : "",
        );
        formData.append(
          `person_${index}_relationshipCode`,
          person.relationshipCode || "",
        );

        if (person.img) {
          if (person.img instanceof File) {
            formData.append(`person_${index}_img`, person.img);
          } else if (typeof person.img === "string") {
            const imgValue = person.img.includes("/")
              ? person.img.split("/").pop()
              : person.img;
            formData.append(`person_${index}_img`, imgValue);
          }
        }

        index++;
      }

      formData.append("person_count", index);

      if (familyCodeToUse) {
        formData.append("familyCode", familyCodeToUse);
      }

      const apiStartTime = Date.now();
      console.log(` Sending ${index} members to API...`);

      const response = await authFetch(
        `${import.meta.env.VITE_API_BASE_URL}/family/tree/create`,
        {
          method: "POST",
          body: formData,
          headers: {
            // Authorization header will be set in authFetch
          },
        },
      );

      const apiTime = Date.now() - apiStartTime;
      console.log(
        ` API response received in ${apiTime}ms (${(apiTime / 1000).toFixed(2)}s)`,
      );

      if (!response) return;
      if (!response.ok) {
        let saveErrorMessage = "Failed to save family tree.";
        try {
          const errorBody = await response.json();
          if (errorBody?.message) {
            saveErrorMessage = Array.isArray(errorBody.message)
              ? errorBody.message.join(", ")
              : String(errorBody.message);
          }
        } catch (_) { }
        throw new Error(saveErrorMessage);
      }

      // RELOAD TREE DATA FROM SERVER AFTER SUCCESSFUL SAVE

      // PRESERVE EXISTING POSITIONS - No recalculation needed!
      try {
        const treeResponse = await authFetch(
          `${import.meta.env.VITE_API_BASE_URL}/family/tree/${familyCodeToUse
          }`,

          {
            headers: { accept: "*/*" },
          },
        );

        if (treeResponse.ok) {
          const treeData = await treeResponse.json();

          if (treeData && treeData.people && treeData.people.length > 0) {
            // PRESERVE POSITIONS: Store current positions before rebuilding

            const currentPositions = new Map();

            tree.people.forEach((person, id) => {
              currentPositions.set(id, { x: person.x, y: person.y });
            });

            // Rebuild tree from server data

            const newTree = new FamilyTree();

            newTree.people = new Map();

            treeData.people.forEach((person) => {
              // RESTORE POSITIONS: Use saved positions if available

              const savedPosition = currentPositions.get(person.id);

              newTree.people.set(person.id, {
                ...person,

                isExternalLinked: normalizeExternalLinked(
                  person.isExternalLinked,
                ),

                memberId:
                  person.memberId !== undefined ? person.memberId : null,

                parents: new Set(
                  (person.parents || []).map((id) => Number(id)),
                ),

                children: new Set(
                  (person.children || []).map((id) => Number(id)),
                ),

                spouses: new Set(
                  (person.spouses || []).map((id) => Number(id)),
                ),

                siblings: new Set(
                  (person.siblings || []).map((id) => Number(id)),
                ),

                // KEEP EXACT SAME POSITIONS - No recalculation!

                x: savedPosition ? savedPosition.x : person.x,

                y: savedPosition ? savedPosition.y : person.y,
              });
            });

            newTree.nextId =
              Math.max(...treeData.people.map((p) => parseInt(p.id))) + 1;

            // Set rootId to the person whose memberId matches the logged-in user's userId

            let rootPersonId = null;

            const userIdStr = String(userInfo.userId);

            for (const [personId, personObj] of newTree.people.entries()) {
              if (
                personObj.memberId &&
                String(personObj.memberId) === userIdStr
              ) {
                rootPersonId = personId;

                break;
              }
            }

            if (rootPersonId !== null) {
              newTree.rootId = rootPersonId;
            } else {
              newTree.rootId = treeData.people[0].id;
            }

            // FIX GENERATION INCONSISTENCIES: Ensure spouses have same generation

            newTree.people.forEach((person) => {
              if (person.spouses && person.spouses.size > 0) {
                person.spouses.forEach((spouseId) => {
                  const spouse = newTree.people.get(spouseId);

                  if (spouse && spouse.generation !== person.generation) {
                    console.log(
                      ` Fixing generation for spouse ${spouse.name}: ${spouse.generation} → ${person.generation}`,
                    );

                    spouse.generation = person.generation;
                  }
                });
              }
            });

            // CRITICAL: Only recalculate if new people were added

            const hasNewPeople = treeData.people.some(
              (p) => !currentPositions.has(p.id),
            );

            if (hasNewPeople) {
              // New people added - need to recalculate layout

              console.log(" New people detected - recalculating layout");

              setTree((prev) => {
                const arranged = arrangeTree(newTree);
                return arranged || newTree;
              });

              updateStats(newTree);
            } else {
              // Same people - keep exact positions!

              console.log(" No new people - preserving exact positions");

              // Update hierarchical layout with preserved positions

              const preservedLayout = {
                positions: new Map(),

                connections: hierarchicalLayout.connections,
              };

              newTree.people.forEach((person, id) => {
                preservedLayout.positions.set(id, {
                  x: person.x,

                  y: person.y,

                  person: person,
                });
              });

              setHierarchicalLayout(preservedLayout);

              setTree(newTree);

              updateStats(newTree);

              // NO arrangeTree() call - positions already perfect!
            }
          }
        }
      } catch (reloadErr) {
        console.warn("Failed to reload tree after save:", reloadErr);

        // Continue with success status even if reload fails
      }

      setSaveStatus("success");

      setSaveMessage("Family tree saved successfully without breaking the structure.");

      setHasUnsavedChanges(false); // Reset changes flag

      console.log(" Save completed successfully!");
    } catch (err) {
      console.error(" Save failed:", err);

      setSaveStatus("error");

      setSaveMessage(err?.message || "Failed to save family tree.");
    }
  }, [tree, saveStatus, userInfo, hasUnsavedChanges]); // Dependencies for useCallback

  useEffect(() => {
    if (saveStatus === "success") {
      Swal.fire({
        icon: "success",

        title: "Tree Saved",

        text: saveMessage || "Family tree saved successfully.",
      });

      setSaveStatus("idle");
    } else if (saveStatus === "error") {
      Swal.fire({
        icon: "error",

        title: "Tree Needs Attention",

        text: saveMessage || "Failed to save family tree.",
      });

      setSaveStatus("idle");
    }
  }, [saveStatus, saveMessage]);

  // One-shot autosave for first-time root bootstrap when no tree exists in DB.
  useEffect(() => {
    if (!bootstrapRootAutoSavePendingRef.current) return;
    if (!tree || !userInfo?.userId) return;
    if (saveStatus !== "idle" || !hasUnsavedChanges) return;

    if (tree.people.size !== 1) {
      bootstrapRootAutoSavePendingRef.current = false;
      return;
    }

    const onlyPerson = Array.from(tree.people.values())[0];
    if (!onlyPerson || Number(onlyPerson.memberId) !== Number(userInfo.userId)) {
      bootstrapRootAutoSavePendingRef.current = false;
      return;
    }

    const timer = setTimeout(() => {
      bootstrapRootAutoSavePendingRef.current = false;
      saveTreeToApi();
    }, 600);

    return () => clearTimeout(timer);
  }, [tree, userInfo?.userId, saveStatus, hasUnsavedChanges, saveTreeToApi]);

  return (
    <FamilyTreeProvider language={language}>
      {/* All components that use useFamilyTreeLabels must be children here */}

      <>
        {showFullScreenLoading ? (
          <div
            className="w-full min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm p-4"
            style={{
              paddingTop:
                "calc(3.5rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
            }}
          >
            <LoadingSpinner type="generic" />
          </div>
        ) : accessView ? (
          <div className="min-h-[calc(100vh-6rem)] bg-gray-50 flex items-center justify-center px-4 py-6">
            {accessView}
          </div>
        ) : showWaitForAdmin ? (
          <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-slate-950 px-4">
            <div className="text-center max-w-xl bg-white dark:bg-slate-900 rounded-xl shadow p-6 border border-gray-200 dark:border-slate-800">
              <div className="text-lg font-semibold text-gray-900 dark:text-slate-100 mb-2">
                Family tree is not created yet
              </div>

              <div className="text-gray-600 dark:text-slate-300">
                You have been added as a family member.
              </div>

              <div className="text-gray-600 dark:text-slate-300">
                Once the admin adds you in the correct position and saves the
                tree, you can view it here.
              </div>

              <div className="text-gray-600 dark:text-slate-300 mt-3">
                குடும்ப மரம் இன்னும் உருவாக்கப்படவில்லை.
              </div>

              <div className="text-gray-600 dark:text-slate-300">
                நிர்வாகி உங்களை சரியான இடத்தில் சேர்த்து சேமித்த பிறகு இங்கே
                காணலாம்.
              </div>

              <button
                type="button"
                className="mt-5 bg-blue-600 text-white px-4 py-2 rounded-lg"
                onClick={() => window.location.reload()}
              >
                Refresh
              </button>
            </div>
          </div>
        ) : !tree ? (
          <div
            className="w-full min-h-[calc(100vh-3.5rem)] flex items-center justify-center bg-white/90 dark:bg-slate-950/90 backdrop-blur-sm p-4"
            style={{
              paddingTop:
                "calc(3.5rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
            }}
          >
            <LoadingSpinner type="generic" />
          </div>
        ) : (
          <>
            {/* Main container for tree and controls */}

            <div className="relative flex flex-col h-full w-full bg-gray-100 dark:bg-slate-950 overflow-x-hidden">
              {/* Navigation buttons when viewing another family's tree */}

              {/* Mobile Top Header - Edit Mode */}

              {canEdit && (
                <>
                  <div
                    className="sm:hidden fixed left-0 right-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm z-50 px-3 py-2"
                    style={{
                      // Position this header just below the global app header
                      // while also respecting any safe-area inset at the top
                      // (for devices with notches).
                      top: "calc(3.5rem + var(--safe-area-inset-top, env(safe-area-inset-top, 0px)))",
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      {/* <button className="w-10 h-10 bg-green-600 text-white rounded-lg flex items-center justify-center active:scale-95 transition-transform">







                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">







                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />







                                        </svg>







                                    </button> */}

                      <div className="flex-1">
                        <SearchBar
                          tree={tree}
                          onSearchResults={handleSearchResults}
                          onFocusPerson={handleFocusPerson}
                          onClearSearch={handleClearSearch}
                          language={language}
                        />
                      </div>

                      <div className="flex-shrink-0">
                        <LanguageSwitcher />
                      </div>
                    </div>
                  </div>

                  <div className="sm:hidden fixed bottom-[88px] left-3 z-50 flex flex-col gap-2">
                    <button
                      onClick={zoomIn}
                      className="w-11 h-11 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <FaPlus className="text-sm" />
                    </button>

                    <div className="w-11 h-11 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold">
                      {Math.round(zoom * 100)}%
                    </div>

                    <button
                      onClick={zoomOut}
                      className="w-11 h-11 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-transform"
                    >
                      <FaMinus className="text-sm" />
                    </button>
                  </div>

                  <div className="sm:hidden fixed bottom-[88px] right-3 z-50 flex flex-col gap-2">

                    <button
                      onClick={saveTreeToApi}
                      disabled={saveStatus === "loading"}
                      className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
                      title="Save"
                    >
                      {saveStatus === "loading" ? (
                        <svg
                          className="animate-spin h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>

                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8v8z"
                          ></path>
                        </svg>
                      ) : (
                        <FaSave className="text-lg" />
                      )}
                    </button>
                  </div>
                </>
              )}

              {/* Desktop Header */}

              {canEdit && (
                <div className="hidden sm:flex w-full bg-white dark:bg-slate-900 border-b-2 border-gray-100 dark:border-slate-800 shadow-sm z-40">
                  <div className="w-full max-w-none 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
                    <div className="flex items-center justify-between gap-3 lg:gap-5">
                      {/* LEFT: back + stats (compact, responsive labels) */}

                      <div className="flex items-center gap-3 lg:gap-5 flex-shrink-0">
                        {code && code !== userInfo.familyCode && (
                          <div className="flex items-center gap-2 pr-3 border-r border-gray-300">
                            <button
                              className="inline-flex items-center justify-center w-8 h-8 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 hover:border-gray-400 active:scale-95 transition-all duration-200 shadow-sm"
                              onClick={() => navigate(-1)}
                              title="Back"
                            >
                              <FaArrowLeft className="text-xs" />
                            </button>

                            <button
                              className="inline-flex items-center justify-center w-8 h-8 bg-blue-600 border border-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all duration-200 shadow-sm"
                              onClick={() => navigate("/family-tree")}
                              title="My Birth Family Tree"
                            >
                              <FaHome className="text-xs" />
                            </button>
                          </div>
                        )}

                        <div className="flex items-center gap-3 text-xs md:text-sm">
                          {/* Total */}

                          <span className="text-gray-700 dark:text-slate-200">
                            <span className="font-medium">
                              <span className="hidden md:inline">Total</span>
                              <span className="inline md:hidden">T</span>:
                            </span>{" "}
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {stats.total}
                            </span>
                          </span>

                          {/* Male */}

                          <span className="text-gray-700 dark:text-slate-200">
                            <span className="font-medium">
                              <span className="hidden md:inline">Male</span>
                              <span className="inline md:hidden">M</span>:
                            </span>{" "}
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {stats.male}
                            </span>
                          </span>

                          {/* Female */}

                          <span className="text-gray-700 dark:text-slate-200">
                            <span className="font-medium">
                              <span className="hidden md:inline">Female</span>
                              <span className="inline md:hidden">F</span>:
                            </span>{" "}
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {stats.female}
                            </span>
                          </span>

                          {/* Generations */}

                          <span className="text-gray-700 dark:text-slate-200">
                            <span className="font-medium">
                              <span className="hidden md:inline">
                                Generations
                              </span>
                              <span className="inline md:hidden">G</span>:
                            </span>{" "}
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {stats.generations}
                            </span>
                          </span>
                        </div>
                      </div>

                      {/* RIGHT: language + search + actions */}

                      <div className="flex items-center gap-2 md:gap-3 flex-1 justify-end min-w-0">
                        <div className="flex items-center flex-shrink-0">
                          <LanguageSwitcher />
                        </div>

                        <div className="flex-1 min-w-[140px] max-w-sm">
                          <SearchBar
                            tree={tree}
                            onSearchResults={handleSearchResults}
                            onFocusPerson={handleFocusPerson}
                            onClearSearch={handleClearSearch}
                            language={language}
                          />
                        </div>

                        <div className="flex items-center gap-1.5 flex-shrink-0">
                          {/* Save */}

                          <button
                            className="flex items-center gap-1 px-2.5 py-2 bg-blue-600 border-2 border-blue-600 text-white rounded-lg hover:bg-blue-700 text-xs font-semibold active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                            onClick={saveTreeToApi}
                            disabled={saveStatus === "loading"}
                          >
                            {saveStatus === "loading" && (
                              <svg
                                className="animate-spin h-3.5 w-3.5 text-white"
                                xmlns="http://www.w3.org/2000/svg"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>

                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8v8z"
                                ></path>
                              </svg>
                            )}

                            <FaSave className="text-xs" />

                            <span className="whitespace-nowrap">Save</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile Top Header - View Mode */}

              {!canEdit && (
                <>
                  {/* Compact Top Bar */}

                  <div className="sm:hidden fixed top-0 left-0 right-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 shadow-sm z-50 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      {/* Left: Menu Icon (placeholder - you can add menu functionality) */}

                      <button className="w-10 h-10 bg-green-600 text-white rounded-lg flex items-center justify-center active:scale-95 transition-transform">
                        <svg
                          className="w-5 h-5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M4 6h16M4 12h16M4 18h16"
                          />
                        </svg>
                      </button>

                      {/* Center: Search */}

                      <div className="flex-1">
                        <SearchBar
                          tree={tree}
                          onSearchResults={handleSearchResults}
                          onFocusPerson={handleFocusPerson}
                          onClearSearch={handleClearSearch}
                          language={language}
                        />
                      </div>

                      {/* Right: Language Switcher */}

                      <div className="flex-shrink-0">
                        <LanguageSwitcher />
                      </div>
                    </div>
                  </div>

                  {/* Bottom Left Corner: Zoom Controls */}

                  <div className="sm:hidden fixed bottom-[88px] left-3 z-50 flex flex-col gap-2">
                    <button
                      onClick={zoomOut}
                      className="w-11 h-11 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-transform"
                      title="Zoom Out"
                    >
                      <FaMinus className="text-sm" />
                    </button>

                    <div className="w-11 h-11 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold">
                      {Math.round(zoom * 100)}%
                    </div>

                    <button
                      onClick={zoomIn}
                      className="w-11 h-11 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center active:scale-95 transition-transform"
                      title="Zoom In"
                    >
                      <FaPlus className="text-sm" />
                    </button>

                    <button
                      onClick={resetZoom}
                      className="px-3 h-11 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 flex items-center justify-center text-[10px] font-bold active:scale-95 transition-transform"
                      title="Reset"
                    >
                      Reset
                    </button>
                  </div>
                </>
              )}

              {/* Desktop Header - Non Edit */}

              {!canEdit && (
                <div className="hidden sm:flex w-full bg-white dark:bg-slate-900 border-b-2 border-gray-100 dark:border-slate-800 shadow-sm z-40">
                  <div className="w-full max-w-none 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                    <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 lg:gap-6">
                      <div className="flex items-center justify-center lg:justify-start gap-3 xl:gap-6 flex-wrap">
                        {(isLinkedMode ||
                          (code && code !== userInfo.familyCode)) && (
                            <div className="flex items-center gap-2 pr-3 border-r border-gray-300">
                              <button
                                className="inline-flex items-center justify-center w-9 h-9 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 hover:border-gray-400 active:scale-95 transition-all duration-200 shadow-sm dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                                onClick={() => navigate(-1)}
                                title="Back"
                              >
                                <FaArrowLeft className="text-sm" />
                              </button>

                              <button
                                className="inline-flex items-center justify-center w-9 h-9 bg-blue-600 border border-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all duration-200 shadow-sm"
                                onClick={() => navigate("/family-tree")}
                                title="My Birth Family Tree"
                              >
                                <FaHome className="text-sm" />
                              </button>
                            </div>
                          )}

                        <div className="flex items-center gap-6 text-sm">
                          <span className="text-gray-700 dark:text-slate-200">
                            <span className="font-medium">Total:</span>{" "}
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {stats.total}
                            </span>
                          </span>

                          <span className="text-gray-700 dark:text-slate-200">
                            <span className="font-medium">Male:</span>{" "}
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {stats.male}
                            </span>
                          </span>

                          <span className="text-gray-700 dark:text-slate-200">
                            <span className="font-medium">Female:</span>{" "}
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {stats.female}
                            </span>
                          </span>

                          <span className="text-gray-700 dark:text-slate-200">
                            <span className="font-medium">Generations:</span>{" "}
                            <span className="font-bold text-gray-900 dark:text-slate-100">
                              {stats.generations}
                            </span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-center lg:justify-end gap-3 lg:gap-4 flex-shrink-0">
                        <LanguageSwitcher />

                        <SearchBar
                          tree={tree}
                          onSearchResults={handleSearchResults}
                          onFocusPerson={handleFocusPerson}
                          onClearSearch={handleClearSearch}
                          language={language}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {needsPlacementBanner && (
                <>
                  <div className="sm:hidden fixed top-14 left-0 right-0 z-40 bg-amber-50 border-b border-amber-200 px-3 py-2 dark:bg-amber-900/20 dark:border-amber-800">
                    <div className="text-xs font-semibold text-amber-900 dark:text-amber-100">
                      You have joined this family, but the admin hasn’t placed
                      you in the tree yet.
                    </div>

                    <div className="text-xs text-amber-900 dark:text-amber-100 mt-1">
                      This family tree is currently shown from the family
                      admin’s (birth family) perspective.
                    </div>
                  </div>

                  <div className="hidden sm:block w-full bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
                    <div className="w-full max-w-none 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-3">
                      <div className="text-sm font-semibold text-amber-900 dark:text-amber-100">
                        You have joined this family, but the admin hasn’t placed
                        you in the tree yet.
                      </div>

                      <div className="text-sm text-amber-900 dark:text-amber-100 mt-1">
                        This family tree is currently shown from the family
                        admin’s (birth family) perspective.
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="hidden sm:flex fixed bottom-5 right-5 z-50 bg-white dark:bg-slate-900 text-gray-700 dark:text-slate-200 rounded-full shadow-lg border border-gray-200 dark:border-slate-700 items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={zoomOut}
                  className="w-9 h-9 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  title="Zoom Out"
                >
                  <FaMinus className="text-sm" />
                </button>

                <div className="min-w-[52px] text-center text-xs font-bold">
                  {Math.round(zoom * 100)}%
                </div>

                <button
                  type="button"
                  onClick={zoomIn}
                  className="w-9 h-9 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center active:scale-95 transition-transform"
                  title="Zoom In"
                >
                  <FaPlus className="text-sm" />
                </button>

                <button
                  type="button"
                  onClick={resetZoom}
                  className="px-3 h-9 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-full flex items-center justify-center text-xs font-semibold active:scale-95 transition-transform"
                  title="Reset"
                >
                  Reset
                </button>
              </div>

              {/* Tree visualization area */}

              <div
                ref={containerRef}
                className={`custom-scrollbar flex-1 w-full h-full min-h-0 min-w-0 overflow-auto touch-pan-x touch-pan-y ${needsPlacementBanner ? "pt-28" : "pt-14"
                  } sm:pt-0`}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                <div
                  ref={treeCanvasRef}
                  className="tree-canvas   relative w-max h-max mx-auto flex flex-col items-start justify-start sm:items-center sm:justify-center"
                  style={{
                    minWidth:
                      tree && tree.people.size > 50
                        ? window.innerWidth <= 640
                          ? "600px"
                          : "1200px"
                        : window.innerWidth <= 640
                          ? "400px"
                          : "900px",

                    minHeight:
                      tree && tree.people.size > 50
                        ? window.innerWidth <= 640
                          ? "500px"
                          : "800px"
                        : window.innerWidth <= 640
                          ? "400px"
                          : "600px",

                    transform: `scale(${zoom})`,

                    transformOrigin:
                      window.innerWidth <= 640 ? "top left" : "center center",

                    padding: window.innerWidth <= 640 ? "10px" : "20px",

                    marginTop: window.innerWidth <= 640 ? "16px" : "56px",
                  }}
                >
                  {/* Tree SVG connections */}

                  {useHierarchical ? (
                    <HierarchicalConnections
                      positions={hierarchicalLayout.positions}
                      connections={hierarchicalLayout.connections}
                      memberCount={tree?.people?.size || 0}
                    />
                  ) : (
                    dagreGraph && (
                      <TreeConnections
                        dagreGraph={dagreGraph}
                        dagreLayoutOffsetX={dagreLayoutOffsetX}
                        dagreLayoutOffsetY={dagreLayoutOffsetY}
                      />
                    )
                  )}

                  {/* Render person cards with optimization for large trees */}

                  {tree &&
                    Array.from(tree.people.values())

                      .sort((a, b) => {
                        // Sort by generation first, then by x position for better rendering order

                        if (a.generation !== b.generation) {
                          return (a.generation || 0) - (b.generation || 0);
                        }

                        return a.x - b.x;
                      })

                      .map((person) => (
                        <Person
                          key={person.id}
                          person={person}
                          isRoot={person.id === tree.rootId}
                          onClick={canEdit ? handlePersonClick : undefined}
                          rootId={tree.rootId}
                          tree={tree}
                          language={language}
                          isSelected={selectedPersonId === person.id}
                          isHighlighted={highlightedPersonId === person.id}
                          isSearchResult={searchResults.some(
                            (result) => result.id === person.id,
                          )}
                          currentUserId={userInfo?.userId} // <-- Pass userId
                          currentFamilyId={
                            userInfo?.familyId || userInfo?.familyCode
                          } // <-- Pass familyId or familyCode
                          viewOnly={!canEdit}
                        />
                      ))}
                </div>
              </div>

              {/* Mobile Navigation Buttons (when viewing other family tree) */}

              {(isLinkedMode || (code && code !== userInfo.familyCode)) && (
                <div className="sm:hidden fixed top-16 left-4 z-40 flex gap-2">
                  <button
                    className="w-10 h-10 bg-white border-2 border-gray-300 text-gray-700 rounded-full hover:bg-gray-50 active:scale-95 transition-all duration-200 shadow-lg flex items-center justify-center"
                    onClick={() => navigate(-1)}
                    title="Back"
                  >
                    <FaArrowLeft className="text-sm" />
                  </button>

                  <button
                    className="w-10 h-10 bg-blue-600 border-2 border-blue-600 text-white rounded-full hover:bg-blue-700 active:scale-95 transition-all duration-200 shadow-lg flex items-center justify-center"
                    onClick={() => navigate("/family-tree")}
                    title="My Family Tree"
                  >
                    <FaHome className="text-sm" />
                  </button>
                </div>
              )}
            </div>

            <RadialMenu
              isActive={canEdit && radialMenu.isActive}
              position={radialMenu.position}
              items={canEdit ? radialMenu.items : []}
              onItemClick={handleRadialMenuItemClick}
              onClose={() =>
                setRadialMenu({
                  isActive: false,

                  position: { x: 0, y: 0 },

                  items: [],

                  activePersonId: null,
                })
              }
            />

            {structuralDummyDialog.isOpen && (
              <div className="fixed inset-0 z-[1200] flex items-end justify-center bg-slate-950/50 p-3 backdrop-blur-sm sm:items-center sm:p-6">
                <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.24)]">
                  <div className="flex items-start justify-between gap-4 bg-gradient-to-r from-sky-600 via-blue-600 to-indigo-600 px-5 py-4 text-white">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-100">
                        Removed Member Slot
                      </p>
                      <h3 className="mt-1 text-xl font-bold">
                        {structuralDummyDialog.mode === "replace"
                          ? "Replace removed member"
                          : structuralDummyDialog.mode === "delete"
                            ? "Delete empty slot"
                            : "Why this slot is locked"}
                      </h3>
                      <p className="mt-1 text-sm text-sky-50">
                        {structuralDummyDialogDetails.person?.name
                          ? `Slot: ${structuralDummyDialogDetails.person.name}`
                          : "Review this structural slot before making changes."}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={closeStructuralDummyDialog}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold text-white transition hover:bg-white/20"
                    >
                      Close
                    </button>
                  </div>

                  <div className="space-y-5 p-5 sm:p-6">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Slot
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {structuralDummyDialogDetails.person?.name || "Removed member"}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Linked Children
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-900">
                          {structuralDummyDialogDetails.childCount}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Slot Status
                        </p>
                        <p
                          className={`mt-1 text-base font-semibold ${
                            structuralDummyDialogDetails.canDelete
                              ? "text-emerald-700"
                              : "text-amber-700"
                          }`}
                        >
                          {structuralDummyDialogDetails.canDelete
                            ? "Can be deleted"
                            : "Protected"}
                        </p>
                      </div>
                    </div>

                    {(structuralDummyDialog.mode === "delete" ||
                      structuralDummyDialog.mode === "info") && (
                      <>
                        <div
                          className={`rounded-2xl border px-4 py-4 ${
                            structuralDummyDialogDetails.canDelete
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-amber-200 bg-amber-50"
                          }`}
                        >
                          <p className="text-sm font-semibold text-slate-900">
                            {structuralDummyDialog.mode === "info"
                              ? "This slot is protected for a reason"
                              : structuralDummyDialogDetails.canDelete
                                ? "This slot can be deleted safely"
                                : "This slot cannot be deleted yet"}
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            {structuralDummyDialogDetails.protectionMessage}
                          </p>
                        </div>

                        {structuralDummyDialogDetails.childNames.length > 0 && (
                          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                            <p className="text-sm font-semibold text-slate-900">
                              Children linked to this slot
                            </p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {structuralDummyDialogDetails.childNames.map((childName) => (
                                <span
                                  key={childName}
                                  className="inline-flex items-center rounded-full border border-sky-200 bg-white px-3 py-1 text-sm font-medium text-sky-700"
                                >
                                  {childName}
                                </span>
                              ))}
                              {structuralDummyDialogDetails.hasMoreChildren && (
                                <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-medium text-slate-600">
                                  +{structuralDummyDialogDetails.childCount - structuralDummyDialogDetails.childNames.length} more
                                </span>
                              )}
                            </div>
                          </div>
                        )}

                        {structuralDummyDialog.error && (
                          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                            {structuralDummyDialog.error}
                          </div>
                        )}

                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={closeStructuralDummyDialog}
                            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Close
                          </button>
                          {structuralDummyDialog.mode === "delete" && (
                            <button
                              type="button"
                              onClick={submitStructuralDummyDelete}
                              disabled={
                                structuralDummyDialog.submitting ||
                                !structuralDummyDialogDetails.canDelete
                              }
                              className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
                                structuralDummyDialog.submitting ||
                                !structuralDummyDialogDetails.canDelete
                                  ? "cursor-not-allowed bg-slate-300"
                                  : "bg-rose-600 hover:bg-rose-700"
                              }`}
                            >
                              {structuralDummyDialog.submitting
                                ? "Deleting..."
                                : structuralDummyDialogDetails.canDelete
                                  ? "Delete Slot"
                                  : "Delete Unavailable"}
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {structuralDummyDialog.mode === "replace" && (
                      <>
                        <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-4">
                          <p className="text-sm font-semibold text-slate-900">
                            Choose a replacement member
                          </p>
                          <p className="mt-2 text-sm leading-6 text-slate-700">
                            Only approved family members who are not already placed in this tree can fill this removed-member slot.
                          </p>
                        </div>

                        {structuralDummyDialog.loadingCandidates ? (
                          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                            <div className="h-5 w-5 animate-spin rounded-full border-2 border-sky-200 border-t-sky-600" />
                            Loading approved members...
                          </div>
                        ) : structuralDummyDialog.candidates.length > 0 ? (
                          <div className="max-h-[320px] space-y-3 overflow-y-auto pr-1">
                            {structuralDummyDialog.candidates.map((candidate) => {
                              const isSelected =
                                String(structuralDummyDialog.selectedReplacementUserId || "") ===
                                String(candidate.userId);
                              return (
                                <label
                                  key={candidate.userId}
                                  className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-4 transition ${
                                    isSelected
                                      ? "border-sky-300 bg-sky-50 shadow-sm"
                                      : "border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50"
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="replacementUserId"
                                    className="mt-1 h-4 w-4 accent-sky-600"
                                    checked={isSelected}
                                    onChange={() =>
                                      setStructuralDummyDialog((prev) => ({
                                        ...prev,
                                        selectedReplacementUserId: String(candidate.userId),
                                        error: "",
                                      }))
                                    }
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="text-base font-semibold text-slate-900">
                                        {candidate.name}
                                      </span>
                                      <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-500">
                                        #{candidate.userId}
                                      </span>
                                      <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                                        {candidate.familyRole}
                                      </span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-500">
                                      {candidate.contact || "No contact number available"}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-5 text-sm text-slate-600">
                            {structuralDummyDialog.error ||
                              "No approved members outside the tree are available right now."}
                          </div>
                        )}

                        {structuralDummyDialog.error &&
                          structuralDummyDialog.candidates.length > 0 && (
                            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                              {structuralDummyDialog.error}
                            </div>
                          )}

                        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                          <button
                            type="button"
                            onClick={closeStructuralDummyDialog}
                            className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              loadStructuralDummyCandidates(
                                structuralDummyDialogDetails.person,
                              )
                            }
                            disabled={structuralDummyDialog.loadingCandidates}
                            className={`rounded-2xl border px-5 py-3 text-sm font-semibold transition ${
                              structuralDummyDialog.loadingCandidates
                                ? "cursor-not-allowed border-slate-200 bg-slate-100 text-slate-400"
                                : "border-sky-200 bg-sky-50 text-sky-700 hover:bg-sky-100"
                            }`}
                          >
                            Refresh List
                          </button>
                          <button
                            type="button"
                            onClick={submitStructuralDummyReplacement}
                            disabled={
                              structuralDummyDialog.loadingCandidates ||
                              structuralDummyDialog.submitting ||
                              !structuralDummyDialog.selectedReplacementUserId
                            }
                            className={`rounded-2xl px-5 py-3 text-sm font-semibold text-white transition ${
                              structuralDummyDialog.loadingCandidates ||
                              structuralDummyDialog.submitting ||
                              !structuralDummyDialog.selectedReplacementUserId
                                ? "cursor-not-allowed bg-slate-300"
                                : "bg-sky-600 hover:bg-sky-700"
                            }`}
                          >
                            {structuralDummyDialog.submitting
                              ? "Replacing..."
                              : "Replace Member"}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <AddPersonModal
              isOpen={modal.isOpen}
              onClose={() => setModal({ isOpen: false, action: null })}
              action={modal.action}
              onAddPersons={handleAddPersons}
              familyCode={userInfo?.familyCode}
              token={getToken()}
              existingMemberIds={
                tree
                  ? Array.from(tree.people.values())
                    .map((p) => p.memberId)
                    .filter(Boolean)
                  : []
              }
            />

            <LinkTreeModal
              isOpen={canEdit && linkTreeModal.isOpen}
              onClose={() => setLinkTreeModal({ isOpen: false, person: null })}
              senderPerson={linkTreeModal.person}
              token={getToken()}
              primaryColor="#1976D2"
              currentFamilyCode={userInfo?.familyCode}
              existingMemberIds={
                tree
                  ? Array.from(tree.people.values())
                    .map((p) => p.memberId)
                    .filter(Boolean)
                  : []
              }
              existingCanonicalKeys={
                tree
                  ? Array.from(tree.people.values())
                    .filter(
                      (p) => p?.canonicalFamilyCode && p?.canonicalNodeUid,
                    )
                    .map(
                      (p) =>
                        `${String(p.canonicalFamilyCode).trim()}|${String(p.canonicalNodeUid).trim()}`,
                    )
                    .filter(Boolean)
                  : []
              }
              allowedRelationshipTypes={["sibling"]}
            />

            {/* Debug Panel */}

            {debugPanel && (
              <div className="debug-panel">
                <div className="debug-header">
                  <h3>Debug Panel - Traversal Analysis</h3>

                  <button
                    className="btn btn-sm"
                    onClick={() => setDebugPanel(false)}
                  >
                    ×
                  </button>
                </div>

                <div className="debug-content">
                  <div className="debug-tabs">
                    <button className="debug-tab active">Traversal Logs</button>

                    <button className="debug-tab">Path Analysis</button>

                    <button className="debug-tab">Family Structure</button>

                    <button className="debug-tab">Relationship Matrix</button>
                  </div>

                  <div className="debug-tab-content">
                    <div className="debug-tab-pane active">
                      <div className="debug-controls">
                        <button className="btn btn-sm">Clear Logs</button>

                        <button className="btn btn-sm">Export</button>

                        <button className="btn btn-sm">Clean Memory</button>
                      </div>

                      <div className="debug-logs">
                        <p>Debug logs will appear here...</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <CreateFamilyModal
          isOpen={isCreateFamilyModalOpen}
          onClose={() => setIsCreateFamilyModalOpen(false)}
          onFamilyCreated={handleFamilyCreated}
          token={getToken()}
        />

        <JoinFamilyModal
          isOpen={isJoinFamilyModalOpen}
          onClose={() => setIsJoinFamilyModalOpen(false)}
          onFamilyJoined={handleFamilyJoined}
          token={getToken()}
        />
      </>
    </FamilyTreeProvider>
  );
};

export default FamilyTreePage;










