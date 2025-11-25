import React, { useState } from 'react';
import './CrisisWarning.css';

export function CrisisWarning({ crisis, onDismiss }) {
  const [expanded, setExpanded] = useState(false);

  if (!crisis) {
    return null;
  }

  const getSeverityClass = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'severity-critical';
      case 'HIGH':
        return 'severity-high';
      case 'MEDIUM':
        return 'severity-medium';
      case 'LOW':
        return 'severity-low';
      default:
        return 'severity-unknown';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return '⚠️';
      case 'HIGH':
        return '⚠️';
      case 'MEDIUM':
        return 'ℹ️';
      case 'LOW':
        return 'ℹ️';
      default:
        return '❓';
    }
  };

  const getCrisisTypeLabel = (type) => {
    const labels = {
      'NO_MATCH_MERGE': 'No Match Merge',
      'GENERATION_MISMATCH': 'Generation Mismatch',
      'ORPHANED_PERSONS': 'Orphaned Persons',
      'CIRCULAR_RELATIONSHIPS': 'Circular Relationships',
      'RELATIONSHIP_ISSUES': 'Relationship Issues',
      'AGE_INCONSISTENCY': 'Age Inconsistency',
    };
    return labels[type] || type;
  };

  return (
    <div className={`crisis-warning ${getSeverityClass(crisis.severity)}`}>
      <div className="crisis-header">
        <span className="crisis-icon">{getSeverityIcon(crisis.severity)}</span>
        <div className="crisis-title-section">
          <h3 className="crisis-title">{getCrisisTypeLabel(crisis.type)}</h3>
          <span className="severity-badge">{crisis.severity}</span>
        </div>
        <button
          className="crisis-close"
          onClick={onDismiss}
          aria-label="Dismiss warning"
        >
          ✕
        </button>
      </div>

      <div className="crisis-message">
        <p>{crisis.message}</p>
      </div>

      {crisis.details && crisis.details.length > 0 && (
        <div className="crisis-details">
          <button
            className="details-toggle"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? '▼' : '▶'} Details ({crisis.details.length})
          </button>

          {expanded && (
            <div className="details-content">
              {crisis.details.map((detail, index) => (
                <div key={index} className="detail-item">
                  {typeof detail === 'string' ? (
                    <p>{detail}</p>
                  ) : (
                    <div>
                      <p className="detail-label">{detail.label || detail.type}</p>
                      <p className="detail-description">{detail.description || detail.message}</p>
                      {detail.severity && (
                        <span className={`detail-severity ${detail.severity.toLowerCase()}`}>
                          {detail.severity}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {crisis.action && (
        <div className="crisis-action">
          <p className="action-label">Recommended Action:</p>
          <p className="action-text">{crisis.action}</p>
        </div>
      )}

      {crisis.recommendations && crisis.recommendations.length > 0 && (
        <div className="crisis-recommendations">
          <p className="recommendations-label">Recommendations:</p>
          <ul className="recommendations-list">
            {crisis.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function CrisisWarningList({ crises, onDismiss }) {
  const [dismissed, setDismissed] = useState(new Set());

  const handleDismiss = (index) => {
    const newDismissed = new Set(dismissed);
    newDismissed.add(index);
    setDismissed(newDismissed);
    if (onDismiss) {
      onDismiss(index);
    }
  };

  if (!crises || crises.length === 0) {
    return null;
  }

  const visibleCrises = crises.filter((_, index) => !dismissed.has(index));

  if (visibleCrises.length === 0) {
    return null;
  }

  return (
    <div className="crisis-warning-list">
      <div className="crisis-list-header">
        <h2>⚠️ Issues Detected</h2>
        <p className="crisis-count">{visibleCrises.length} issue(s) found</p>
      </div>

      <div className="crisis-list-content">
        {visibleCrises.map((crisis, index) => (
          <CrisisWarning
            key={index}
            crisis={crisis}
            onDismiss={() => handleDismiss(crises.indexOf(crisis))}
          />
        ))}
      </div>
    </div>
  );
}

export default CrisisWarning;
