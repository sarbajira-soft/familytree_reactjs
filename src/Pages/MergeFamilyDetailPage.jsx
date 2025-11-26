import React, { useEffect, useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  getMergeFamilyAPreview,
  getMergeFamilyBPreview,
  getMergeAnalysis,
  saveMergeState,
  executeMerge,
} from '../utils/familyMergeApi';
import { useMergeState } from '../hooks/useApi';
import RelationshipCalculator from '../utils/relationshipCalculator';
import { FamilyTree } from '../utils/FamilyTree';
import { useFamilyTreeLabels } from '../Contexts/FamilyTreeContext';

const Table = ({ columns, data, title }) => (
  <div className="bg-white rounded-lg shadow mb-6 p-4 md:p-6">
    <h3 className="text-base md:text-lg font-semibold mb-3 text-gray-800">{title}</h3>
    <div className="overflow-x-auto">
      <table className="min-w-full text-xs md:text-sm border">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th key={col.key} className="px-3 py-2 text-left border whitespace-nowrap">
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td className="px-3 py-2 border text-center text-gray-400 text-xs" colSpan={columns.length}>
                No data
              </td>
            </tr>
          ) : (
            data.map((row) => (
              <tr key={row.personId || row.id} className="hover:bg-gray-50">
                {columns.map((col) => (
                  <td key={col.key} className="px-3 py-2 border align-top">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  </div>
);

import { useUser } from '../Contexts/UserContext';

const MergeFamilyDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const requestId = Number(id);

  const { getLabel } = useFamilyTreeLabels();
  const { userInfo } = useUser();

  const {
    data: familyAResp,
    isLoading: loadingA,
    error: errorA,
  } = useQuery({
    queryKey: ['mergeFamilyA', requestId],
    queryFn: () => getMergeFamilyAPreview(requestId),
    enabled: !!requestId,
  });

  const {
    data: familyBResp,
    isLoading: loadingB,
    error: errorB,
  } = useQuery({
    queryKey: ['mergeFamilyB', requestId],
    queryFn: () => getMergeFamilyBPreview(requestId),
    enabled: !!requestId,
  });

  const { data: analysis, isLoading: loadingAnalysis, error: errorAnalysis } = useQuery({
    queryKey: ['mergeAnalysis', requestId],
    queryFn: () => getMergeAnalysis(requestId),
    enabled: !!requestId,
  });

  const { data: mergeState, isLoading: loadingState } = useQuery({
    queryKey: ['mergeState', requestId],
    queryFn: () => getMergeState(requestId),
    enabled: !!requestId,
  });

  const familyA = useMemo(
    () => (Array.isArray(familyAResp?.data) ? familyAResp.data : []),
    [familyAResp?.data]
  );
  const familyB = useMemo(
    () => (Array.isArray(familyBResp?.data) ? familyBResp.data : []),
    [familyBResp?.data]
  );

  const existingState = mergeState?.data?.state || null;

  const [matchRows, setMatchRows] = useState([]);
  const [newPersonRows, setNewPersonRows] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [executeMessage, setExecuteMessage] = useState('');
  const [executeError, setExecuteError] = useState(false);
  const [relationshipLabel, setRelationshipLabel] = useState('');
  const [familyARelationshipCodes, setFamilyARelationshipCodes] = useState({});
  const [familyBRelationshipCodes, setFamilyBRelationshipCodes] = useState({});

  const analysisData = analysis && analysis.data ? analysis.data : analysis || {};
  const crisis = analysisData?.crisisAnalysis || null;

  const primaryCode = analysisData?.primaryFamilyCode || familyAResp?.familyCode;
  const secondaryCode = analysisData?.secondaryFamilyCode || familyBResp?.familyCode;

  const isPrimarySide =
    !!userInfo?.familyCode &&
    !!primaryCode &&
    String(userInfo.familyCode).toUpperCase() === String(primaryCode).toUpperCase();

  const personColumnsA = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age', render: (row) => (row.age ?? '-') },
    { key: 'gender', label: 'Gender', render: (row) => row.gender || '-' },
    { key: 'generation', label: 'Generation', render: (row) => (row.generation ?? '-') },
    { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
    { key: 'email', label: 'Email', render: (row) => row.email || '-' },
    {
      key: 'relationship',
      label: 'Relationship',
      render: (row) => {
        const code = familyARelationshipCodes[row.personId] || row.relationship;
        if (!code) return '-';
        const label = getLabel ? getLabel(code) : code;
        return `${code} (${label})`;
      },
    },
    {
      key: 'associatedFamilyCodes',
      label: 'Associated Family Codes',
      render: (row) =>
        Array.isArray(row.associatedFamilyCodes) && row.associatedFamilyCodes.length > 0
          ? row.associatedFamilyCodes.join(', ')
          : '-',
    },
    {
      key: 'isAppUser',
      label: 'App User',
      render: (row) => (row.isAppUser ? 'Yes' : 'No'),
    },
  ];

  // Compute relationship codes for preview trees so we can show path labels in the Relationship column
  useEffect(() => {
    const buildRelationshipCodes = (people, setCodes) => {
      if (!Array.isArray(people) || people.length === 0) {
        setCodes({});
        return;
      }

      const tree = new FamilyTree();
      const personIdToTreeId = new Map();
      const treeIdToPersonId = new Map();

      // Add persons to tree
      people.forEach((p) => {
        if (!p || p.personId == null) return;
        const added = tree.addPerson({
          name: p.name,
          gender: p.gender,
          age: p.age,
          generation: typeof p.generation === 'number' ? p.generation : null,
          memberId: p.personId,
        });
        if (added) {
          personIdToTreeId.set(p.personId, added.id);
          treeIdToPersonId.set(added.id, p.personId);
        }
      });

      // Add relationships (parent-child, spouses)
      people.forEach((p) => {
        if (!p || p.personId == null) return;
        const fromTreeId = personIdToTreeId.get(p.personId);
        if (!fromTreeId) return;

        const parents = Array.isArray(p.parents) ? p.parents : [];
        parents.forEach((parentPersonId) => {
          const parentTreeId = personIdToTreeId.get(parentPersonId);
          if (parentTreeId) {
            tree.addRelation(parentTreeId, fromTreeId, 'parent-child');
          }
        });

        const spouses = Array.isArray(p.spouses) ? p.spouses : [];
        spouses.forEach((spousePersonId) => {
          const spouseTreeId = personIdToTreeId.get(spousePersonId);
          if (spouseTreeId) {
            tree.addRelation(fromTreeId, spouseTreeId, 'spouse');
          }
        });
      });

      // Prefer an admin person as root if available, otherwise use first-added root
      let rootId = tree.rootId;
      const adminPerson = people.find((p) => p && p.isAdmin && p.personId != null);
      if (adminPerson) {
        const adminTreeId = personIdToTreeId.get(adminPerson.personId);
        if (adminTreeId) {
          rootId = adminTreeId;
          tree.rootId = adminTreeId;
        }
      }
      if (!rootId) {
        setCodes({});
        return;
      }

      const calculator = new RelationshipCalculator(tree);
      const codes = {};

      tree.people.forEach((person) => {
        const previewPersonId = treeIdToPersonId.get(person.id);
        if (!previewPersonId) return;

        if (person.id === rootId) {
          codes[previewPersonId] = 'SELF';
        } else {
          const rel = calculator.calculateRelationship(rootId, person.id);
          if (rel && rel.relationshipCode) {
            codes[previewPersonId] = rel.relationshipCode;
          }
        }
      });

      setCodes(codes);
    };

    buildRelationshipCodes(familyA, setFamilyARelationshipCodes);
    buildRelationshipCodes(familyB, setFamilyBRelationshipCodes);
  }, [familyA, familyB]);

  const personColumnsB = [
    { key: 'name', label: 'Name' },
    { key: 'age', label: 'Age', render: (row) => (row.age ?? '-') },
    { key: 'gender', label: 'Gender', render: (row) => row.gender || '-' },
    { key: 'generation', label: 'Generation', render: (row) => (row.generation ?? '-') },
    { key: 'phone', label: 'Phone', render: (row) => row.phone || '-' },
    { key: 'email', label: 'Email', render: (row) => row.email || '-' },
    {
      key: 'relationship',
      label: 'Relationship',
      render: (row) => {
        const code = familyBRelationshipCodes[row.personId] || row.relationship;
        if (!code) return '-';
        const label = getLabel ? getLabel(code) : code;
        return `${code} (${label})`;
      },
    },
    {
      key: 'associatedFamilyCodes',
      label: 'Associated Family Codes',
      render: (row) =>
        Array.isArray(row.associatedFamilyCodes) && row.associatedFamilyCodes.length > 0
          ? row.associatedFamilyCodes.join(', ')
          : '-',
    },
    {
      key: 'isAppUser',
      label: 'App User',
      render: (row) => (row.isAppUser ? 'Yes' : 'No'),
    },
  ];

  useEffect(() => {
    const currentAnalysis = analysis && analysis.data ? analysis.data : analysis;
    if (!currentAnalysis) return;

    const decisions = existingState && existingState.decisions ? existingState.decisions : {};
    const matchDecisions = Array.isArray(decisions.matches) ? decisions.matches : [];
    const newPersonDecisions = Array.isArray(decisions.newPersons) ? decisions.newPersons : [];

    const matchDecisionMap = new Map();
    matchDecisions.forEach((d) => {
      if (d && d.primaryPersonId && d.secondaryPersonId) {
        matchDecisionMap.set(`${d.primaryPersonId}-${d.secondaryPersonId}`, d);
      }
    });

    const newDecisionMap = new Map();
    newPersonDecisions.forEach((d) => {
      if (d && d.personId) {
        newDecisionMap.set(d.personId, d);
      }
    });

    const updatedMatchRows = Array.isArray(currentAnalysis.matches)
      ? currentAnalysis.matches.map((m) => {
          const key = `${m.primary.personId}-${m.secondary.personId}`;
          const existing = matchDecisionMap.get(key);
          return {
            key,
            primary: m.primary,
            secondary: m.secondary,
            confidence: m.confidence,
            level: m.level,
            matchingFields: m.matchingFields,
            differingFields: m.differingFields,
            selected: false,
            decision: existing?.decision || 'approve',
            source: existing?.source || 'primary',
          };
        })
      : [];

    const updatedNewPersonRows = Array.isArray(currentAnalysis.newPersons)
      ? currentAnalysis.newPersons.map((p) => {
          const existing = newDecisionMap.get(p.personId);
          return {
            person: p,
            selected: false,
            decision: existing?.decision || 'approve',
            makeAdmin: existing?.makeAdmin || false,
          };
        })
      : [];

    setMatchRows(updatedMatchRows);
    setNewPersonRows(updatedNewPersonRows);

    const meta = existingState && existingState.meta ? existingState.meta : {};
    if (meta.relationshipLabel && typeof meta.relationshipLabel === 'string') {
      setRelationshipLabel(meta.relationshipLabel);
    }
  }, [analysis, existingState]);

  const renderConflicts = (list, title, color) => (
    <div className="bg-white rounded-lg shadow mb-6 p-4 md:p-6">
      <h3 className="text-base md:text-lg font-semibold mb-3" style={{ color }}>{title}</h3>
      {(!list || list.length === 0) ? (
        <p className="text-sm text-gray-400">No records.</p>
      ) : (
        <ul className="space-y-2 text-xs md:text-sm">
          {list.map((c, idx) => (
            <li key={idx} className="border-l-4 pl-2 md:pl-3" style={{ borderColor: color }}>
              <div className="font-semibold text-gray-800 text-xs md:text-sm">{c.type}</div>
              <div className="text-gray-600 text-xs md:text-sm">{c.description}</div>
              <div className="text-[11px] text-gray-500 mt-1">
                A: {c.primaryPersonId} | B: {c.secondaryPersonId}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const allMatchesSelected = matchRows.length > 0 && matchRows.every((r) => r.selected);
  const allNewSelected = newPersonRows.length > 0 && newPersonRows.every((r) => r.selected);

  const toggleSelectAllMatches = (checked) => {
    setMatchRows((rows) => rows.map((r) => ({ ...r, selected: checked })));
  };

  const toggleSelectAllNewPersons = (checked) => {
    setNewPersonRows((rows) => rows.map((r) => ({ ...r, selected: checked })));
  };

  const bulkUpdateMatches = (decision) => {
    setMatchRows((rows) => rows.map((r) => (r.selected ? { ...r, decision } : r)));
  };

  const bulkUpdateNewPersons = (decision) => {
    setNewPersonRows((rows) => rows.map((r) => (r.selected ? { ...r, decision } : r)));
  };

  const getHardConflictPersonIds = () => {
    const hardConflictIds = new Set();
    if (analysisData?.hardConflicts && Array.isArray(analysisData.hardConflicts)) {
      analysisData.hardConflicts.forEach((c) => {
        if (c.primaryPersonId) hardConflictIds.add(c.primaryPersonId);
        if (c.secondaryPersonId) hardConflictIds.add(c.secondaryPersonId);
      });
    }
    return hardConflictIds;
  };

  const hardConflictIds = getHardConflictPersonIds();

  const isMatchInHardConflict = (row) => {
    return hardConflictIds.has(row.primary.personId) || hardConflictIds.has(row.secondary.personId);
  };

  const getPreviewCounts = () => {
    const approvedMatches = matchRows.filter((r) => r.decision === 'approve').length;
    const approvedNewPersons = newPersonRows.filter((r) => r.decision === 'approve').length;
    const primaryCount = familyA.length;
    const finalCount = primaryCount + approvedNewPersons;
    return { primaryCount, approvedNewPersons, finalCount, approvedMatches };
  };

  const renderMatchesTable = () => {
    if (!analysisData?.matches || analysisData.matches.length === 0) {
      return <p className="text-sm text-gray-400">No matches found.</p>;
    }

    return (
      <>
        {isPrimarySide && (
          <div className="flex items-center justify-between mb-2 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Decisions:</span>
              <button
                type="button"
                className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs"
                onClick={() => bulkUpdateMatches('approve')}
              >
                Bulk Approve Selected
              </button>
              <button
                type="button"
                className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs"
                onClick={() => bulkUpdateMatches('reject')}
              >
                Bulk Reject Selected
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs md:text-sm border">
            <thead className="bg-gray-50">
              <tr>
                {isPrimarySide && (
                  <th className="px-2 py-2 border text-center">
                    <input
                      type="checkbox"
                      checked={allMatchesSelected}
                      onChange={(e) => toggleSelectAllMatches(e.target.checked)}
                    />
                  </th>
                )}
                <th className="px-3 py-2 border text-left">Family A (Primary)</th>
                <th className="px-3 py-2 border text-left">Family B (Secondary)</th>
                <th className="px-3 py-2 border text-left">Match Level</th>
                {isPrimarySide && (
                  <>
                    <th className="px-3 py-2 border text-left">Approve?</th>
                    <th className="px-3 py-2 border text-left">Preferred Version</th>
                    <th className="px-3 py-2 border text-left">Make Admin</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {matchRows.map((row, index) => {
                const inHardConflict = isMatchInHardConflict(row);
                return (
                <tr key={row.key} className={`hover:bg-gray-50 align-top ${inHardConflict ? 'bg-red-50' : ''}`}>
                  {isPrimarySide && (
                    <td className="px-2 py-2 border text-center">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setMatchRows((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, selected: checked } : r)),
                          );
                        }}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 border">
                    <div className="font-semibold text-gray-800 text-xs md:text-sm">{row.primary.name}</div>
                    <div className="text-[11px] text-gray-500">
                      Age: {row.primary.age ?? '-'} | Gender: {row.primary.gender || '-'} | Gen: {row.primary.generation ?? '-'}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Phone: {row.primary.phone || '-'} | Email: {row.primary.email || '-'}
                    </div>
                  </td>
                  <td className="px-3 py-2 border">
                    <div className="font-semibold text-gray-800 text-xs md:text-sm">{row.secondary.name}</div>
                    <div className="text-[11px] text-gray-500">
                      Age: {row.secondary.age ?? '-'} | Gender: {row.secondary.gender || '-'} | Gen: {row.secondary.generation ?? '-'}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Phone: {row.secondary.phone || '-'} | Email: {row.secondary.email || '-'}
                    </div>
                  </td>
                  <td className="px-3 py-2 border text-xs md:text-sm">
                    <div className="inline-flex items-center px-2 py-1 rounded-full bg-blue-50 text-blue-700 font-semibold text-[11px] mb-1">
                      {row.level?.toUpperCase() || 'UNKNOWN'} ({Math.round(row.confidence)}%)
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Matching: {row.matchingFields?.join(', ') || '-'}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      Differing: {row.differingFields?.join(', ') || '-'}
                    </div>
                  </td>
                  {isPrimarySide && (
                    <>
                      <td className="px-3 py-2 border text-xs md:text-sm">
                        <select
                          className="border rounded-md px-2 py-1 text-xs md:text-sm"
                          value={row.decision}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMatchRows((rows) =>
                              rows.map((r, i) => (i === index ? { ...r, decision: value } : r)),
                            );
                          }}
                        >
                          <option value="approve">Approve</option>
                          <option value="reject">Reject</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 border text-xs md:text-sm">
                        <select
                          className="border rounded-md px-2 py-1 text-xs md:text-sm"
                          value={row.source}
                          onChange={(e) => {
                            const value = e.target.value;
                            setMatchRows((rows) =>
                              rows.map((r, i) => (i === index ? { ...r, source: value } : r)),
                            );
                          }}
                        >
                          <option value="primary">Use Family A</option>
                          <option value="secondary">Use Family B</option>
                        </select>
                      </td>
                      <td className="px-3 py-2 border text-xs md:text-sm">
                        <label className="inline-flex items-center gap-1 text-[11px] text-gray-700">
                          <input
                            type="checkbox"
                            checked={row.makeAdmin || false}
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setMatchRows((rows) =>
                                rows.map((r, i) => (i === index ? { ...r, makeAdmin: checked } : r)),
                              );
                            }}
                          />
                          <span>Admin</span>
                        </label>
                        {inHardConflict && (
                          <div className="text-[10px] text-red-600 font-semibold mt-1">
                            ⚠️ Hard Conflict
                          </div>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const buildFinalTree = () => {
    if (!familyA || familyA.length === 0) {
      return { members: [] };
    }

    const primaryIdToFinal = new Map();
    const secondaryIdToFinal = new Map();
    let nextId = 1;

    familyA.forEach((p) => {
      if (p && p.personId != null && !primaryIdToFinal.has(p.personId)) {
        primaryIdToFinal.set(p.personId, nextId++);
      }
    });

    matchRows.forEach((row) => {
      if (!row || row.decision !== 'approve') return;
      const finalId = primaryIdToFinal.get(row.primary.personId);
      if (finalId != null) {
        secondaryIdToFinal.set(row.secondary.personId, finalId);
      }
    });

    newPersonRows.forEach((row) => {
      if (!row || row.decision !== 'approve') return;
      const pid = row.person.personId;
      if (!secondaryIdToFinal.has(pid)) {
        secondaryIdToFinal.set(pid, nextId++);
      }
    });

    const membersById = new Map();

    // Create members for all primary (Family A) persons
    familyA.forEach((a) => {
      const finalId = primaryIdToFinal.get(a.personId);
      if (!finalId) return;

      const matchRow = matchRows.find(
        (r) => r.primary && r.primary.personId === a.personId && r.decision === 'approve',
      );

      const useSecondary = matchRow && matchRow.source === 'secondary';
      const base = useSecondary ? matchRow.secondary : a;

      membersById.set(finalId, {
        id: finalId,
        base,
        primary: a,
        secondary: matchRow ? matchRow.secondary : null,
        parents: [],
        children: [],
        spouses: [],
        siblings: [],
        userId: base.userId || null,
        memberId: base.memberId || null,
        relationshipCode: base.relationshipCode || undefined,
        lifeStatus: base.lifeStatus || 'living',
      });
    });

    // Create members for approved new persons from Family B
    newPersonRows.forEach((row) => {
      if (!row || row.decision !== 'approve') return;
      const p = row.person;
      const finalId = secondaryIdToFinal.get(p.personId);
      if (!finalId || membersById.has(finalId)) return;

      membersById.set(finalId, {
        id: finalId,
        base: p,
        primary: null,
        secondary: p,
        parents: [],
        children: [],
        spouses: [],
        siblings: [],
        userId: p.userId || null,
        memberId: p.memberId || null,
        relationshipCode: p.relationshipCode || undefined,
        lifeStatus: p.lifeStatus || 'living',
      });
    });

    const addRel = (fromId, toId, field) => {
      if (!fromId || !toId || fromId === toId) return;
      const m = membersById.get(fromId);
      if (!m) return;
      m[field].push(toId);
    };

    // Map admin-to-admin relationshipLabel (Family B admin relative to Family A admin)
    const applyAdminRelationshipCode = (code, primaryFinalId, secondaryFinalId) => {
      if (!code || !primaryFinalId || !secondaryFinalId) return;

      const normalized = String(code).trim().toUpperCase();

      const addSymmetricSiblings = () => {
        addRel(primaryFinalId, secondaryFinalId, 'siblings');
        addRel(secondaryFinalId, primaryFinalId, 'siblings');
      };

      const addSpouses = () => {
        addRel(primaryFinalId, secondaryFinalId, 'spouses');
        addRel(secondaryFinalId, primaryFinalId, 'spouses');
      };

      // NOTE: Semantics: code describes Family B admin relative to Family A admin
      switch (normalized) {
        case 'SELF':
          // Already handled by match logic; no extra edges needed
          break;

        // B is Father / Mother of A
        case 'F':
        case 'M':
          addRel(primaryFinalId, secondaryFinalId, 'parents');   // A.parents includes B
          addRel(secondaryFinalId, primaryFinalId, 'children');  // B.children includes A
          break;

        // B is direct child of A (S = son, D = daughter). For SS/SD/DS/DD we approximate as descendant.
        case 'S':
        case 'D':
        case 'SS':
        case 'SD':
        case 'DS':
        case 'DD':
          addRel(primaryFinalId, secondaryFinalId, 'children');  // A.children includes B
          addRel(secondaryFinalId, primaryFinalId, 'parents');   // B.parents includes A
          break;

        // B is spouse of A (husband / wife)
        case 'H':
        case 'W':
          addSpouses();
          break;

        // B is sibling of A (elder/younger brother/sister)
        case 'B+':
        case 'B-':
        case 'Z+':
        case 'Z-':
          addSymmetricSiblings();
          break;

        default: {
          // For more complex paths (e.g. FB+S), we keep structure as-is but
          // attach the code to secondary admin for label purposes.
          const secondaryAdmin = membersById.get(secondaryFinalId);
          if (secondaryAdmin && !secondaryAdmin.relationshipCode) {
            secondaryAdmin.relationshipCode = normalized;
          }
          break;
        }
      }
    };

    // Relationships from Family A
    familyA.forEach((a) => {
      const fromId = primaryIdToFinal.get(a.personId);
      if (!fromId) return;
      const parents = Array.isArray(a.parents) ? a.parents : [];
      const children = Array.isArray(a.children) ? a.children : [];
      const spouses = Array.isArray(a.spouses) ? a.spouses : [];
      const siblings = Array.isArray(a.siblings) ? a.siblings : [];

      parents.forEach((pid) => {
        const toId = primaryIdToFinal.get(pid);
        if (toId) addRel(fromId, toId, 'parents');
      });
      children.forEach((cid) => {
        const toId = primaryIdToFinal.get(cid);
        if (toId) addRel(fromId, toId, 'children');
      });
      spouses.forEach((sid) => {
        const toId = primaryIdToFinal.get(sid);
        if (toId) addRel(fromId, toId, 'spouses');
      });
      siblings.forEach((sid) => {
        const toId = primaryIdToFinal.get(sid);
        if (toId) addRel(fromId, toId, 'siblings');
      });
    });

    // Relationships from Family B (only for persons included in final tree)
    familyB.forEach((b) => {
      const fromId = secondaryIdToFinal.get(b.personId);
      if (!fromId) return;
      const parents = Array.isArray(b.parents) ? b.parents : [];
      const children = Array.isArray(b.children) ? b.children : [];
      const spouses = Array.isArray(b.spouses) ? b.spouses : [];
      const siblings = Array.isArray(b.siblings) ? b.siblings : [];

      parents.forEach((pid) => {
        const toId = secondaryIdToFinal.get(pid);
        if (toId) addRel(fromId, toId, 'parents');
      });
      children.forEach((cid) => {
        const toId = secondaryIdToFinal.get(cid);
        if (toId) addRel(fromId, toId, 'children');
      });
      spouses.forEach((sid) => {
        const toId = secondaryIdToFinal.get(sid);
        if (toId) addRel(fromId, toId, 'spouses');
      });
      siblings.forEach((sid) => {
        const toId = secondaryIdToFinal.get(sid);
        if (toId) addRel(fromId, toId, 'siblings');
      });
    });

    // Apply relationship path between primary admin (Family A) and secondary admin (Family B)
    if (relationshipLabel) {
      const primaryAdmin = familyA.find((p) => p && p.isAdmin && p.personId != null);
      const secondaryAdmin = familyB.find((p) => p && p.isAdmin && p.personId != null);

      if (primaryAdmin && secondaryAdmin) {
        const primaryAdminId = primaryIdToFinal.get(primaryAdmin.personId);
        const secondaryAdminId = secondaryIdToFinal.get(secondaryAdmin.personId);

        if (primaryAdminId && secondaryAdminId) {
          applyAdminRelationshipCode(relationshipLabel, primaryAdminId, secondaryAdminId);
        }
      }
    }

    // Deduplicate relationship arrays and build final DTO list
    const members = Array.from(membersById.values()).map((m) => {
      const uniq = (arr) => Array.from(new Set(arr));
      return {
        id: m.id,
        name: m.base.name || 'Unknown',
        gender: m.base.gender || 'unknown',
        age: m.base.age,
        img: m.base.img,
        lifeStatus: m.lifeStatus || 'living',
        generation:
          typeof m.base.generation === 'number' ? m.base.generation : undefined,
        parents: uniq(m.parents),
        children: uniq(m.children),
        spouses: uniq(m.spouses),
        siblings: uniq(m.siblings),
        userId: m.userId || undefined,
        memberId: m.memberId || undefined,
        relationshipCode: m.relationshipCode || undefined,
      };
    });

    return { members };
  };

  const renderNewPersonsTable = () => {
    if (!analysisData?.newPersons || analysisData.newPersons.length === 0) {
      return <p className="text-sm text-gray-400">No new persons from Family B.</p>;
    }

    return (
      <>
        {isPrimarySide && (
          <div className="flex items-center justify-between mb-2 text-xs md:text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-600">Decisions:</span>
              <button
                type="button"
                className="px-2 py-1 bg-green-600 text-white rounded-md hover:bg-green-700 text-xs"
                onClick={() => bulkUpdateNewPersons('approve')}
              >
                Bulk Approve Selected
              </button>
              <button
                type="button"
                className="px-2 py-1 bg-red-600 text-white rounded-md hover:bg-red-700 text-xs"
                onClick={() => bulkUpdateNewPersons('reject')}
              >
                Bulk Reject Selected
              </button>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="min-w-full text-xs md:text-sm border">
            <thead className="bg-gray-50">
              <tr>
                {isPrimarySide && (
                  <th className="px-2 py-2 border text-center">
                    <input
                      type="checkbox"
                      checked={allNewSelected}
                      onChange={(e) => toggleSelectAllNewPersons(e.target.checked)}
                    />
                  </th>
                )}
                <th className="px-3 py-2 border text-left">Person (Family B)</th>
                <th className="px-3 py-2 border text-left">Contact & Codes</th>
                <th className="px-3 py-2 border text-left">App / Admin</th>
                {isPrimarySide && <th className="px-3 py-2 border text-left">Approve?</th>}
              </tr>
            </thead>
            <tbody>
              {newPersonRows.map((row, index) => (
                <tr key={row.person.personId} className="hover:bg-gray-50 align-top">
                  {isPrimarySide && (
                    <td className="px-2 py-2 border text-center">
                      <input
                        type="checkbox"
                        checked={row.selected}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setNewPersonRows((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, selected: checked } : r)),
                          );
                        }}
                      />
                    </td>
                  )}
                  <td className="px-3 py-2 border">
                    <div className="text-sm font-semibold text-gray-800 mb-1">{row.person.name}</div>
                    <div className="text-[11px] text-gray-500 mb-1">
                      Age: {row.person.age ?? '-'} | Gender: {row.person.gender || '-'} | Gen: {row.person.generation ?? '-'}
                    </div>
                  </td>
                  <td className="px-3 py-2 border">
                    <div className="text-[11px] text-gray-500 mb-1">
                      Phone: {row.person.phone || '-'} | Email: {row.person.email || '-'}
                    </div>
                    <div className="text-[11px] text-gray-500 mb-1">
                      Associated Codes:{' '}
                      {Array.isArray(row.person.associatedFamilyCodes) && row.person.associatedFamilyCodes.length > 0
                        ? row.person.associatedFamilyCodes.join(', ')
                        : '-'}
                    </div>
                  </td>
                  <td className="px-3 py-2 border text-xs md:text-sm">
                    <div className="text-[11px] text-gray-500 mb-1">
                      App User: {row.person.isAppUser ? 'Yes' : 'No'}
                    </div>
                    {isPrimarySide && (
                      <label className="inline-flex items-center gap-1 text-[11px] text-gray-700">
                        <input
                          type="checkbox"
                          checked={row.makeAdmin}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setNewPersonRows((rows) =>
                              rows.map((r, i) => (i === index ? { ...r, makeAdmin: checked } : r)),
                            );
                          }}
                        />
                        <span>Make Admin</span>
                      </label>
                    )}
                  </td>
                  {isPrimarySide && (
                    <td className="px-3 py-2 border text-xs md:text-sm">
                      <select
                        className="border rounded-md px-2 py-1 text-xs md:text-sm"
                        value={row.decision}
                        onChange={(e) => {
                          const value = e.target.value;
                          setNewPersonRows((rows) =>
                            rows.map((r, i) => (i === index ? { ...r, decision: value } : r)),
                          );
                        }}
                      >
                        <option value="approve">Approve</option>
                        <option value="reject">Reject</option>
                      </select>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  };

  const handleSaveDecisions = async () => {
    if (!requestId) return;
    setSaving(true);
    setSaveMessage('');
    setSaveError(false);

    try {
      const decisions = {
        matches: matchRows.map((row) => ({
          primaryPersonId: row.primary.personId,
          secondaryPersonId: row.secondary.personId,
          decision: row.decision,
          source: row.source,
        })),
        newPersons: newPersonRows.map((row) => ({
          personId: row.person.personId,
          decision: row.decision,
          makeAdmin: !!row.makeAdmin,
        })),
      };

      const finalTree = buildFinalTree();

      const promoteToAdmin = [
        ...newPersonRows
          .filter(
            (row) =>
              row.decision === 'approve' && row.makeAdmin &&
              row.person && typeof row.person.userId === 'number',
          )
          .map((row) => row.person.userId),
        ...matchRows
          .filter(
            (row) =>
              row.decision === 'approve' && row.makeAdmin &&
              row.primary && typeof row.primary.userId === 'number',
          )
          .map((row) => row.primary.userId),
      ];

      const payload = {
        decisions,
        finalTree,
        adminDecisions: {
          promoteToAdmin,
        },
        analysisSummary: {
          primaryFamilyCode: primaryCode,
          secondaryFamilyCode: secondaryCode,
          generationOffset: analysisData?.generationOffset || null,
        },
        meta: {
          ...(existingState && existingState.meta ? existingState.meta : {}),
          relationshipLabel: relationshipLabel || null,
        },
      };

      await saveMergeState(requestId, payload);
      setSaveMessage('Decisions saved successfully.');
      setSaveError(false);
    } catch (err) {
      setSaveMessage(err?.message || 'Failed to save decisions.');
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!requestId) return;
    const { primaryCount, approvedNewPersons, finalCount, approvedMatches } = getPreviewCounts();
    const confirmed = window.confirm(
      `Preview:\n` +
      `Primary Family: ${primaryCount} members\n` +
      `Approved Matches: ${approvedMatches}\n` +
      `Approved New Persons: ${approvedNewPersons}\n` +
      `Final Tree: ${finalCount} members\n\n` +
      `This will apply the final merged tree to the primary family and cannot be easily undone. Are you sure?`,
    );
    if (!confirmed) return;

    setExecuting(true);
    setExecuteMessage('');
    setExecuteError(false);

    try {
      await executeMerge(requestId);
      setExecuteMessage('Merge executed successfully.');
      setExecuteError(false);

      // After successful merge, navigate to the final merged family tree view
      if (primaryCode) {
        navigate(`/family-tree/${primaryCode}`);
      } else {
        navigate('/family-tree');
      }
    } catch (err) {
      setExecuteMessage(err?.message || 'Failed to execute merge.');
      setExecuteError(true);
    } finally {
      setExecuting(false);
    }
  };

  const loading = loadingA || loadingB || loadingAnalysis || loadingState;
  const error = errorA || errorB || errorAnalysis;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Merge Family Trees</h1>
          <p className="text-xs md:text-sm text-gray-500">
            Primary (Family A): <span className="font-semibold">{primaryCode || '-'}</span> | Secondary (Family B):{' '}
            <span className="font-semibold">{secondaryCode || '-'}</span>
          </p>
        </div>
        <button
          className="px-3 py-2 text-sm border rounded-md text-gray-600 hover:bg-gray-50"
          onClick={() => navigate('/merge-family')}
        >
          Back to Merge Requests
        </button>
      </div>

      {loading && <p className="text-sm text-gray-500 mb-4">Loading merge data...</p>}
      {error && <p className="text-sm text-red-600 mb-4">Error loading merge data.</p>}
      {!loading && crisis && Array.isArray(crisis.recommendations) && crisis.recommendations.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 text-xs md:text-sm rounded-md p-3 md:p-4 mb-4">
          <div className="font-semibold mb-1">Crisis & Risk Warnings</div>
          <ul className="list-disc list-inside space-y-1">
            {crisis.recommendations.map((rec, idx) => (
              <li key={idx}>
                <span className="font-semibold mr-1">[{rec.severity || rec.code}]</span>
                <span>{rec.message || rec.code}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Table
        title={`Family A Preview (${primaryCode || 'Primary'})`}
        columns={personColumnsA}
        data={familyA}
      />

      <Table
        title={`Family B Preview (${secondaryCode || 'Secondary'})`}
        columns={personColumnsB}
        data={familyB}
      />

      <div className="grid gap-6 md:grid-cols-2">
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-2 text-gray-800">Match Found (Duplicate Detection)</h2>
          {renderMatchesTable()}
        </div>
        <div className="bg-white rounded-lg shadow p-4 md:p-6">
          <h2 className="text-base md:text-lg font-semibold mb-2 text-gray-800">Generation Mapping</h2>
          {analysisData?.generationOffset ? (
            <div className="text-xs md:text-sm text-gray-700 space-y-3">
              <div>
                Suggested Offset:{' '}
                <span className="font-semibold">{analysisData.generationOffset.suggestedOffset ?? 'N/A'}</span>
              </div>
              <div>
                Distribution:
                <ul className="list-disc list-inside text-xs mt-1">
                  {analysisData.generationOffset.counts.map((c, idx) => (
                    <li key={idx}>
                      Offset {c.offset}: {c.count} match(es)
                    </li>
                  ))}
                </ul>
              </div>
              <div className="mt-2 pt-2 border-t border-gray-200">
                <label className="block text-[11px] md:text-xs font-semibold text-gray-700 mb-1">
                  Relationship path label between admins (Family B admin relative to Family A admin)
                </label>
                <select
                  className="w-full border rounded-md px-2 py-1 text-[11px] md:text-xs"
                  value={relationshipLabel}
                  onChange={(e) => setRelationshipLabel(e.target.value)}
                  disabled={!isPrimarySide}
                >
                  <option value="">Select relationship label (optional)</option>
                  <option value="SELF">SELF (same person)</option>
                  <option value="F">F (Father)</option>
                  <option value="M">M (Mother)</option>
                  <option value="B+">B+ (Elder Brother)</option>
                  <option value="B-">B- (Younger Brother)</option>
                  <option value="Z+">Z+ (Elder Sister)</option>
                  <option value="Z-">Z- (Younger Sister)</option>
                  <option value="H">H (Husband)</option>
                  <option value="W">W (Wife)</option>
                  <option value="FB+S">FB+S (Father's elder brother's son)</option>
                  <option value="FB-S">FB-S (Father's younger brother's son)</option>
                  <option value="FZ+S">FZ+S (Father's elder sister's son)</option>
                  <option value="FZ-S">FZ-S (Father's younger sister's son)</option>
                  <option value="SS">SS (Son's son)</option>
                  <option value="SD">SD (Son's daughter)</option>
                  <option value="DS">DS (Daughter's son)</option>
                  <option value="DD">DD (Daughter's daughter)</option>
                </select>
                <p className="mt-1 text-[10px] md:text-[11px] text-gray-500">
                  This label will be saved with merge state and can be used by backend crisis analysis to interpret
                  generation alignment and how to connect Family B branch into Family A.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">No generation mapping data.</p>
          )}
        </div>
      </div>

      {renderConflicts(analysisData?.hardConflicts || [], 'Hard Conflicts', '#dc2626')}
      {renderConflicts(analysisData?.softConflicts || [], 'Soft Conflicts', '#d97706')}

      <div className="bg-white rounded-lg shadow mb-6 p-4 md:p-6">
        <h2 className="text-base md:text-lg font-semibold mb-2 text-gray-800">New Persons (Family B only)</h2>
        {renderNewPersonsTable()}
      </div>

      <div className="mt-4 flex flex-col items-end gap-2">
        {saveMessage && (
          <span className={`text-xs md:text-sm ${saveError ? 'text-red-600' : 'text-green-600'}`}>
            {saveMessage}
          </span>
        )}
        {executeMessage && (
          <span className={`text-xs md:text-sm ${executeError ? 'text-red-600' : 'text-green-600'}`}>
            {executeMessage}
          </span>
        )}
      </div>

      {isPrimarySide && (
        <div className="mt-4 flex items-center justify-end gap-3">
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
            onClick={handleExecuteMerge}
            disabled={executing}
          >
            {executing ? 'Merging...' : 'Execute Final Merge'}
          </button>
          <button
            type="button"
            className="px-4 py-2 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            onClick={handleSaveDecisions}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Decisions'}
          </button>
        </div>
      )}
    </div>
  );
};

export default MergeFamilyDetailPage;
