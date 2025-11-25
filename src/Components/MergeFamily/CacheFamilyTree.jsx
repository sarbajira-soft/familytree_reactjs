import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './CacheFamilyTree.css';

export function CacheFamilyTree({ mergeRequestId, token, onSaveSuccess }) {
  const [cache, setCache] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedState, setEditedState] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

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

  const handleEditState = async (changes) => {
    try {
      setSaving(true);
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/state/edit`,
        {
          changes,
          description: 'Manual edit'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCache(response.data.data);
      setEditedState(null);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to edit cache');
      console.error('Error editing cache:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleRevert = async (targetVersion) => {
    try {
      setSaving(true);
      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/state/revert`,
        {
          targetVersion,
          reason: 'User reverted changes'
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setCache(response.data.data);
      setShowHistory(false);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to revert cache');
      console.error('Error reverting cache:', err);
    } finally {
      setSaving(false);
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

      {/* Members Preview */}
      <div className="members-preview">
        <div className="preview-header">
          <h3>Family Members ({members.length})</h3>
          <button
            className="btn btn-sm"
            onClick={() => setShowHistory(!showHistory)}
          >
            {showHistory ? 'Hide' : 'Show'} History
          </button>
        </div>

        {members.length > 0 ? (
          <div className="members-table-wrapper">
            <table className="members-table">
              <thead>
                <tr>
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
                {members.map((member, index) => (
                  <tr key={index}>
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
                    onClick={() => handleRevert(index)}
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

      {/* Decisions Summary */}
      <div className="decisions-section">
        <h3>Merge Decisions</h3>
        <div className="decisions-grid">
          <div className="decision-card">
            <h4>Matches</h4>
            {decisions.matches && decisions.matches.length > 0 ? (
              <ul className="decision-list">
                {decisions.matches.slice(0, 5).map((match, index) => (
                  <li key={index}>
                    Person {match.personIdA} ↔ {match.personIdB}
                    {match.decision && (
                      <span className={`badge ${match.decision}`}>
                        {match.decision}
                      </span>
                    )}
                  </li>
                ))}
                {decisions.matches.length > 5 && (
                  <li className="more">+{decisions.matches.length - 5} more</li>
                )}
              </ul>
            ) : (
              <p className="empty">No matches</p>
            )}
          </div>

          <div className="decision-card">
            <h4>New Persons</h4>
            {decisions.newPersons && decisions.newPersons.length > 0 ? (
              <ul className="decision-list">
                {decisions.newPersons.slice(0, 5).map((person, index) => (
                  <li key={index}>
                    Person {person.personId}
                    {person.decision && (
                      <span className={`badge ${person.decision}`}>
                        {person.decision}
                      </span>
                    )}
                  </li>
                ))}
                {decisions.newPersons.length > 5 && (
                  <li className="more">+{decisions.newPersons.length - 5} more</li>
                )}
              </ul>
            ) : (
              <p className="empty">No new persons</p>
            )}
          </div>

          <div className="decision-card">
            <h4>Admin Promotions</h4>
            {decisions.adminPromotions && decisions.adminPromotions.length > 0 ? (
              <ul className="decision-list">
                {decisions.adminPromotions.slice(0, 5).map((admin, index) => (
                  <li key={index}>
                    User {admin.userId}
                    {admin.decision && (
                      <span className={`badge ${admin.decision}`}>
                        {admin.decision}
                      </span>
                    )}
                  </li>
                ))}
                {decisions.adminPromotions.length > 5 && (
                  <li className="more">+{decisions.adminPromotions.length - 5} more</li>
                )}
              </ul>
            ) : (
              <p className="empty">No promotions</p>
            )}
          </div>
        </div>
      </div>

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

      {/* Edit Mode */}
      {editMode && (
        <div className="edit-section">
          <h3>Edit Cache</h3>
          <div className="edit-form">
            <label>Final Tree JSON</label>
            <textarea
              className="json-editor"
              value={JSON.stringify(editedState || state, null, 2)}
              onChange={(e) => {
                try {
                  setEditedState(JSON.parse(e.target.value));
                } catch (err) {
                  // Invalid JSON, ignore
                }
              }}
              rows="10"
            />
            <div className="edit-actions">
              <button
                className="btn btn-primary"
                onClick={handleSaveCache}
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setEditMode(false);
                  setEditedState(null);
                }}
                disabled={saving}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="info-box">
        <h4>About Cache</h4>
        <ul>
          <li>✓ Cache stores the final merged family tree structure</li>
          <li>✓ All decisions (matches, new persons, admin promotions) are saved</li>
          <li>✓ You can edit the cache before executing the final merge</li>
          <li>✓ Edit history is tracked for audit purposes</li>
          <li>✓ You can revert to any previous version</li>
        </ul>
      </div>
    </div>
  );
}

export default CacheFamilyTree;
