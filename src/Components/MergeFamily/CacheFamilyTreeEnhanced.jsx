import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './CacheFamilyTree.css';

export function CacheFamilyTreeEnhanced({ mergeRequestId, token, onSaveSuccess }) {
  const [cache, setCache] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedState, setEditedState] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState(new Set());
  const [bulkApproveMode, setBulkApproveMode] = useState(false);
  const [filterType, setFilterType] = useState('all'); // all, matches, new, conflicts
  const [personWiseView, setPersonWiseView] = useState(false);

  useEffect(() => {
    fetchCacheState();
    fetchHistory();
  }, [mergeRequestId]);

  const fetchCacheState = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/state`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setCache(response.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch cache');
      console.error('Error fetching cache:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/state/history`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setHistory(response.data.data);
    } catch (err) {
      console.error('Error fetching history:', err);
    }
  };

  const handleSaveCache = async () => {
    try {
      setSaving(true);
      const payload = editedState || cache.state || {};

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/state`,
        payload,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCache(response.data.data);
      setEditMode(false);
      setEditedState(null);
      setError(null);

      if (onSaveSuccess) {
        onSaveSuccess(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save cache');
      console.error('Error saving cache:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkApprove = async () => {
    try {
      setSaving(true);
      const selectedArray = Array.from(selectedMembers);

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/state/edit`,
        {
          changes: {
            approvedMembers: selectedArray,
            approvalTimestamp: new Date().toISOString()
          },
          description: `Bulk approved ${selectedArray.length} members`
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCache(response.data.data);
      setSelectedMembers(new Set());
      setBulkApproveMode(false);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to bulk approve');
      console.error('Error bulk approving:', err);
    } finally {
      setSaving(false);
    }
  };

  const toggleMemberSelection = (memberId) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(memberId)) {
      newSelected.delete(memberId);
    } else {
      newSelected.add(memberId);
    }
    setSelectedMembers(newSelected);
  };

  const selectAllMembers = () => {
    const state = cache?.state || {};
    const members = state.finalTree?.members || [];
    if (selectedMembers.size === members.length) {
      setSelectedMembers(new Set());
    } else {
      setSelectedMembers(new Set(members.map(m => m.id)));
    }
  };

  if (loading) {
    return (
      <div className="cache-family-tree loading">
        <div className="spinner"></div>
        <p>Loading cache...</p>
      </div>
    );
  }

  if (error && !cache) {
    return (
      <div className="cache-family-tree error">
        <div className="error-box">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchCacheState}>Retry</button>
        </div>
      </div>
    );
  }

  const state = cache?.state || {};
  const finalTree = state.finalTree || {};
  const decisions = state.decisions || {};
  const members = finalTree.members || [];

  // Filter members based on type
  const getFilteredMembers = () => {
    if (filterType === 'all') return members;
    if (filterType === 'matches') {
      const matchIds = decisions.matches?.map(m => m.personIdA) || [];
      return members.filter(m => matchIds.includes(m.id));
    }
    if (filterType === 'new') {
      const newIds = decisions.newPersons?.map(p => p.personId) || [];
      return members.filter(m => newIds.includes(m.id));
    }
    return members;
  };

  const filteredMembers = getFilteredMembers();

  return (
    <div className="cache-family-tree">
      <div className="cache-header">
        <h2>Cache Family Tree</h2>
        <p className="subtitle">Final merged family tree structure</p>
      </div>

      {error && (
        <div className="alert alert-error">
          <span className="alert-icon">✕</span>
          <span>{error}</span>
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="view-mode-toggle">
        <button
          className={`toggle-btn ${!personWiseView ? 'active' : ''}`}
          onClick={() => setPersonWiseView(false)}
        >
          📋 Table View
        </button>
        <button
          className={`toggle-btn ${personWiseView ? 'active' : ''}`}
          onClick={() => setPersonWiseView(true)}
        >
          👤 Person-wise View
        </button>
      </div>

      {/* Cache Info */}
      <div className="cache-info">
        <div className="info-card">
          <h3>Cache Status</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Total Members:</span>
              <span className="value">{members.length}</span>
            </div>
            <div className="info-item">
              <span className="label">Matches Approved:</span>
              <span className="value">{decisions.matches?.length || 0}</span>
            </div>
            <div className="info-item">
              <span className="label">New Persons Added:</span>
              <span className="value">{decisions.newPersons?.length || 0}</span>
            </div>
            <div className="info-item">
              <span className="label">Admin Promotions:</span>
              <span className="value">{decisions.adminPromotions?.length || 0}</span>
            </div>
          </div>
        </div>

        <div className="info-card">
          <h3>Last Updated</h3>
          <p className="timestamp">
            {state.meta?.lastUpdatedAt
              ? new Date(state.meta.lastUpdatedAt).toLocaleString()
              : 'Not yet saved'}
          </p>
          <p className="updated-by">
            Updated by: {state.meta?.lastUpdatedBy || 'N/A'}
          </p>
        </div>
      </div>

      {/* Filter & Bulk Actions */}
      <div className="filter-section">
        <div className="filter-controls">
          <label>Filter by Type:</label>
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)}>
            <option value="all">All Members ({members.length})</option>
            <option value="matches">Matches ({decisions.matches?.length || 0})</option>
            <option value="new">New Persons ({decisions.newPersons?.length || 0})</option>
          </select>
        </div>

        {bulkApproveMode && (
          <div className="bulk-actions">
            <button
              className="btn btn-sm"
              onClick={selectAllMembers}
            >
              {selectedMembers.size === filteredMembers.length ? 'Deselect All' : 'Select All'}
            </button>
            <span className="selection-count">
              {selectedMembers.size} selected
            </span>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleBulkApprove}
              disabled={selectedMembers.size === 0 || saving}
            >
              {saving ? 'Approving...' : `Approve ${selectedMembers.size}`}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setBulkApproveMode(false);
                setSelectedMembers(new Set());
              }}
            >
              Cancel
            </button>
          </div>
        )}

        <button
          className={`btn ${bulkApproveMode ? 'btn-secondary' : 'btn-primary'}`}
          onClick={() => setBulkApproveMode(!bulkApproveMode)}
        >
          {bulkApproveMode ? 'Cancel Bulk Approve' : 'Bulk Approve'}
        </button>
      </div>

      {/* Person-wise View */}
      {personWiseView ? (
        <div className="person-wise-view">
          <h3>Person-wise Details</h3>
          <div className="person-cards">
            {filteredMembers.map((member) => (
              <div
                key={member.id}
                className={`person-card ${selectedMembers.has(member.id) ? 'selected' : ''}`}
                onClick={() => bulkApproveMode && toggleMemberSelection(member.id)}
              >
                {bulkApproveMode && (
                  <input
                    type="checkbox"
                    checked={selectedMembers.has(member.id)}
                    onChange={() => toggleMemberSelection(member.id)}
                    className="person-checkbox"
                  />
                )}

                <div className="person-header">
                  <h4>{member.name}</h4>
                  <span className="person-id">ID: {member.id}</span>
                </div>

                <div className="person-details">
                  <div className="detail-row">
                    <span className="label">Age:</span>
                    <span className="value">{member.age || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Gender:</span>
                    <span className="value">{member.gender || '-'}</span>
                  </div>
                  <div className="detail-row">
                    <span className="label">Generation:</span>
                    <span className="value">{member.generation !== null ? member.generation : '-'}</span>
                  </div>
                </div>

                <div className="relations-section">
                  <h5>Relations</h5>
                  {Array.isArray(member.parents) && member.parents.length > 0 && (
                    <div className="relation-group">
                      <span className="relation-label">Parents:</span>
                      <div className="relation-list">
                        {member.parents.map((parentId, idx) => (
                          <span key={idx} className="relation-tag">
                            {members.find(m => m.id === parentId)?.name || `Person ${parentId}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(member.children) && member.children.length > 0 && (
                    <div className="relation-group">
                      <span className="relation-label">Children:</span>
                      <div className="relation-list">
                        {member.children.map((childId, idx) => (
                          <span key={idx} className="relation-tag">
                            {members.find(m => m.id === childId)?.name || `Person ${childId}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(member.spouses) && member.spouses.length > 0 && (
                    <div className="relation-group">
                      <span className="relation-label">Spouses:</span>
                      <div className="relation-list">
                        {member.spouses.map((spouseId, idx) => (
                          <span key={idx} className="relation-tag">
                            {members.find(m => m.id === spouseId)?.name || `Person ${spouseId}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {Array.isArray(member.siblings) && member.siblings.length > 0 && (
                    <div className="relation-group">
                      <span className="relation-label">Siblings:</span>
                      <div className="relation-list">
                        {member.siblings.map((siblingId, idx) => (
                          <span key={idx} className="relation-tag">
                            {members.find(m => m.id === siblingId)?.name || `Person ${siblingId}`}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        /* Table View */
        <div className="members-preview">
          <div className="preview-header">
            <h3>Family Members ({filteredMembers.length})</h3>
            <button
              className="btn btn-sm"
              onClick={() => setShowHistory(!showHistory)}
            >
              {showHistory ? 'Hide' : 'Show'} History
            </button>
          </div>

          {filteredMembers.length > 0 ? (
            <div className="members-table-wrapper">
              <table className="members-table">
                <thead>
                  <tr>
                    {bulkApproveMode && <th><input type="checkbox" onChange={selectAllMembers} /></th>}
                    <th>ID</th>
                    <th>Name</th>
                    <th>Age</th>
                    <th>Gender</th>
                    <th>Generation</th>
                    <th>Parents</th>
                    <th>Children</th>
                    <th>Spouses</th>
                    <th>Siblings</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr
                      key={member.id}
                      className={selectedMembers.has(member.id) ? 'selected' : ''}
                      onClick={() => bulkApproveMode && toggleMemberSelection(member.id)}
                    >
                      {bulkApproveMode && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedMembers.has(member.id)}
                            onChange={() => toggleMemberSelection(member.id)}
                          />
                        </td>
                      )}
                      <td>{member.id}</td>
                      <td className="name">{member.name}</td>
                      <td>{member.age || '-'}</td>
                      <td>{member.gender || '-'}</td>
                      <td>{member.generation !== null ? member.generation : '-'}</td>
                      <td className="array-cell">
                        {Array.isArray(member.parents) && member.parents.length > 0
                          ? member.parents.join(', ')
                          : '-'}
                      </td>
                      <td className="array-cell">
                        {Array.isArray(member.children) && member.children.length > 0
                          ? member.children.join(', ')
                          : '-'}
                      </td>
                      <td className="array-cell">
                        {Array.isArray(member.spouses) && member.spouses.length > 0
                          ? member.spouses.join(', ')
                          : '-'}
                      </td>
                      <td className="array-cell">
                        {Array.isArray(member.siblings) && member.siblings.length > 0
                          ? member.siblings.join(', ')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-message">No members in cache</div>
          )}
        </div>
      )}

      {/* History Section */}
      {showHistory && (
        <div className="history-section">
          <h3>Edit History</h3>
          {history.length > 0 ? (
            <div className="history-list">
              {history.map((entry, index) => (
                <div key={index} className="history-item">
                  <div className="history-header">
                    <span className="action">{entry.action}</span>
                    <span className="timestamp">
                      {new Date(entry.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className="history-details">
                    {entry.changes && (
                      <pre className="changes-json">
                        {JSON.stringify(entry.changes, null, 2)}
                      </pre>
                    )}
                  </div>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      // handleRevert(index);
                    }}
                    disabled={saving}
                  >
                    Revert to this version
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <p className="empty-message">No history available</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="cache-actions">
        <button
          className="btn btn-primary"
          onClick={() => setEditMode(!editMode)}
          disabled={saving}
        >
          {editMode ? 'Cancel Edit' : 'Edit Cache'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={fetchCacheState}
          disabled={saving}
        >
          Refresh
        </button>
        <button
          className="btn btn-success"
          onClick={handleSaveCache}
          disabled={saving || !editMode}
        >
          {saving ? 'Saving...' : 'Save Cache'}
        </button>
      </div>

      {/* Info Box */}
      <div className="info-box">
        <h4>About Cache</h4>
        <ul>
          <li>✓ Person-wise view shows detailed relations for each member</li>
          <li>✓ Bulk approve section allows selecting multiple members</li>
          <li>✓ Relations are now properly displayed with member names</li>
          <li>✓ Filter by type to view specific member categories</li>
          <li>✓ Edit history is tracked for audit purposes</li>
        </ul>
      </div>
    </div>
  );
}

export default CacheFamilyTreeEnhanced;
