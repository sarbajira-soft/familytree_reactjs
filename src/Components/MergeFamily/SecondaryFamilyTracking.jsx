import React, { useEffect, useState } from 'react';
import axios from 'axios';
import './SecondaryFamilyTracking.css';

export function SecondaryFamilyTracking({ mergeRequestId, token }) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchTracking();
  }, [mergeRequestId]);

  const fetchTracking = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/secondary-tracking`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      setTracking(response.data.data);
      setError(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch tracking');
      console.error('Error fetching tracking:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="secondary-tracking loading">
        <div className="spinner"></div>
        <p>Loading tracking information...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="secondary-tracking error">
        <div className="error-message">
          <h3>Error</h3>
          <p>{error}</p>
          <button onClick={fetchTracking}>Retry</button>
        </div>
      </div>
    );
  }

  if (!tracking) {
    return (
      <div className="secondary-tracking empty">
        <p>No tracking information available</p>
      </div>
    );
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'PENDING_PRIMARY_DECISION':
        return 'status-pending';
      case 'ACCEPTED_WAITING_EXECUTION':
        return 'status-accepted';
      case 'REJECTED_BY_PRIMARY':
        return 'status-rejected';
      case 'MERGED_COMPLETED':
        return 'status-merged';
      default:
        return 'status-unknown';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'PENDING_PRIMARY_DECISION':
        return 'Pending Primary Decision';
      case 'ACCEPTED_WAITING_EXECUTION':
        return 'Accepted - Waiting Execution';
      case 'REJECTED_BY_PRIMARY':
        return 'Rejected by Primary';
      case 'MERGED_COMPLETED':
        return 'Merge Completed';
      default:
        return 'Unknown Status';
    }
  };

  return (
    <div className="secondary-tracking">
      <div className="tracking-header">
        <h2>Merge Request Tracking</h2>
        <p className="request-id">Request ID: {tracking.mergeRequestId}</p>
      </div>

      <div className="tracking-content">
        {/* Status Section */}
        <div className="status-section">
          <h3>Request Status</h3>
          <div className="status-grid">
            <div className="status-item">
              <label>Primary Status:</label>
              <span className={`badge ${tracking.primaryStatus}`}>
                {tracking.primaryStatus}
              </span>
            </div>
            <div className="status-item">
              <label>Secondary Status:</label>
              <span className={`badge ${tracking.secondaryStatus}`}>
                {tracking.secondaryStatus}
              </span>
            </div>
            <div className="status-item">
              <label>Current Status:</label>
              <span className={`badge ${getStatusColor(tracking.trackingStatus)}`}>
                {getStatusLabel(tracking.trackingStatus)}
              </span>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="timeline-section">
          <h3>Timeline</h3>
          <div className="timeline">
            <div className="timeline-item completed">
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <p className="timeline-label">Created</p>
                <p className="timeline-date">
                  {new Date(tracking.createdAt).toLocaleString()}
                </p>
              </div>
            </div>

            {tracking.primaryStatus !== 'open' && (
              <div className={`timeline-item ${tracking.primaryStatus !== 'rejected' ? 'completed' : 'rejected'}`}>
                <div className="timeline-marker"></div>
                <div className="timeline-content">
                  <p className="timeline-label">
                    {tracking.primaryStatus === 'rejected' ? 'Rejected' : 'Accepted'}
                  </p>
                  <p className="timeline-date">
                    {new Date(tracking.acceptedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {tracking.primaryStatus === 'merged' && (
              <div className="timeline-item completed">
                <div className="timeline-marker"></div>
                <div className="timeline-content">
                  <p className="timeline-label">Merged</p>
                  <p className="timeline-date">
                    {new Date(tracking.acceptedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}

            {tracking.primaryStatus === 'accepted' && (
              <div className="timeline-item pending">
                <div className="timeline-marker"></div>
                <div className="timeline-content">
                  <p className="timeline-label">Pending Merge Execution</p>
                  <p className="timeline-date">Waiting for primary admin...</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Family Members Section */}
        <div className="members-section">
          <h3>Your Family Members ({tracking.totalMembers})</h3>
          <div className="members-table-wrapper">
            <table className="members-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Age</th>
                  <th>Gender</th>
                  <th>Generation</th>
                  <th>Phone</th>
                  <th>Email</th>
                  <th>App User</th>
                </tr>
              </thead>
              <tbody>
                {tracking.secondaryMembers && tracking.secondaryMembers.length > 0 ? (
                  tracking.secondaryMembers.map((member) => (
                    <tr key={member.personId}>
                      <td className="name">{member.name}</td>
                      <td>{member.age || '-'}</td>
                      <td>{member.gender || '-'}</td>
                      <td>{member.generation !== null ? member.generation : '-'}</td>
                      <td>{member.phone || '-'}</td>
                      <td className="email">{member.email || '-'}</td>
                      <td>
                        <span className={`badge ${member.isAppUser ? 'yes' : 'no'}`}>
                          {member.isAppUser ? 'Yes' : 'No'}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="empty-message">
                      No family members found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* No Match Merge Info */}
        {tracking.isNoMatchMerge && (
          <div className="no-match-section">
            <h3>⚠️ No Match Merge</h3>
            <div className="info-box">
              <p>No duplicate persons found between families.</p>
              <p>All your family members will be added to the primary family.</p>
              {tracking.appliedGenerationOffset && (
                <p>
                  <strong>Generation offset applied:</strong> {tracking.appliedGenerationOffset}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Actions Section */}
        <div className="actions-section">
          <button className="btn btn-primary" onClick={fetchTracking}>
            Refresh
          </button>
          <button className="btn btn-secondary">
            Download Report
          </button>
          <button className="btn btn-secondary">
            View Full Tree
          </button>
        </div>
      </div>
    </div>
  );
}

export default SecondaryFamilyTracking;
