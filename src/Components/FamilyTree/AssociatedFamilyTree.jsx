import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FamilyTree } from '../../utils/FamilyTree';
import { autoArrange } from '../../utils/TreeLayout';
import Person from './Person';
import TreeConnections from './TreeConnections';
import { useUser } from '../../Contexts/UserContext';
import { useLanguage } from '../../Contexts/LanguageContext';
import { useTheme } from '../../Contexts/ThemeContext';

const AssociatedFamilyTree = ({ familyCode, userId }) => {
  const navigate = useNavigate();
  const [tree, setTree] = useState(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [dagreGraph, setDagreGraph] = useState(null);
  const [dagreLayoutOffsetX, setDagreLayoutOffsetX] = useState(0);
  const [dagreLayoutOffsetY, setDagreLayoutOffsetY] = useState(0);
  const [error, setError] = useState(null);
  const { userInfo } = useUser();
  const { language } = useLanguage();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [rootId, setRootId] = useState(null);
  const [familyCodes, setFamilyCodes] = useState([]);
  const [totalConnections, setTotalConnections] = useState(0);
  const [hasScrolledToRoot, setHasScrolledToRoot] = useState(false);

  useEffect(() => {
    const fetchTree = async () => {
      setTreeLoading(true);
      setError(null);
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || '';
        
        // Use userId-based API if userId is provided, otherwise fallback to familyCode
        const apiUrl = userId 
          ? `${baseUrl}/family/associated-by-user/${userId}`
          : `${baseUrl}/family/associated/${familyCode}`;
          
        const response = await fetch(apiUrl);
        if (!response.ok) throw new Error('Failed to fetch associated family tree');
        const data = await response.json();
        
        if (!data.people || data.people.length === 0) {
          setTree(null);
          setError('No members found');
          setTreeLoading(false);
          return;
        }
        
        // Set additional data from userId-based response
        if (data.familyCodes) {
          setFamilyCodes(data.familyCodes);
        }
        if (data.totalConnections !== undefined) {
          setTotalConnections(data.totalConnections);
        }
        // Build FamilyTree instance from data.people
        const newTree = new FamilyTree();
        newTree.people = new Map();
        (data.people || []).forEach(person => {
          newTree.people.set(person.id, {
            ...person,
            // Ensure memberId is available even if API only provided userId
            memberId: person.memberId !== undefined && person.memberId !== null
              ? person.memberId
              : (person.userId !== undefined ? person.userId : null),
            // Preserve userId explicitly for robust matching
            userId: person.userId !== undefined ? person.userId : person.memberId,
            parents: new Set((person.parents || []).map(id => Number(id))),
            children: new Set((person.children || []).map(id => Number(id))),
            spouses: new Set((person.spouses || []).map(id => Number(id))),
            siblings: new Set((person.siblings || []).map(id => Number(id)))
          });
        });
        newTree.nextId = data.people && data.people.length > 0 ? Math.max(...data.people.map(p => parseInt(p.id))) + 1 : 1;
        // Find the rootId: prefer explicit userId prop, then API-provided rootUserId, then logged-in user's userId
        let foundRootId = null;
        // IMPORTANT: prioritize the route/userId (navigation intent) over API-provided rootUserId
        const targetUserId = userId || data.rootUserId || (userInfo && userInfo.userId);
        
        if (targetUserId) {
          for (const person of newTree.people.values()) {
            // Try matching by memberId first
            if (person.memberId && String(person.memberId) === String(targetUserId)) {
              foundRootId = person.id;
              break;
            }
            // Then try matching by userId (if memberId is absent/mismatched)
            if (person.userId && String(person.userId) === String(targetUserId)) {
              foundRootId = person.id;
              break;
            }
          }
        }
        // Fallback: use the first person
        if (!foundRootId && data.people && data.people.length > 0) {
          foundRootId = data.people[0].id;
        }
        newTree.rootId = foundRootId;
        setRootId(foundRootId);
        // Arrange the tree and set dagre graph
        const layout = autoArrange(newTree);
        if (layout) {
          setDagreGraph(layout.g);
          setDagreLayoutOffsetX(layout.dagreLayoutOffsetX);
          setDagreLayoutOffsetY(layout.dagreLayoutOffsetY);
        }
        setTree(newTree);
      } catch (err) {
        setTree(null);
        setError('Could not load tree');
      }
      setTreeLoading(false);
    };
    if (familyCode || userId) fetchTree();
  }, [familyCode, userId, userInfo]);

  // After tree and rootId are set, auto-scroll the root person into view once
  useEffect(() => {
    if (!tree || !rootId || hasScrolledToRoot) return;
    const el = document.getElementById(`person-${rootId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      setHasScrolledToRoot(true);
    }
  }, [tree, rootId, hasScrolledToRoot]);

  if (treeLoading) return <div className="text-gray-500 dark:text-slate-400">Loading Associated Family Tree...</div>;
  if (error) return <div className="text-red-500">{error}</div>;
  if (!tree) return null;

  return (
    <div className="associated-family-tree-container">
      {/* Header with family codes and connection info */}
      {familyCodes.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-slate-900 rounded-lg border border-blue-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200 mb-2">Connected Family Trees</h3>
          <div className="flex flex-wrap gap-2 mb-2">
            {familyCodes
                .filter(code => code !== (familyCode || userInfo?.familyCode))
                .map((code, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  if (code === (userInfo?.familyCode) || code === (familyCode || '')) return;
                  navigate(`/family-tree/${code}`);
                }}
                className="px-3 py-1 bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-200 rounded-full text-sm font-medium hover:bg-blue-200 dark:hover:bg-blue-500/30 focus:outline-none cursor-pointer transition"
              >
                {code}
              </button>
            ))}
          </div>
          {totalConnections > 0 && (
            <p className="text-sm text-blue-600 dark:text-blue-300">
              Total Cross-Family Connections: {totalConnections}
            </p>
          )}
        </div>
      )}
      
      <div style={{ position: 'relative', minHeight: 500, background: isDark ? '#0f172a' : '#f9fafb', borderRadius: 12, overflow: 'auto' }}>
        {dagreGraph && (
          <TreeConnections 
            dagreGraph={dagreGraph}
            dagreLayoutOffsetX={dagreLayoutOffsetX}
            dagreLayoutOffsetY={dagreLayoutOffsetY}
          />
        )}
        {Array.from(tree.people.values())
          .sort((a, b) => (a.generation || 0) - (b.generation || 0))
          .map(person => (
            <Person
              key={person.id}
              person={person}
              isRoot={person.id === rootId}
              rootId={rootId}
              tree={tree}
              isSelected={person.id === rootId}
              isNew={false}
              viewOnly={false}
            />
          ))}
      </div>
    </div>
  );
};

export default AssociatedFamilyTree;
