/**
 * Family Tree Page with Hierarchical Layout
 * Clean, GoJS-inspired layout with no overlaps
 * Free & Open Source implementation
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useUser } from '../Contexts/UserContext';
import { FamilyTree } from '../utils/FamilyTree';
import { calculateHierarchicalLayout } from '../utils/HierarchicalTreeLayout';
import Person from '../Components/FamilyTree/Person';
import HierarchicalConnections from '../Components/FamilyTree/HierarchicalConnections';
import { useLanguage } from '../Contexts/LanguageContext';
import { FamilyTreeProvider } from '../Contexts/FamilyTreeContext';
import { useNavigate, useParams } from 'react-router-dom';
import Swal from 'sweetalert2';
import { FaHome, FaSearchPlus, FaSearchMinus, FaExpand } from 'react-icons/fa';

// Utility for authenticated fetch
const authFetch = async (url, options = {}) => {
    const token = localStorage.getItem('access_token');
    const headers = {
        ...options.headers,
        Authorization: token ? `Bearer ${token}` : undefined,
    };
    
    try {
        const response = await fetch(url, { ...options, headers });
        if (response.status === 401) {
            localStorage.removeItem('access_token');
            window.location.href = '/login';
            return null;
        }
        return response;
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'Network Error',
            text: 'Network error or server error. Please try again.',
        });
        return null;
    }
};

const FamilyTreeHierarchical = () => {
    const [tree, setTree] = useState(null);
    const [stats, setStats] = useState({ total: 0, male: 0, female: 0, generations: 0 });
    const [layout, setLayout] = useState({ positions: new Map(), connections: [] });
    const [zoom, setZoom] = useState(1);
    const [treeLoading, setTreeLoading] = useState(false);
    
    const containerRef = useRef(null);
    const { language } = useLanguage();
    const { userInfo, userLoading } = useUser();
    const navigate = useNavigate();
    const { code } = useParams();

    // Check user authentication and approval
    useEffect(() => {
        if (userLoading) return;

        if (!userInfo) {
            navigate('/login');
            return;
        }

        if (userInfo.approveStatus !== 'approved' || !userInfo.familyCode) {
            Swal.fire({
                icon: 'warning',
                title: 'Access Restricted',
                text: userInfo.approveStatus !== 'approved'
                    ? 'Your family membership is pending approval.'
                    : 'You need to create or join a family first.',
                showCloseButton: true,
                showCancelButton: true,
                confirmButtonText: 'Go to My Family',
                cancelButtonText: 'Close',
                allowOutsideClick: true,
                allowEscapeKey: true,
            }).then((res) => {
                if (res.isConfirmed) {
                    navigate('/my-family');
                }
            });
            return;
        }
    }, [userInfo, userLoading, navigate]);

    // Load family tree data
    useEffect(() => {
        const loadTree = async () => {
            const familyCodeToUse = code || (userInfo && userInfo.familyCode);
            
            if (!userInfo || !familyCodeToUse) return;

            setTreeLoading(true);
            
            try {
                const apiUrl = `${import.meta.env.VITE_API_BASE_URL}/family/tree/${familyCodeToUse}`;
                const response = await authFetch(apiUrl, {
                    headers: { 'accept': '*/*' }
                });

                if (response && response.ok) {
                    const data = await response.json();
                    
                    if (data && data.people && data.people.length > 0) {
                        // Build tree from API data
                        const newTree = new FamilyTree();
                        newTree.people = new Map();
                        
                        data.people.forEach(person => {
                            newTree.people.set(person.id, {
                                ...person,
                                memberId: person.memberId !== undefined ? person.memberId : null,
                                userId: person.userId !== undefined ? person.userId : (person.memberId !== undefined ? person.memberId : null),
                                name: typeof person.name === 'string' ? person.name.trim() : person.name,
                                parents: new Set((person.parents || []).map(id => Number(id))),
                                children: new Set((person.children || []).map(id => Number(id))),
                                spouses: new Set((person.spouses || []).map(id => Number(id))),
                                siblings: new Set((person.siblings || []).map(id => Number(id)))
                            });
                        });
                        
                        newTree.nextId = Math.max(...data.people.map(p => parseInt(p.id))) + 1;
                        
                        // Set root (logged-in user or first person)
                        let rootPersonId = null;
                        const userIdStr = String(userInfo.userId);
                        
                        for (const [personId, personObj] of newTree.people.entries()) {
                            if (personObj.memberId && String(personObj.memberId) === userIdStr) {
                                rootPersonId = personId;
                                break;
                            }
                        }
                        
                        if (rootPersonId === null) {
                            for (const [personId, personObj] of newTree.people.entries()) {
                                if (personObj.name && personObj.name === userInfo.name) {
                                    rootPersonId = personId;
                                    break;
                                }
                            }
                        }
                        
                        newTree.rootId = rootPersonId !== null ? rootPersonId : data.people[0].id;
                        
                        setTree(newTree);
                        setStats(newTree.getStats());
                        
                        // Calculate hierarchical layout
                        const layoutData = calculateHierarchicalLayout(newTree);
                        setLayout(layoutData);
                    } else {
                        // Create new tree with user as root
                        const newTree = new FamilyTree();
                        newTree.addPerson({
                            name: userInfo.name,
                            gender: userInfo.gender,
                            age: userInfo.age,
                            img: userInfo.profileUrl,
                            dob: userInfo.dob,
                            memberId: userInfo.userId,
                        });
                        
                        setTree(newTree);
                        setStats(newTree.getStats());
                        
                        const layoutData = calculateHierarchicalLayout(newTree);
                        setLayout(layoutData);
                    }
                }
            } catch (err) {
                console.error('Error loading tree:', err);
            } finally {
                setTreeLoading(false);
            }
        };

        if (userInfo) loadTree();
    }, [userInfo, code]);

    // Zoom controls
    const zoomIn = () => setZoom(prev => Math.min(2, +(prev + 0.1).toFixed(2)));
    const zoomOut = () => setZoom(prev => Math.max(0.5, +(prev - 0.1).toFixed(2)));
    const resetZoom = () => setZoom(1);

    // Navigate to home family tree
    const goToHomeTree = () => {
        if (userInfo && userInfo.familyCode) {
            navigate(`/family-tree/${userInfo.familyCode}`);
        }
    };

    // Loading state
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

    return (
        <FamilyTreeProvider>
            <>
                <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
                {/* Header */}
                <div className="bg-white shadow-md border-b border-gray-200">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
                        <div className="flex items-center justify-between">
                            {/* Left: Navigation */}
                            <div className="flex items-center space-x-4">
                                <button
                                    onClick={goToHomeTree}
                                    className="flex items-center space-x-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
                                    title="Go to your family tree"
                                >
                                    <FaHome size={18} />
                                    <span className="hidden sm:inline">Home Tree</span>
                                </button>
                                
                                {/* Stats */}
                                <div className="flex space-x-3">
                                    <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                                        <span className="text-xs text-gray-500">Total:</span>
                                        <span className="ml-1 font-semibold text-blue-600">{stats.total}</span>
                                    </div>
                                    <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                                        <span className="text-xs text-gray-500">Male:</span>
                                        <span className="ml-1 font-semibold text-blue-400">{stats.male}</span>
                                    </div>
                                    <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                                        <span className="text-xs text-gray-500">Female:</span>
                                        <span className="ml-1 font-semibold text-pink-400">{stats.female}</span>
                                    </div>
                                    <div className="bg-white px-3 py-2 rounded-lg shadow-sm border border-gray-200">
                                        <span className="text-xs text-gray-500">Generations:</span>
                                        <span className="ml-1 font-semibold text-purple-600">{stats.generations}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Right: Zoom Controls */}
                            <div className="flex items-center space-x-2">
                                <button
                                    onClick={zoomOut}
                                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                                    title="Zoom Out"
                                >
                                    <FaSearchMinus size={18} />
                                </button>
                                <span className="text-sm font-medium text-gray-700 min-w-[60px] text-center">
                                    {Math.round(zoom * 100)}%
                                </span>
                                <button
                                    onClick={zoomIn}
                                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                                    title="Zoom In"
                                >
                                    <FaSearchPlus size={18} />
                                </button>
                                <button
                                    onClick={resetZoom}
                                    className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                                    title="Reset Zoom"
                                >
                                    <FaExpand size={18} />
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tree Canvas */}
                <div
                    ref={containerRef}
                    className="relative overflow-auto"
                    style={{
                        height: 'calc(100vh - 120px)',
                        backgroundColor: '#f8fafc'
                    }}
                >
                    {treeLoading ? (
                        <div className="flex items-center justify-center h-full">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                                <p className="text-gray-600">Arranging family tree...</p>
                            </div>
                        </div>
                    ) : tree && layout.positions.size > 0 ? (
                        <div
                            className="relative"
                            style={{
                                transform: `scale(${zoom})`,
                                transformOrigin: 'top left',
                                transition: 'transform 0.2s ease-out'
                            }}
                        >
                            {/* Connections Layer */}
                            <HierarchicalConnections
                                positions={layout.positions}
                                connections={layout.connections}
                            />

                            {/* Person Cards Layer */}
                            {Array.from(layout.positions.values()).map(pos => (
                                <div
                                    key={pos.person.id}
                                    style={{
                                        position: 'absolute',
                                        left: `${pos.x - 100}px`, // Center card (200px width / 2)
                                        top: `${pos.y - 50}px`,   // Center card (100px height / 2)
                                        width: '200px',
                                        height: '100px'
                                    }}
                                >
                                    <Person
                                        person={pos.person}
                                        isRoot={pos.person.id === tree.rootId}
                                        onClick={() => {}}
                                        rootId={tree.rootId}
                                        tree={tree}
                                        language={language}
                                        isNew={false}
                                        isSelected={false}
                                        isHighlighted={false}
                                        isSearchResult={false}
                                        currentUserId={userInfo.userId}
                                        currentFamilyId={userInfo.familyCode}
                                        viewOnly={true}
                                    />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex items-center justify-center h-full">
                            <p className="text-gray-500">No family tree data available</p>
                        </div>
                    )}
                </div>
            </div>
        </>
        </FamilyTreeProvider>
    );
};

export default FamilyTreeHierarchical;
