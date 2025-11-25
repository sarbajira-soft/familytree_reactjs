import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useUser } from '../Contexts/UserContext';
import { FamilyTree } from '../utils/FamilyTree';
import { autoArrange } from '../utils/TreeLayout';
import { calculateHierarchicalLayout } from '../utils/HierarchicalTreeLayout';
import Person from '../Components/FamilyTree/Person';
import TreeConnections from '../Components/FamilyTree/TreeConnections';
import HierarchicalConnections from '../Components/FamilyTree/HierarchicalConnections';
import RadialMenu from '../Components/FamilyTree/RadialMenu';
import AddPersonModal from '../Components/FamilyTree/AddPersonModal';
import SearchBar from '../Components/FamilyTree/SearchBar';
import { useLanguage } from '../Contexts/LanguageContext';
import RelationshipCalculator from '../utils/relationshipCalculator';
import html2canvas from 'html2canvas';
import LanguageSwitcher from '../Components/LanguageSwitcher';
import Swal from 'sweetalert2';
import { FaPlus, FaSave, FaArrowLeft, FaHome, FaMinus } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { FamilyTreeProvider } from '../Contexts/FamilyTreeContext';
import { useMergeRequests } from '../hooks/useApi';
import { executeMerge as executeMergeApi } from '../utils/familyMergeApi';

// Utility for authenticated fetch with logout on 401 or error
const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('access_token');
    const headers = {
        ...options.headers,
        Authorization: token ? `Bearer ${token}` : undefined,
        // Do not set Content-Type for FormData
    };
    // Debug: log token and headers
    console.log('authFetch token:', token);
    console.log('authFetch headers:', headers);
    try {
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return null;
        }
        return response;
    } catch (err) {
        // Only logout on 401, not on network error
        Swal.fire({
            icon: 'error',
            title: 'Network Error',
            text: 'Network error or server error. Please try again.',
        });
        return null;
    }
};

const FamilyTreePage = () => {
    const [tree, setTree] = useState(null);
    const [stats, setStats] = useState({ total: 1, male: 1, female: 0, generations: 1 });
    const [dagreGraph, setDagreGraph] = useState(null);
    const [dagreLayoutOffsetX, setDagreLayoutOffsetX] = useState(0);
    const [dagreLayoutOffsetY, setDagreLayoutOffsetY] = useState(0);
    const [hierarchicalLayout, setHierarchicalLayout] = useState({ positions: new Map(), connections: [] });
    const [useHierarchical, setUseHierarchical] = useState(true); // Use hierarchical layout by default
    const [radialMenu, setRadialMenu] = useState({
        isActive: false,
        position: { x: 0, y: 0 },
        items: [],
        activePersonId: null
    });
    const [modal, setModal] = useState({
        isOpen: false,
        action: { type: '', person: null }
    });
    const [debugPanel, setDebugPanel] = useState(false);
    const containerRef = useRef(null);
    const treeCanvasRef = useRef(null);
    const [saveStatus, setSaveStatus] = useState('idle'); // idle | loading | success | error
    const [saveMessage, setSaveMessage] = useState('');
    const [selectedPersonId, setSelectedPersonId] = useState(null);
    const [treeLoading, setTreeLoading] = useState(false);
    const [zoom, setZoom] = useState(1);
    const [showMobileHeader, setShowMobileHeader] = useState(true);
    const [lastScrollY, setLastScrollY] = useState(0);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false); // 🚀 Track changes
    // Search state
    const [searchResults, setSearchResults] = useState([]);
    const [highlightedPersonId, setHighlightedPersonId] = useState(null);
    const [isSearchActive, setIsSearchActive] = useState(false);
    // Touch zoom/pinch state
    const [isPinching, setIsPinching] = useState(false);
    const pinchStateRef = useRef({ startDist: 0, startZoom: 1 });
    const lastTapRef = useRef(0);
    const { language } = useLanguage();
    const { userInfo, userLoading } = useUser();
    const navigate = useNavigate();
    const { code } = useParams(); // Get familyCode from URL if present

    // Allow editing only when viewing user's own birth family tree and role permits
    const isOwnTree = !code || (userInfo && code === userInfo.familyCode);
    const canEdit = isOwnTree && userInfo && (userInfo.role === 2 || userInfo.role === 3);

    // Determine current family code used for this view
    const familyCodeToUse = code || (userInfo && userInfo.familyCode);

    // Load accepted merge requests for this admin (primary family)
    const {
        data: mergeRequestsResponse,
        isLoading: mergeRequestsLoading,
    } = useMergeRequests('accepted', !!canEdit);

    const mergeRequests = Array.isArray(mergeRequestsResponse?.data)
        ? mergeRequestsResponse.data
        : [];

    // Find the latest accepted merge request for the current family as primary
    let pendingMerge = null;
    if (familyCodeToUse && mergeRequests.length > 0) {
        pendingMerge = mergeRequests
            .filter(
                (req) =>
                    req.primaryFamilyCode === familyCodeToUse &&
                    (req.primaryStatus === 'accepted' || req.status === 'accepted'),
            )
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0] || null;
    }

    const hasPendingMerge = !!pendingMerge;

    const handleExecuteMergeFromTree = useCallback(async () => {
        if (!pendingMerge || !pendingMerge.id) {
            await Swal.fire({
                icon: 'info',
                title: 'No Pending Merge',
                text: 'There is no accepted merge request to execute for this family.',
            });
            return;
        }

        const requestId = pendingMerge.id;
        const primaryCode = pendingMerge.primaryFamilyCode || familyCodeToUse || userInfo?.familyCode;

        const confirmResult = await Swal.fire({
            icon: 'warning',
            title: 'Execute Merge?',
            text: 'This will apply the final merged tree to the primary family and cannot be easily undone.',
            showCancelButton: true,
            confirmButtonText: 'Yes, execute',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#dc2626',
        });

        if (!confirmResult.isConfirmed) return;

        try {
            await executeMergeApi(requestId);
            await Swal.fire({
                icon: 'success',
                title: 'Merge Executed',
                text: 'Family merge executed successfully.',
            });

            if (primaryCode) {
                navigate(`/family-tree/${primaryCode}`);
            } else {
                navigate('/family-tree');
            }
        } catch (err) {
            await Swal.fire({
                icon: 'error',
                title: 'Execution Failed',
                text: err?.message || 'Failed to execute merge.',
            });
        }
    }, [pendingMerge, familyCodeToUse, userInfo?.familyCode, navigate]);

    // Zoom helper functions
    const zoomIn = () => setZoom(prev => Math.min(2, prev + 0.1));
    const zoomOut = () => setZoom(prev => Math.max(0.5, prev - 0.1));

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

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, [lastScrollY]);
    const resetZoom = () => setZoom(1);

    // Set initial zoom based on screen size
    useEffect(() => {
        const setInitialZoom = () => {
            if (window.innerWidth <= 640) {
                // Mobile: start with smaller zoom
                setZoom(0.7);
            } else if (window.innerWidth <= 1024) {
                // Tablet: slightly smaller
                setZoom(0.85);
            } else {
                // Desktop: normal zoom
                setZoom(1);
            }
        };

        setInitialZoom();
        window.addEventListener('resize', setInitialZoom);
        return () => window.removeEventListener('resize', setInitialZoom);
    }, []);

    // Check approval status and familyCode
    useEffect(() => {
        if (userLoading) return; // Wait for user data to load

        if (!userInfo) {
            // User not logged in, redirect to login
            navigate('/login');
            return;
        }

        // Check if user is approved and has familyCode
        if (userInfo.approveStatus !== 'approved' || !userInfo.familyCode) {
            Swal.fire({
                icon: 'warning',
                title: 'Access Restricted',
                text: userInfo.approveStatus !== 'approved'
                    ? 'Your family membership is pending approval. Please wait for admin approval.'
                    : 'You need to create or join a family first.',
                confirmButtonText: 'Go to My Family',
                showCancelButton: false,
            }).then(() => {
                navigate('/my-family');
            });
            return;
        }
    }, [userInfo, userLoading, navigate]);

    // Show loading state while checking approval or if user is not approved
    if (userLoading || !userInfo || userInfo.approveStatus !== 'approved' || !userInfo.familyCode) {
        return (
            <>
                <div className="flex items-center justify-center min-h-screen bg-gray-100">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Loading family tree...</p>
                    </div>
                </div>
            </>
        );
    }

    // Search handlers - memoized to prevent infinite re-renders
    const handleSearchResults = useCallback((results) => {
        setSearchResults(results);
        setIsSearchActive(results.length > 0);
    }, []);

    const handleFocusPerson = useCallback((personId, person) => {
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
                behavior: 'smooth'
            });
        }
    }, [tree, zoom]);

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
            const newZoom = clampZoom(+(pinchStateRef.current.startZoom * scale).toFixed(3));
            setZoom(newZoom);
        }
    };

    const handleTouchEnd = () => {
        if (isPinching) setIsPinching(false);
    };

    // 🚀 Warn user before leaving page with unsaved changes
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [hasUnsavedChanges]);

    // Initialize tree (now with API/sample data support)
    useEffect(() => {
        const initializeTree = async () => {
            // Use code from URL if present, else fallback to user's main familyCode
            const familyCodeToUse = code || (userInfo && userInfo.familyCode);
            console.log('🔍 Debug - code from URL:', code);
            console.log('🔍 Debug - userInfo.familyCode:', userInfo?.familyCode);
            console.log('🔍 Debug - familyCodeToUse:', familyCodeToUse);
            // Read optional focus user and source from query string (use local var; state would be async)
            let focusFromQuery = null;
            let focusNameFromQuery = null;
            let sourceFromQuery = null;
            try {
                const params = new URLSearchParams(window.location.search);
                const focus = params.get('focus');
                focusFromQuery = focus ? String(focus) : null;
                const fName = params.get('focusName');
                focusNameFromQuery = fName ? String(fName) : null;
                const source = params.get('source');
                sourceFromQuery = source ? String(source) : null;
                console.log('🔍 Debug - Query params:', { focus: focusFromQuery, focusName: focusNameFromQuery, source: sourceFromQuery });
            } catch { }

            if (!userInfo || !familyCodeToUse) {
                console.log('❌ Debug - Missing userInfo or familyCodeToUse');
                return;
            }

            setTreeLoading(true);
            let data = null;
            try {
                const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/family/tree/${familyCodeToUse}`;
                console.log('🌐 Debug - Making API call to:', apiUrl);

                const response = await authFetch(apiUrl, {
                    headers: { 'accept': '*/*' }
                });

                // authFetch can return null on 401 or network error
                if (!response) {
                    setTreeLoading(false);
                    return;
                }

                console.log('📡 Debug - Response status:', response.status);

                // If user is blocked from this family, backend returns 403
                if (response.status === 403) {
                    let message = 'You have been blocked from this family';
                    try {
                        const errorBody = await response.json();
                        if (errorBody?.message) message = errorBody.message;
                    } catch (e) {
                        // ignore JSON parse errors
                    }

                    await Swal.fire({
                        icon: 'error',
                        title: 'Access Restricted',
                        text: message,
                    });

                    setTreeLoading(false);
                    return;
                }

                if (response.ok) {
                    data = await response.json();
                    console.log('✅ Debug - API response data:', data);
                } else {
                    console.log('❌ Debug - API call failed with status:', response.status);
                }
            } catch (err) {
                console.log('💥 Debug - API call error:', err);
                data = null;
            }
            if (!data || !data.people || data.people.length === 0) {
                // No data, create new tree with logged-in user as root
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
                updateStats(newTree);
                arrangeTree(newTree);
            } else {
                // Data exists, build tree from data
                const newTree = new FamilyTree();
                newTree.people = new Map();
                data.people.forEach(person => {
                    newTree.people.set(person.id, {
                        ...person,
                        memberId: person.memberId !== undefined ? person.memberId : null,
                        // Preserve userId explicitly for robust matching
                        userId: person.userId !== undefined ? person.userId : (person.memberId !== undefined ? person.memberId : null),
                        // Normalize name for matching
                        name: typeof person.name === 'string' ? person.name.trim() : person.name,
                        parents: new Set((person.parents || []).map(id => Number(id))),
                        children: new Set((person.children || []).map(id => Number(id))),
                        spouses: new Set((person.spouses || []).map(id => Number(id))),
                        siblings: new Set((person.siblings || []).map(id => Number(id)))
                    });
                });
                newTree.nextId = Math.max(...data.people.map(p => parseInt(p.id))) + 1;
                // Set rootId priority: focus param -> logged-in user's userId -> name match -> first person
                let rootPersonId = null;
                const focusStr = focusFromQuery;
                if (focusStr) {
                    for (const [personId, personObj] of newTree.people.entries()) {
                        // Prefer memberId match (this is the canonical user id in most payloads), then fallback to userId
                        if ((personObj.memberId && String(personObj.memberId) === focusStr) ||
                            (personObj.userId && String(personObj.userId) === focusStr)) {
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
                        if (personObj.name && String(personObj.name).trim().toLowerCase() === targetName) {
                            rootPersonId = personId;
                            break;
                        }
                    }
                    // StartsWith match
                    if (rootPersonId === null) {
                        for (const [personId, personObj] of newTree.people.entries()) {
                            if (personObj.name && String(personObj.name).trim().toLowerCase().startsWith(targetName)) {
                                rootPersonId = personId;
                                break;
                            }
                        }
                    }
                    // Includes match
                    if (rootPersonId === null) {
                        for (const [personId, personObj] of newTree.people.entries()) {
                            if (personObj.name && String(personObj.name).trim().toLowerCase().includes(targetName)) {
                                rootPersonId = personId;
                                break;
                            }
                        }
                    }
                }
                if (rootPersonId === null) {
                    const userIdStr = String(userInfo.userId);
                    for (const [personId, personObj] of newTree.people.entries()) {
                        if (personObj.memberId && String(personObj.memberId) === userIdStr) {
                            rootPersonId = personId;
                            break;
                        }
                    }
                }
                // Fallback: match by name if memberId is missing or not matched
                if (rootPersonId === null) {
                    for (const [personId, personObj] of newTree.people.entries()) {
                        if (personObj.name && personObj.name === userInfo.name) {
                            rootPersonId = personId;
                            break;
                        }
                    }
                }
                // Final fallback: use the first person in the data
                if (rootPersonId !== null) {
                    console.log('Focus selection -> using root person', { rootPersonId, focusFromQuery, focusNameFromQuery });
                    newTree.rootId = rootPersonId;
                } else {
                    console.warn('Focus selection -> falling back to first person', { focusFromQuery, focusNameFromQuery });
                    newTree.rootId = data.people[0].id;
                }
                
                // ✅ FIX GENERATION INCONSISTENCIES: Ensure spouses have same generation
                newTree.people.forEach(person => {
                    if (person.spouses && person.spouses.size > 0) {
                        person.spouses.forEach(spouseId => {
                            const spouse = newTree.people.get(spouseId);
                            if (spouse && spouse.generation !== person.generation) {
                                console.log(`🔧 Initial load: Fixing generation for spouse ${spouse.name}: ${spouse.generation} → ${person.generation}`);
                                spouse.generation = person.generation;
                            }
                        });
                    }
                });
                
                setTree(newTree);
                updateStats(newTree);
                arrangeTree(newTree);
            }
            setTreeLoading(false);
        };
        if (userInfo) initializeTree();
    }, [userInfo, code]);

    const updateStats = (treeInstance) => {
        setStats(treeInstance.getStats());
    };

    const arrangeTree = (treeInstance) => {
        // For large trees, show loading state during arrangement
        const memberCount = treeInstance.people.size;
        
        if (useHierarchical) {
            // Use hierarchical layout (GoJS-inspired)
            const layout = calculateHierarchicalLayout(treeInstance);
            setHierarchicalLayout(layout);
            
            // Update person positions in tree from layout
            layout.positions.forEach((pos, personId) => {
                const person = treeInstance.people.get(personId);
                if (person) {
                    person.x = pos.x;
                    person.y = pos.y;
                }
            });
            
            setTree(treeInstance);
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
                    setTree(treeInstance);
                    setTreeLoading(false);
                }, 100);
            } else {
                const layout = autoArrange(treeInstance);
                if (layout) {
                    setDagreGraph(layout.g);
                    setDagreLayoutOffsetX(layout.dagreLayoutOffsetX);
                    setDagreLayoutOffsetY(layout.dagreLayoutOffsetY);
                }
                setTree(treeInstance);
            }
        }

        // Debug: Log positions of each person (only for smaller trees)
        if (treeInstance && treeInstance.people && memberCount <= 25) {
            console.log('Person positions:', Array.from(treeInstance.people.values()).map(p => ({ id: p.id, name: p.name, x: p.x, y: p.y })));
        }
    };

    const handlePersonClick = (personId) => {
        if (!tree) return;
        const person = tree.people.get(personId);
        if (!person) return;

        // Set selected person for relationship display
        setSelectedPersonId(personId);

        // Set up icons with English labels (no translation except for relationships)
        const icons = {
            'Add Parents': `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zM20 10h-2V8h-2v2h-2v2h2v2h2v-2h2v-2z"/></svg>`,
            'Add Spouse': `<svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
            'Add Child': `<svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>`,
            'Add Sibling': `<svg viewBox="0 0 24 24"><path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14zM12 10h-2v2H8v-2H6V8h2V6h2v2h2v2z"/></svg>`,
            'Edit': `<svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34a.9959.9959 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/></svg>`,
            'Delete': `<svg viewBox="0 0 24 24"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>`
        };

        const items = [];
        if (person.parents.size === 0) {
            items.push({
                label: 'Add Parents',
                action: () => setModal({ isOpen: true, action: { type: 'parents', person } }),
                icon: icons['Add Parents']
            });
        }
        items.push({
            label: 'Add Spouse',
            action: () => setModal({ isOpen: true, action: { type: 'spouse', person } }),
            icon: icons['Add Spouse']
        });
        items.push({
            label: 'Add Child',
            action: () => setModal({ isOpen: true, action: { type: 'children', person } }),
            icon: icons['Add Child']
        });
        if (person.parents.size > 0) {
            items.push({
                label: 'Add Sibling',
                action: () => setModal({ isOpen: true, action: { type: 'siblings', person } }),
                icon: icons['Add Sibling']
            });
        }
        items.push({
            label: 'Edit',
            action: () => setModal({ isOpen: true, action: { type: 'edit', person } }),
            icon: icons['Edit']
        });
        if (person.id !== tree?.rootId) {
            items.push({
                label: 'Delete',
                action: () => deletePerson(personId),
                icon: icons['Delete']
            });
        }

        // Calculate position for radial menu
        const personElement = document.querySelector(`[data-person-id="${personId}"]`);
        if (personElement) {
            const rect = personElement.getBoundingClientRect();
            setRadialMenu({
                isActive: true,
                position: {
                    x: rect.left + rect.width / 2 + window.scrollX,
                    y: rect.top + rect.height / 2 + window.scrollY
                },
                items,
                activePersonId: personId
            });
        }
    };

    const handleRadialMenuItemClick = (item) => {
        item.action();
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
        if (type === 'edit' && basePerson) {
            const existingPerson = newTree.people.get(basePerson.id);
            if (existingPerson && persons.length > 0) {
                const updatedPerson = {
                    ...existingPerson,
                    name: persons[0].name,
                    gender: persons[0].gender,
                    age: persons[0].age,
                    img: persons[0].img,
                    lifeStatus: persons[0].lifeStatus || 'living',
                    memberId: persons[0].memberId || persons[0].userId || null,
                };
                newTree.people.set(existingPerson.id, updatedPerson);
            }
            setTree(newTree);
            updateStats(newTree);
            arrangeTree(newTree);
            setHasUnsavedChanges(true); // 🚀 Mark as changed
            return;
        }

        persons.forEach(personData => {
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
                icon: 'info',
                title: 'Duplicate Member',
                text: 'This member already exists in the tree.',
            });
            return;
        }

        // Add relationships based on action type
        // If basePerson is undefined (new tree), just add the persons without relationships
        if (!basePerson) {
            setTree(newTree);
            updateStats(newTree);
            arrangeTree(newTree);
            return;
        }

        // Make sure basePerson exists in the new tree
        const basePersonInNewTree = newTree.people.get(basePerson.id);
        if (!basePersonInNewTree) {
            console.error('Base person not found in tree');
            setTree(newTree);
            updateStats(newTree);
            arrangeTree(newTree);
            return;
        }

        if (type === 'parents') {
            persons.forEach(personData => {
                const parentId = personIdMap.get(personData);
                if (parentId) {
                    newTree.addRelation(parentId, basePersonInNewTree.id, 'parent-child');
                }
            });
            // If two parents, add spouse relation
            if (persons.length === 2) {
                const parent1 = personIdMap.get(persons[0]);
                const parent2 = personIdMap.get(persons[1]);
                if (parent1 && parent2) {
                    newTree.addRelation(parent1, parent2, 'spouse');
                }
            }
        } else if (type === 'children') {
            persons.forEach(personData => {
                const childId = personIdMap.get(personData);
                if (childId) {
                    newTree.addRelation(basePersonInNewTree.id, childId, 'parent-child');
                    // Add to all spouses of the base person
                    basePersonInNewTree.spouses.forEach(spouseId => {
                        const spouse = newTree.people.get(spouseId);
                        if (spouse) {
                            newTree.addRelation(spouseId, childId, 'parent-child');
                        }
                    });
                }
            });
        } else if (type === 'spouse') {
            const spouseId = personIdMap.get(persons[0]);
            if (spouseId) {
                newTree.addRelation(basePersonInNewTree.id, spouseId, 'spouse');
            }
        } else if (type === 'siblings') {
            persons.forEach(personData => {
                const siblingId = personIdMap.get(personData);
                if (siblingId) {
                    basePersonInNewTree.parents.forEach(parentId => {
                        const parent = newTree.people.get(parentId);
                        if (parent) {
                            newTree.addRelation(parentId, siblingId, 'parent-child');
                        }
                    });
                }
            });
        }

        setTree(newTree);
        updateStats(newTree);
        arrangeTree(newTree);
        setHasUnsavedChanges(true); // 🚀 Mark as changed
    };

    const deletePerson = async (personId) => {
        if (!tree) return;
        if (personId === tree.rootId) {
            Swal.fire({
                icon: 'info',
                title: 'Cannot Delete Root',
                text: 'Cannot delete the root person.',
            });
            return;
        }

        const result = await Swal.fire({
            icon: 'warning',
            title: 'Are you sure?',
            text: 'You are about to delete this person. This action cannot be undone.',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it!',
            cancelButtonText: 'No, cancel!',
        });

        if (result.isConfirmed) {
            const newTree = new FamilyTree();
            newTree.people = new Map(tree.people);
            newTree.nextId = tree.nextId;
            newTree.rootId = tree.rootId;

            const personToDelete = newTree.people.get(personId);
            if (!personToDelete) return;

            const relatives = new Set([...personToDelete.parents, ...personToDelete.children, ...personToDelete.spouses, ...personToDelete.siblings]);

            relatives.forEach(relId => {
                const relative = newTree.people.get(relId);
                if (relative) {
                    relative.parents.delete(personId);
                    relative.children.delete(personId);
                    relative.spouses.delete(personId);
                    relative.siblings.delete(personId);
                }
            });

            newTree.people.delete(personId);

            setTree(newTree);
            updateStats(newTree);
            arrangeTree(newTree);
            setHasUnsavedChanges(true); // 🚀 Mark as changed
            if (selectedPersonId === personId) {
                setSelectedPersonId(null);
            }
        }
    };

    const resetTree = async () => {
        console.log('🔵 New Tree button clicked! hasUnsavedChanges:', hasUnsavedChanges);

        // 🚀 CRITICAL: Warn if there are unsaved changes
        if (hasUnsavedChanges) {
            console.warn('⚠️ Blocked: Unsaved changes exist');
            await Swal.fire({
                icon: 'error',
                title: 'Unsaved Changes!',
                text: 'You have unsaved changes. Please save your current tree before creating a new one.',
                confirmButtonText: 'OK',
            });
            return; // Don't proceed
        }

        // 🚀 CRITICAL: Warn about data loss
        const memberCount = tree ? tree.people.size : 0;
        const result = await Swal.fire({
            icon: 'warning',
            title: 'Create New Tree',
            html: `<p>This will <strong>replace</strong> your current tree with ${memberCount} members.</p>
                   <p><strong style="color: red;">This action cannot be undone!</strong></p>
                   <p>Make sure you have saved your current tree first.</p>`,
            showCancelButton: true,
            confirmButtonText: 'Yes, create new tree!',
            cancelButtonText: 'No, keep current tree!',
            confirmButtonColor: '#d33',
        });

        if (result.isConfirmed) {
            const newTree = new FamilyTree();
            newTree.addPerson({
                name: userInfo.name,
                gender: userInfo.gender,
                age: userInfo.age,
                img: userInfo.profileUrl,
                dob: userInfo.dob,
                memberId: userInfo.userId
            });
            setTree(newTree);
            updateStats(newTree);
            arrangeTree(newTree);
            setSelectedPersonId(null);
            setHasUnsavedChanges(true); // 🚀 Mark as changed - new tree needs to be saved!
        }
    };

    const downloadTreeData = async () => {
        // Download the tree as an image (PNG)
        const treeCanvas = document.querySelector('.tree-canvas');
        if (!treeCanvas) return;

        // Step 1: Replace all images in the tree with a local image to avoid CORS issues
        const allImgs = treeCanvas.querySelectorAll('img');
        const originalSrcs = [];
        const localImg = '/public/assets/user.png'; // Adjust path if needed
        allImgs.forEach(img => {
            originalSrcs.push(img.src);
            img.src = localImg;
        });

        // Save original styles
        const originalOverflow = treeCanvas.style.overflow;
        const originalWidth = treeCanvas.style.width;
        const originalHeight = treeCanvas.style.height;

        // Expand to fit content
        treeCanvas.style.overflow = 'visible';
        treeCanvas.style.width = 'auto';
        treeCanvas.style.height = 'auto';

        try {
            // Use html2canvas with higher scale for better quality
            const canvas = await html2canvas(treeCanvas, {
                backgroundColor: '#fff', // Set a white background
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

            const image = canvas.toDataURL('image/png');
            const a = document.createElement('a');
            a.href = image;
            a.download = 'family-tree.png';
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
                icon: 'error',
                title: 'Export Failed',
                text: 'Could not generate image. Try again or check for CORS issues.'
            });
        }
    };

    const useAdvancedAlgorithms = () => {
        Swal.fire({
            icon: 'info',
            title: 'Advanced Algorithms',
            text: 'Advanced algorithms feature is available in the React version!',
        });
    };

    const centerTreeInView = () => {
        if (!containerRef.current) return;

        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        const memberCount = tree.people.size;
        const personSize = memberCount > 50 ? 80 : 100; // Dynamic person size

        tree.people.forEach(person => {
            minX = Math.min(minX, person.x - personSize / 2);
            minY = Math.min(minY, person.y - personSize / 2);
            maxX = Math.max(maxX, person.x + personSize / 2);
            maxY = Math.max(maxY, person.y + personSize / 2);
        });

        const treeWidth = maxX - minX;
        const treeHeight = maxY - minY;

        // For large trees, center both horizontally and vertically
        if (memberCount > 50) {
            containerRef.current.scrollLeft = (minX + treeWidth / 2) - containerRef.current.clientWidth / 2;
            containerRef.current.scrollTop = (minY + treeHeight / 2) - containerRef.current.clientHeight / 2;
        } else {
            // For smaller trees, center horizontally, align to top vertically
            containerRef.current.scrollLeft = (minX + treeWidth / 2) - containerRef.current.clientWidth / 2;
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
        if (tree && tree.people.size > 0 && window.innerWidth <= 600 && containerRef.current) {
            const memberCount = tree.people.size;
            const personSize = memberCount > 50 ? 80 : 100; // Dynamic person size

            containerRef.current.scrollTop = 0;
            // Center horizontally
            let minX = Infinity, maxX = -Infinity;
            tree.people.forEach(person => {
                minX = Math.min(minX, person.x - personSize / 2);
                maxX = Math.max(maxX, person.x + personSize / 2);
            });
            const treeWidth = maxX - minX;
            containerRef.current.scrollLeft = (minX + treeWidth / 2) - containerRef.current.clientWidth / 2;
        }
    }, [tree]);

    // Recalculate radial menu position on scroll/resize if open
    useEffect(() => {
        if (!radialMenu.isActive || !radialMenu.activePersonId) return;
        function updateMenuPosition() {
            const personElement = document.querySelector(`[data-person-id="${radialMenu.activePersonId}"]`);
            if (personElement) {
                const rect = personElement.getBoundingClientRect();
                setRadialMenu(prev => ({
                    ...prev,
                    position: {
                        x: rect.left + rect.width / 2 + window.scrollX,
                        y: rect.top + rect.height / 2 + window.scrollY
                    }
                }));
            }
        }
        window.addEventListener('scroll', updateMenuPosition, true);
        window.addEventListener('resize', updateMenuPosition);
        return () => {
            window.removeEventListener('scroll', updateMenuPosition, true);
            window.removeEventListener('resize', updateMenuPosition);
        };
    }, [radialMenu.isActive, radialMenu.activePersonId]);

    // 🚀 PERFORMANCE: Use useCallback to prevent function re-creation
    const saveTreeToApi = useCallback(async () => {
        console.log('🔵 Save button clicked! Current status:', saveStatus);

        // 🚀 CRITICAL FIX: Prevent multiple simultaneous saves
        if (saveStatus === 'loading') {
            console.warn('⚠️ Save already in progress, ignoring click');
            return;
        }

        if (!tree) {
            console.warn('⚠️ No tree data to save');
            return;
        }

        // 🚀 NEW: Check if there are unsaved changes
        if (!hasUnsavedChanges) {
            console.log('ℹ️ No changes detected, skipping save');
            Swal.fire({
                icon: 'info',
                title: 'No Changes',
                text: 'No changes have been made to save.',
                timer: 2000,
                showConfirmButton: false
            });
            return;
        }

        console.log(`🚀 Starting save for ${tree.people.size} members`);
        setSaveStatus('loading');
        setSaveMessage('');
        try {
            // Calculate and attach relationshipCode for each person
            const calculator = new RelationshipCalculator(tree);
            const rootId = tree.rootId;
            for (const person of tree.people.values()) {
                if (person.id !== rootId) {
                    const rel = calculator.calculateRelationship(rootId, person.id);
                    person.relationshipCode = rel.relationshipCode;
                } else {
                    person.relationshipCode = 'SELF';
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
                formData.append(`person_${index}_lifeStatus`, person.lifeStatus || 'living');
                formData.append(`person_${index}_birthOrder`, person.birthOrder || 0);
                formData.append(`person_${index}_memberId`, person.memberId || '');
                formData.append(`person_${index}_parents`, person.parents ? Array.from(person.parents).join(',') : '');
                formData.append(`person_${index}_children`, person.children ? Array.from(person.children).join(',') : '');
                formData.append(`person_${index}_spouses`, person.spouses ? Array.from(person.spouses).join(',') : '');
                formData.append(`person_${index}_siblings`, person.siblings ? Array.from(person.siblings).join(',') : '');
                formData.append(`person_${index}_relationshipCode`, person.relationshipCode || '');
                // For image
                if (person.img) {
                    if (person.img instanceof File) {
                        formData.append(`person_${index}_img`, person.img);
                    } else if (typeof person.img === 'string') {
                        // Extract filename from URL if it's a URL, otherwise use as is
                        const imgValue = person.img.includes('/')
                            ? person.img.split('/').pop()
                            : person.img;
                        formData.append(`person_${index}_img`, imgValue);
                    }
                }
                index++;
            }
            formData.append('person_count', index);
            // Add familyCode to payload if available
            if (userInfo && userInfo.familyCode) {
                formData.append('familyCode', userInfo.familyCode);
            }
            const apiStartTime = Date.now();
            console.log(`📤 Sending ${index} members to API...`);

            const response = await authFetch(`${import.meta.env.VITE_API_BASE_URL}/family/tree/create`, {
                method: 'POST',
                body: formData,
                headers: {
                    // Authorization header will be set in authFetch
                },
            });

            const apiTime = Date.now() - apiStartTime;
            console.log(`✅ API response received in ${apiTime}ms (${(apiTime / 1000).toFixed(2)}s)`);

            if (!response) return;
            if (!response.ok) throw new Error('Failed to save');

            // ✅ RELOAD TREE DATA FROM SERVER AFTER SUCCESSFUL SAVE
            // ✅ PRESERVE EXISTING POSITIONS - No recalculation needed!
            try {
                const treeResponse = await authFetch(`${import.meta.env.VITE_API_BASE_URL}/family/tree/${userInfo.familyCode}`, {
                    headers: { 'accept': '*/*' }
                });
                if (treeResponse.ok) {
                    const treeData = await treeResponse.json();
                    if (treeData && treeData.people && treeData.people.length > 0) {
                        // ✅ PRESERVE POSITIONS: Store current positions before rebuilding
                        const currentPositions = new Map();
                        tree.people.forEach((person, id) => {
                            currentPositions.set(id, { x: person.x, y: person.y });
                        });

                        // Rebuild tree from server data
                        const newTree = new FamilyTree();
                        newTree.people = new Map();
                        treeData.people.forEach(person => {
                            // ✅ RESTORE POSITIONS: Use saved positions if available
                            const savedPosition = currentPositions.get(person.id);
                            
                            newTree.people.set(person.id, {
                                ...person,
                                memberId: person.memberId !== undefined ? person.memberId : null,
                                parents: new Set((person.parents || []).map(id => Number(id))),
                                children: new Set((person.children || []).map(id => Number(id))),
                                spouses: new Set((person.spouses || []).map(id => Number(id))),
                                siblings: new Set((person.siblings || []).map(id => Number(id))),
                                // ✅ KEEP EXACT SAME POSITIONS - No recalculation!
                                x: savedPosition ? savedPosition.x : person.x,
                                y: savedPosition ? savedPosition.y : person.y
                            });
                        });
                        newTree.nextId = Math.max(...treeData.people.map(p => parseInt(p.id))) + 1;

                        // Set rootId to the person whose memberId matches the logged-in user's userId
                        let rootPersonId = null;
                        const userIdStr = String(userInfo.userId);
                        for (const [personId, personObj] of newTree.people.entries()) {
                            if (personObj.memberId && String(personObj.memberId) === userIdStr) {
                                rootPersonId = personId;
                                break;
                            }
                        }
                        if (rootPersonId !== null) {
                            newTree.rootId = rootPersonId;
                        } else {
                            newTree.rootId = treeData.people[0].id;
                        }

                        // ✅ FIX GENERATION INCONSISTENCIES: Ensure spouses have same generation
                        newTree.people.forEach(person => {
                            if (person.spouses && person.spouses.size > 0) {
                                person.spouses.forEach(spouseId => {
                                    const spouse = newTree.people.get(spouseId);
                                    if (spouse && spouse.generation !== person.generation) {
                                        console.log(`🔧 Fixing generation for spouse ${spouse.name}: ${spouse.generation} → ${person.generation}`);
                                        spouse.generation = person.generation;
                                    }
                                });
                            }
                        });

                        // ✅ CRITICAL: Only recalculate if new people were added
                        const hasNewPeople = treeData.people.some(p => !currentPositions.has(p.id));
                        
                        if (hasNewPeople) {
                            // New people added - need to recalculate layout
                            console.log('🔄 New people detected - recalculating layout');
                            setTree(newTree);
                            updateStats(newTree);
                            arrangeTree(newTree);
                        } else {
                            // Same people - keep exact positions!
                            console.log('✅ No new people - preserving exact positions');
                            
                            // Update hierarchical layout with preserved positions
                            const preservedLayout = {
                                positions: new Map(),
                                connections: hierarchicalLayout.connections
                            };
                            newTree.people.forEach((person, id) => {
                                preservedLayout.positions.set(id, {
                                    x: person.x,
                                    y: person.y,
                                    person: person
                                });
                            });
                            
                            setHierarchicalLayout(preservedLayout);
                            setTree(newTree);
                            updateStats(newTree);
                            // ✅ NO arrangeTree() call - positions already perfect!
                        }
                    }
                }
            } catch (reloadErr) {
                console.warn('Failed to reload tree after save:', reloadErr);
                // Continue with success status even if reload fails
            }

            setSaveStatus('success');
            setSaveMessage('Family tree saved successfully!');
            setHasUnsavedChanges(false); // 🚀 Reset changes flag
            console.log('✅ Save completed successfully!');
        } catch (err) {
            console.error('❌ Save failed:', err);
            setSaveStatus('error');
            setSaveMessage('Failed to save family tree.');
        }
    }, [tree, saveStatus, userInfo, hasUnsavedChanges]); // Dependencies for useCallback

    useEffect(() => {
        if (saveStatus === 'success') {
            Swal.fire({
                icon: 'success',
                title: 'Success',
                text: 'Family tree saved successfully!',
            });
            setSaveStatus('idle');
        } else if (saveStatus === 'error') {
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to save family tree.',
            });
            setSaveStatus('idle');
        }
    }, [saveStatus]);

    return (
        <FamilyTreeProvider language={language}>
            {/* All components that use useFamilyTreeLabels must be children here */}
            <>
                {/* Main container for tree and controls */}
                <div className="relative flex flex-col h-full w-full bg-gray-100">
                    {/* Navigation buttons when viewing another family's tree */}

                    {/* Mobile Top Header - Edit Mode */}
                    {canEdit && (
                        <>
                        
                            <div className="sm:hidden fixed top-16 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50 px-3 py-2">
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
                                    className="w-11 h-11 bg-white text-gray-700 rounded-full shadow-lg border border-gray-200 flex items-center justify-center active:scale-95 transition-transform"
                                >
                                    <FaPlus className="text-sm" />
                                </button>
                                <div className="w-11 h-11 bg-white text-gray-700 rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-[10px] font-bold">
                                    {Math.round(zoom * 100)}%
                                </div>
                                <button
                                    onClick={zoomOut}
                                    className="w-11 h-11 bg-white text-gray-700 rounded-full shadow-lg border border-gray-200 flex items-center justify-center active:scale-95 transition-transform"
                                >
                                    <FaMinus className="text-sm" />
                                </button>
                            </div>

                            <div className="sm:hidden fixed bottom-[88px] right-3 z-50 flex flex-col gap-2">
                                <button
                                    onClick={resetTree}
                                    className="w-12 h-12 bg-green-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                                    title="New Tree"
                                >
                                    <FaPlus className="text-lg" />
                                </button>
                                <button
                                    onClick={() => navigate('/merge-family')}
                                    className="w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                                    title="Merge Family Tree"
                                >
                                    <span className="text-[10px] font-semibold">Merge</span>
                                </button>
                                {hasPendingMerge && (
                                    <button
                                        onClick={handleExecuteMergeFromTree}
                                        className="w-12 h-12 bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform"
                                        title="Execute Pending Merge"
                                    >
                                        <span className="text-[9px] font-semibold">Execute</span>
                                    </button>
                                )}
                                <button
                                    onClick={saveTreeToApi}
                                    disabled={saveStatus === 'loading'}
                                    className="w-12 h-12 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center active:scale-95 transition-transform disabled:opacity-60"
                                    title="Save"
                                >
                                    {saveStatus === 'loading' ? (
                                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
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
                        <div className="hidden sm:flex w-full bg-white border-b-2 border-gray-100 shadow-sm z-40">
                            <div className="w-full max-w-none 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 lg:gap-6">
        
                                    <div className="flex items-center justify-center lg:justify-start gap-3 xl:gap-6 flex-wrap">
                                        
                                        {code && code !== userInfo.familyCode && (
                                            <div className="flex items-center gap-2 pr-3 border-r border-gray-300">
                                                <button
                                                    className="inline-flex items-center justify-center w-9 h-9 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 hover:border-gray-400 active:scale-95 transition-all duration-200 shadow-sm"
                                                    onClick={() => navigate(-1)}
                                                    title="Back"
                                                >
                                                    <FaArrowLeft className="text-sm" />
                                                </button>
                                                <button
                                                    className="inline-flex items-center justify-center w-9 h-9 bg-blue-600 border border-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all duration-200 shadow-sm"
                                                    onClick={() => navigate('/family-tree')}
                                                    title="My Birth Family Tree"
                                                >
                                                    <FaHome className="text-sm" />
                                                </button>
                                            </div>
                                        )}

                                      
                                        <div className="flex items-center gap-6 text-sm">
                                            <span className="text-gray-700">
                                                <span className="font-medium">Total:</span> <span className="font-bold text-gray-900">{stats.total}</span>
                                            </span>
                                            <span className="text-gray-700">
                                                <span className="font-medium">Male:</span> <span className="font-bold text-gray-900">{stats.male}</span>
                                            </span>
                                            <span className="text-gray-700">
                                                <span className="font-medium">Female:</span> <span className="font-bold text-gray-900">{stats.female}</span>
                                            </span>
                                            <span className="text-gray-700">
                                                <span className="font-medium">Generations:</span> <span className="font-bold text-gray-900">{stats.generations}</span>
                                            </span>
                                        </div>
                                    </div>

                                
                                    <div className="flex items-center justify-center lg:justify-end gap-3 lg:gap-4 flex-shrink-0">
                                      
                                        <div className="flex items-center">
                                            <LanguageSwitcher />
                                        </div>

                            
                                        <SearchBar
                                            tree={tree}
                                            onSearchResults={handleSearchResults}
                                            onFocusPerson={handleFocusPerson}
                                            onClearSearch={handleClearSearch}
                                            language={language}
                                        />

                                        
                                        <div className="w-px h-8 bg-gray-300"></div>

                                        
                                        <div className="flex items-center gap-2">
                                            <button
                                                className="flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-green-600 text-green-600 rounded-lg hover:bg-green-50 text-sm font-semibold active:scale-95 transition-all duration-200 shadow-sm"
                                                onClick={resetTree}
                                            >
                                                <FaPlus className="text-sm" />
                                                <span>New Tree</span>
                                            </button>
                                            <button
                                                className="flex items-center gap-1.5 px-3 py-2 bg-purple-600 border-2 border-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-semibold active:scale-95 transition-all duration-200 shadow-sm"
                                                onClick={() => navigate('/merge-family')}
                                            >
                                                <span>Merge Family Tree</span>
                                            </button>
                                            {hasPendingMerge && (
                                                <button
                                                    className="flex items-center gap-1.5 px-3 py-2 bg-red-600 border-2 border-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-semibold active:scale-95 transition-all duration-200 shadow-sm"
                                                    onClick={handleExecuteMergeFromTree}
                                                >
                                                    <span>Execute Merge</span>
                                                </button>
                                            )}
                                            <button
                                                className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 border-2 border-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-semibold active:scale-95 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                                                onClick={saveTreeToApi}
                                                disabled={saveStatus === 'loading'}
                                            >
                                                {saveStatus === 'loading' && (
                                                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                                                    </svg>
                                                )}
                                                <FaSave className="text-sm" />
                                                <span>Save</span>
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
                            <div className="sm:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 shadow-sm z-50 px-3 py-2">
                                <div className="flex items-center justify-between gap-2">
                                    {/* Left: Menu Icon (placeholder - you can add menu functionality) */}
                                    <button className="w-10 h-10 bg-green-600 text-white rounded-lg flex items-center justify-center active:scale-95 transition-transform">
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
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
                                    onClick={zoomIn}
                                    className="w-11 h-11 bg-white text-gray-700 rounded-full shadow-lg border border-gray-200 flex items-center justify-center active:scale-95 transition-transform"
                                >
                                    <FaPlus className="text-sm" />
                                </button>
                                <div className="w-11 h-11 bg-white text-gray-700 rounded-full shadow-lg border border-gray-200 flex items-center justify-center text-[10px] font-bold">
                                    {Math.round(zoom * 100)}%
                                </div>
                                <button
                                    onClick={zoomOut}
                                    className="w-11 h-11 bg-white text-gray-700 rounded-full shadow-lg border border-gray-200 flex items-center justify-center active:scale-95 transition-transform"
                                >
                                    <FaMinus className="text-sm" />
                                </button>
                            </div>
                        </>
                    )}

                    {/* Desktop Header - Non Edit */}
                    {!canEdit && (
                        <div className="hidden sm:flex w-full bg-white border-b-2 border-gray-100 shadow-sm z-40">
                            <div className="w-full max-w-none 2xl:max-w-7xl mx-auto px-4 sm:px-6 py-3 sm:py-4">
                                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-3 lg:gap-6">
                                    
                                    <div className="flex items-center justify-center lg:justify-start gap-3 xl:gap-6 flex-wrap">
                                        
                                        {code && code !== userInfo.familyCode && (
                                            <div className="flex items-center gap-2 pr-3 border-r border-gray-300">
                                                <button
                                                    className="inline-flex items-center justify-center w-9 h-9 bg-gray-100 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-200 hover:border-gray-400 active:scale-95 transition-all duration-200 shadow-sm"
                                                    onClick={() => navigate(-1)}
                                                    title="Back"
                                                >
                                                    <FaArrowLeft className="text-sm" />
                                                </button>
                                                <button
                                                    className="inline-flex items-center justify-center w-9 h-9 bg-blue-600 border border-blue-600 text-white rounded-lg hover:bg-blue-700 active:scale-95 transition-all duration-200 shadow-sm"
                                                    onClick={() => navigate('/family-tree')}
                                                    title="My Birth Family Tree"
                                                >
                                                    <FaHome className="text-sm" />
                                                </button>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-6 text-sm">
                                            <span className="text-gray-700">
                                                <span className="font-medium">Total:</span> <span className="font-bold text-gray-900">{stats.total}</span>
                                            </span>
                                            <span className="text-gray-700">
                                                <span className="font-medium">Male:</span> <span className="font-bold text-gray-900">{stats.male}</span>
                                            </span>
                                            <span className="text-gray-700">
                                                <span className="font-medium">Female:</span> <span className="font-bold text-gray-900">{stats.female}</span>
                                            </span>
                                            <span className="text-gray-700">
                                                <span className="font-medium">Generations:</span> <span className="font-bold text-gray-900">{stats.generations}</span>
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
                    {/* Tree visualization area */}
                    <div
                        ref={containerRef}
                        className="flex-1 w-full h-full min-h-0 min-w-0 overflow-auto touch-pan-x touch-pan-y pt-14 sm:pt-0"
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                    >
                        {treeLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-50">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                    <p className="text-gray-600 font-medium">
                                        {tree && tree.people.size > 50 ? 'Loading large family tree...' : 'Loading family tree...'}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div
                            ref={treeCanvasRef}
                            className="tree-canvas relative w-max h-max mx-auto flex flex-col items-start justify-start sm:items-center sm:justify-center"
                            style={{
                                minWidth: tree && tree.people.size > 50 ? (window.innerWidth <= 640 ? '600px' : '1200px') : (window.innerWidth <= 640 ? '400px' : '900px'),
                                minHeight: tree && tree.people.size > 50 ? (window.innerWidth <= 640 ? '500px' : '800px') : (window.innerWidth <= 640 ? '400px' : '600px'),
                                transform: `scale(${zoom})`,
                                transformOrigin: window.innerWidth <= 640 ? 'top left' : 'center center',
                                padding: window.innerWidth <= 640 ? '10px' : '20px',
                            }}
                        >
                            {/* Tree SVG connections */}
                            {useHierarchical ? (
                                <HierarchicalConnections
                                    positions={hierarchicalLayout.positions}
                                    connections={hierarchicalLayout.connections}
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
                            {tree && Array.from(tree.people.values())
                                .sort((a, b) => {
                                    // Sort by generation first, then by x position for better rendering order
                                    if (a.generation !== b.generation) {
                                        return (a.generation || 0) - (b.generation || 0);
                                    }
                                    return a.x - b.x;
                                })
                                .map(person => (
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
                                        isSearchResult={searchResults.some(result => result.id === person.id)}
                                        currentUserId={userInfo?.userId} // <-- Pass userId
                                        currentFamilyId={userInfo?.familyId || userInfo?.familyCode} // <-- Pass familyId or familyCode
                                    />
                                ))}
                        </div>
                    </div>


                    {/* Mobile Navigation Buttons (when viewing other family tree) */}
                    {code && code !== userInfo.familyCode && (
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
                                onClick={() => navigate('/family-tree')}
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
                    onClose={() => setRadialMenu({ isActive: false, position: { x: 0, y: 0 }, items: [], activePersonId: null })}
                />

                <AddPersonModal
                    isOpen={canEdit && modal.isOpen}
                    onClose={() => setModal({ isOpen: false, action: { type: '', person: null } })}
                    action={modal.action}
                    onAddPersons={handleAddPersons}
                    familyCode={userInfo?.familyCode}
                    token={localStorage.getItem('access_token')}
                    existingMemberIds={tree ? Array.from(tree.people.values()).map(p => p.memberId).filter(Boolean) : []}
                />

                {/* Debug Panel */}
                {debugPanel && (
                    <div className="debug-panel">
                        <div className="debug-header">
                            <h3>Debug Panel - Traversal Analysis</h3>
                            <button className="btn btn-sm" onClick={() => setDebugPanel(false)}>×</button>
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
        </FamilyTreeProvider>
    );
};
export default FamilyTreePage;
