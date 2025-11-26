import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { useUser } from '../Contexts/UserContext';
import { useLanguage } from '../Contexts/LanguageContext';
import { FamilyTree } from '../utils/FamilyTree';
import { calculateHierarchicalLayout } from '../utils/HierarchicalTreeLayout';
import Person from '../Components/FamilyTree/Person';
import HierarchicalConnections from '../Components/FamilyTree/HierarchicalConnections';
import LanguageSwitcher from '../Components/LanguageSwitcher';
import { getMergeState, executeMerge as executeMergeApi } from '../utils/familyMergeApi';

const MergeFamilyPreviewTreePage = () => {
  const { id } = useParams();
  const requestId = Number(id);
  const navigate = useNavigate();
  const { userInfo, userLoading } = useUser();
  const { language } = useLanguage();

  const [tree, setTree] = useState(null);
  const [layout, setLayout] = useState({ positions: new Map(), connections: [] });
  const [stats, setStats] = useState({ total: 0, male: 0, female: 0, generations: 0 });
  const [zoom, setZoom] = useState(1);
  const [buildingTree, setBuildingTree] = useState(false);

  const containerRef = useRef(null);

  const { data: mergeStateResp, isLoading, error } = useQuery({
    queryKey: ['mergePreviewTree', requestId],
    queryFn: () => getMergeState(requestId),
    enabled: !!requestId,
  });

  // Basic auth / approval guard
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
        text:
          userInfo.approveStatus !== 'approved'
            ? 'Your family membership is pending approval. Please wait for admin approval.'
            : 'You need to create or join a family first.',
      }).then(() => navigate('/my-family'));
    }
  }, [userInfo, userLoading, navigate]);

  // Build preview tree from finalTree in merge state
  useEffect(() => {
    const buildFromState = async () => {
      if (!mergeStateResp || !mergeStateResp.data) return;
      const rawState = mergeStateResp.data.state || null;
      const finalTree = rawState && rawState.finalTree ? rawState.finalTree : null;
      const membersInput = finalTree && Array.isArray(finalTree.members) ? finalTree.members : [];

      if (!membersInput.length) {
        return;
      }

      setBuildingTree(true);

      try {
        const newTree = new FamilyTree();
        newTree.people = new Map();

        membersInput.forEach((m) => {
          if (!m || m.id == null) return;
          newTree.people.set(m.id, {
            id: m.id,
            name: m.name || 'Unknown',
            gender: m.gender || 'unknown',
            age: m.age || null,
            generation:
              typeof m.generation === 'number'
                ? m.generation
                : null,
            parents: new Set(
              Array.isArray(m.parents) ? m.parents.map((id) => Number(id)) : []
            ),
            children: new Set(
              Array.isArray(m.children) ? m.children.map((id) => Number(id)) : []
            ),
            spouses: new Set(
              Array.isArray(m.spouses) ? m.spouses.map((id) => Number(id)) : []
            ),
            siblings: new Set(
              Array.isArray(m.siblings) ? m.siblings.map((id) => Number(id)) : []
            ),
            img: m.img || '',
            lifeStatus: m.lifeStatus || 'living',
            memberId: m.memberId ?? null,
            userId: m.userId ?? null,
            relationshipCode: m.relationshipCode || undefined,
          });
        });

        // Normalize spouse generations to match main tree behaviour:
        // any spouses must share the same generation for clean horizontal connections.
        newTree.people.forEach((person) => {
          if (person.spouses && person.spouses.size > 0) {
            person.spouses.forEach((spouseId) => {
              const spouse = newTree.people.get(spouseId);
              if (spouse && spouse.generation !== person.generation) {
                spouse.generation = person.generation;
              }
            });
          }
        });

        const maxId = membersInput.reduce((max, m) => {
          const idNum = typeof m.id === 'number' ? m.id : parseInt(String(m.id), 10) || 0;
          return idNum > max ? idNum : max;
        }, 0);
        newTree.nextId = maxId + 1;

        // Choose a sensible root: prefer logged-in user, then first admin, then first person
        let rootId = null;
        const userIdStr = userInfo ? String(userInfo.userId) : null;
        if (userIdStr) {
          for (const [pid, p] of newTree.people.entries()) {
            if ((p.memberId && String(p.memberId) === userIdStr) || (p.userId && String(p.userId) === userIdStr)) {
              rootId = pid;
              break;
            }
          }
        }
        if (rootId == null) {
          const admin = membersInput.find((m) => m && m.isAdmin && m.id != null);
          if (admin) {
            rootId = admin.id;
          }
        }
        if (rootId == null && membersInput.length > 0) {
          rootId = membersInput[0].id;
        }
        newTree.rootId = rootId;

        const layoutData = calculateHierarchicalLayout(newTree);
        setLayout(layoutData);
        setTree(newTree);
        setStats(newTree.getStats());
      } finally {
        setBuildingTree(false);
      }
    };

    buildFromState();
  }, [mergeStateResp, userInfo]);

  const zoomIn = () => setZoom((prev) => Math.min(2, +(prev + 0.1).toFixed(2)));
  const zoomOut = () => setZoom((prev) => Math.max(0.5, +(prev - 0.1).toFixed(2)));
  const resetZoom = () => setZoom(1);

  const primaryFamilyCode = mergeStateResp?.data?.primaryFamilyCode || null;

  const handleExecuteFromPreview = async () => {
    if (!requestId) return;

    const result = await Swal.fire({
      icon: 'warning',
      title: 'Execute Merge?',
      text: 'This will apply the currently previewed merged tree to the primary family and cannot be easily undone. Continue?',
      showCancelButton: true,
      confirmButtonText: 'Yes, execute',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });

    if (!result.isConfirmed) return;

    try {
      await executeMergeApi(requestId);
      await Swal.fire({
        icon: 'success',
        title: 'Merge Executed',
        text: 'Family merge executed successfully.',
      });

      if (primaryFamilyCode) {
        navigate(`/family-tree/${primaryFamilyCode}`);
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
  };

  if (userLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading user...</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading merged tree preview...</p>
        </div>
      </div>
    );
  }

  const hasMembers = layout.positions && layout.positions.size > 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {/* Header */}
      <div className="bg-white shadow-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-gray-800">Merged Tree Preview</h1>
            <p className="text-xs md:text-sm text-gray-500 mt-1">
              Primary Family:{' '}
              <span className="font-semibold">{primaryFamilyCode || '-'}</span>
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Total Members: <span className="font-semibold">{stats.total}</span> | Generations:{' '}
              <span className="font-semibold">{stats.generations}</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <button
              type="button"
              onClick={() => navigate(`/merge-family/${requestId}`)}
              className="px-3 py-2 text-xs md:text-sm border rounded-md text-gray-700 hover:bg-gray-50"
            >
              Back to Decisions
            </button>
            <button
              type="button"
              onClick={handleExecuteFromPreview}
              className="px-3 py-2 text-xs md:text-sm bg-red-600 text-white rounded-md hover:bg-red-700"
            >
              Execute Merge
            </button>
          </div>
        </div>
      </div>

      {/* Tree Canvas */}
      <div
        ref={containerRef}
        className="relative overflow-auto"
        style={{ height: 'calc(100vh - 80px)', backgroundColor: '#f8fafc' }}
      >
        {buildingTree ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Arranging merged tree...</p>
            </div>
          </div>
        ) : hasMembers && tree ? (
          <div
            className="relative"
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              transition: 'transform 0.2s ease-out',
            }}
          >
            <HierarchicalConnections positions={layout.positions} connections={layout.connections} />

            {Array.from(layout.positions.values()).map((pos) => (
              <div
                key={pos.person.id}
                style={{
                  position: 'absolute',
                  left: `${pos.x - 100}px`,
                  top: `${pos.y - 50}px`,
                  width: '200px',
                  height: '100px',
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
                  currentUserId={userInfo?.userId}
                  currentFamilyId={primaryFamilyCode || userInfo?.familyCode}
                  viewOnly={true}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-gray-500 text-sm">
              No merged tree preview available. Please go back and save decisions first.
            </p>
          </div>
        )}
      </div>

      {/* Zoom controls */}
      <div className="fixed bottom-4 right-4 bg-white rounded-full shadow-lg border border-gray-200 flex items-center space-x-2 px-3 py-2">
        <button
          onClick={zoomOut}
          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
        >
          -
        </button>
        <span className="text-xs font-medium text-gray-700 min-w-[50px] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={zoomIn}
          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
        >
          +
        </button>
        <button
          onClick={resetZoom}
          className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
        >
          Reset
        </button>
      </div>
    </div>
  );
};

export default MergeFamilyPreviewTreePage;
