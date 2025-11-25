import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './MergeAnalysisScreen.css';

export function MergeAnalysisScreen({ mergeRequestId, token, onAnalysisComplete }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchAnalysis();
  }, [mergeRequestId]);

  const fetchAnalysis = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/analysis`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setAnalysis(response.data.data);
      setError(null);
      if (onAnalysisComplete) {
        onAnalysisComplete(response.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch analysis');
      console.error('Error fetching analysis:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="merge-analysis loading">
        <div className="spinner"></div>
        <p>Analyzing families...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="merge-analysis error">
        <div className="error-box">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchAnalysis}>Retry</button>
        </div>
      </div>
    );
  }

  if (!analysis) {
    return (
      <div className="merge-analysis empty">
        <p>No analysis available</p>
      </div>
    );
  }

  const stats = {
    matches: analysis.matches?.length || 0,
    hardConflicts: analysis.hardConflicts?.length || 0,
    softConflicts: analysis.softConflicts?.length || 0,
    newPersons: analysis.newPersons?.length || 0,
  };

  return (
    <div className="merge-analysis">
      <div className="analysis-header">
        <h2>Merge Analysis</h2>
        <p className="subtitle">
          {analysis.primaryFamilyCode} ↔ {analysis.secondaryFamilyCode}
        </p>
      </div>

      {/* Statistics */}
      <div className="analysis-stats">
        <div className="stat-card matches">
          <div className="stat-icon">✓</div>
          <div className="stat-content">
            <div className="stat-number">{stats.matches}</div>
            <div className="stat-label">Matches</div>
          </div>
        </div>

        <div className="stat-card hard-conflicts">
          <div className="stat-icon">⚠</div>
          <div className="stat-content">
            <div className="stat-number">{stats.hardConflicts}</div>
            <div className="stat-label">Hard Conflicts</div>
          </div>
        </div>

        <div className="stat-card soft-conflicts">
          <div className="stat-icon">ℹ</div>
          <div className="stat-content">
            <div className="stat-number">{stats.softConflicts}</div>
            <div className="stat-label">Soft Conflicts</div>
          </div>
        </div>

        <div className="stat-card new-persons">
          <div className="stat-icon">+</div>
          <div className="stat-content">
            <div className="stat-number">{stats.newPersons}</div>
            <div className="stat-label">New Persons</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="analysis-tabs">
        <button
          className={`tab ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button
          className={`tab ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          Matches ({stats.matches})
        </button>
        <button
          className={`tab ${activeTab === 'conflicts' ? 'active' : ''}`}
          onClick={() => setActiveTab('conflicts')}
        >
          Conflicts ({stats.hardConflicts + stats.softConflicts})
        </button>
        <button
          className={`tab ${activeTab === 'new' ? 'active' : ''}`}
          onClick={() => setActiveTab('new')}
        >
          New ({stats.newPersons})
        </button>
      </div>

      {/* Content */}
      <div className="analysis-content">
        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <div className="tab-content">
            <div className="overview-section">
              <h3>Generation Offset</h3>
              <div className="offset-info">
                <p>
                  <strong>Suggested Offset:</strong>{' '}
                  {analysis.generationOffset?.suggestedOffset || 0}
                </p>
                <p className="offset-description">
                  {analysis.generationOffset?.suggestedOffset === 0
                    ? 'Generations are already aligned'
                    : `Family B should be shifted by ${analysis.generationOffset?.suggestedOffset} generation(s)`}
                </p>
              </div>
            </div>

            <div className="overview-section">
              <h3>Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="label">Total Matches:</span>
                  <span className="value">{stats.matches}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Hard Conflicts:</span>
                  <span className="value">{stats.hardConflicts}</span>
                </div>
                <div className="summary-item">
                  <span className="label">Soft Conflicts:</span>
                  <span className="value">{stats.softConflicts}</span>
                </div>
                <div className="summary-item">
                  <span className="label">New Persons:</span>
                  <span className="value">{stats.newPersons}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Matches Tab */}
        {activeTab === 'matches' && (
          <div className="tab-content">
            {analysis.matches && analysis.matches.length > 0 ? (
              <div className="matches-list">
                {analysis.matches.map((match, index) => (
                  <div key={index} className="match-card">
                    <div className="match-header">
                      <span className="match-badge">Match {index + 1}</span>
                      <span className={`confidence confidence-${Math.round(match.confidence / 20)}`}>
                        {match.confidence}% - {match.level}
                      </span>
                    </div>
                    <div className="match-persons">
                      <div className="person">
                        <p className="name">{match.primary.name}</p>
                        <p className="details">
                          Age: {match.primary.age || '-'} | Gen: {match.primary.generation || '-'}
                        </p>
                      </div>
                      <div className="match-arrow">↔</div>
                      <div className="person">
                        <p className="name">{match.secondary.name}</p>
                        <p className="details">
                          Age: {match.secondary.age || '-'} | Gen: {match.secondary.generation || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="match-fields">
                      <div className="fields-group">
                        <span className="fields-label">Matching:</span>
                        <div className="fields">
                          {match.matchingFields.map((field, i) => (
                            <span key={i} className="field matching">
                              {field}
                            </span>
                          ))}
                        </div>
                      </div>
                      {match.differingFields.length > 0 && (
                        <div className="fields-group">
                          <span className="fields-label">Differing:</span>
                          <div className="fields">
                            {match.differingFields.map((field, i) => (
                              <span key={i} className="field differing">
                                {field}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-message">No matches found</div>
            )}
          </div>
        )}

        {/* Conflicts Tab */}
        {activeTab === 'conflicts' && (
          <div className="tab-content">
            {(analysis.hardConflicts?.length > 0 || analysis.softConflicts?.length > 0) ? (
              <div className="conflicts-list">
                {/* Hard Conflicts */}
                {analysis.hardConflicts?.length > 0 && (
                  <div className="conflicts-section">
                    <h4 className="section-title hard">⚠ Hard Conflicts ({analysis.hardConflicts.length})</h4>
                    {analysis.hardConflicts.map((conflict, index) => (
                      <div key={index} className="conflict-card hard">
                        <p className="conflict-type">{conflict.type}</p>
                        <p className="conflict-description">{conflict.description}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Soft Conflicts */}
                {analysis.softConflicts?.length > 0 && (
                  <div className="conflicts-section">
                    <h4 className="section-title soft">ℹ Soft Conflicts ({analysis.softConflicts.length})</h4>
                    {analysis.softConflicts.map((conflict, index) => (
                      <div key={index} className="conflict-card soft">
                        <p className="conflict-type">{conflict.type}</p>
                        <p className="conflict-description">{conflict.description}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="empty-message">No conflicts found</div>
            )}
          </div>
        )}

        {/* New Persons Tab */}
        {activeTab === 'new' && (
          <div className="tab-content">
            {analysis.newPersons && analysis.newPersons.length > 0 ? (
              <div className="new-persons-list">
                {analysis.newPersons.map((person, index) => (
                  <div key={index} className="new-person-card">
                    <div className="person-header">
                      <p className="name">{person.name}</p>
                      <span className="badge">New</span>
                    </div>
                    <div className="person-details">
                      <div className="detail">
                        <span className="label">Age:</span>
                        <span className="value">{person.age || '-'}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Gender:</span>
                        <span className="value">{person.gender || '-'}</span>
                      </div>
                      <div className="detail">
                        <span className="label">Generation:</span>
                        <span className="value">{person.generation !== null ? person.generation : '-'}</span>
                      </div>
                      <div className="detail">
                        <span className="label">App User:</span>
                        <span className={`value ${person.isAppUser ? 'yes' : 'no'}`}>
                          {person.isAppUser ? 'Yes' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-message">No new persons</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default MergeAnalysisScreen;
