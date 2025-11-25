import React, { useState } from 'react';
import axios from 'axios';
import './GenerationAdjustment.css';

export function GenerationAdjustment({ mergeRequestId, token, onSuccess }) {
  const [offset, setOffset] = useState(0);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleAdjust = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);

      const response = await axios.post(
        `${process.env.REACT_APP_API_URL}/family-merge/${mergeRequestId}/adjust-generation`,
        {
          offset: parseInt(offset),
          reason: reason || undefined,
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      setSuccess(true);
      setOffset(0);
      setReason('');

      if (onSuccess) {
        onSuccess(response.data.data);
      }

      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to adjust generation offset');
      console.error('Error adjusting generation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setOffset(0);
    setReason('');
    setError(null);
    setSuccess(false);
  };

  return (
    <div className="generation-adjustment">
      <div className="adjustment-header">
        <h3>Generation Offset Adjustment</h3>
        <p className="subtitle">Adjust the generation level for the secondary family</p>
      </div>

      <div className="adjustment-content">
        {/* Info Box */}
        <div className="info-box">
          <h4>What is Generation Offset?</h4>
          <p>
            If the secondary family's generations don't align with the primary family,
            you can apply an offset to shift all generations up or down.
          </p>
          <ul>
            <li><strong>Positive offset</strong>: Moves secondary family down (younger)</li>
            <li><strong>Negative offset</strong>: Moves secondary family up (older)</li>
            <li><strong>Zero offset</strong>: No adjustment</li>
          </ul>
        </div>

        {/* Offset Input */}
        <div className="form-group">
          <label htmlFor="offset">Generation Offset</label>
          <div className="offset-input-group">
            <button
              className="offset-btn"
              onClick={() => setOffset(offset - 1)}
              disabled={loading}
            >
              −
            </button>
            <input
              id="offset"
              type="number"
              value={offset}
              onChange={(e) => setOffset(parseInt(e.target.value) || 0)}
              disabled={loading}
              className="offset-input"
            />
            <button
              className="offset-btn"
              onClick={() => setOffset(offset + 1)}
              disabled={loading}
            >
              +
            </button>
          </div>
          <small>Current offset: {offset}</small>
        </div>

        {/* Reason Input */}
        <div className="form-group">
          <label htmlFor="reason">Reason (Optional)</label>
          <textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={loading}
            placeholder="Enter reason for this adjustment..."
            rows="3"
            className="reason-input"
          />
        </div>

        {/* Preview */}
        <div className="preview-box">
          <h4>Preview</h4>
          <div className="preview-content">
            <div className="preview-item">
              <span className="label">Original Generation:</span>
              <span className="value">Gen 0, 1, 2, ...</span>
            </div>
            <div className="preview-arrow">↓</div>
            <div className="preview-item">
              <span className="label">After Offset ({offset}):</span>
              <span className="value">
                Gen {0 + offset}, {1 + offset}, {2 + offset}, ...
              </span>
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">✕</span>
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success">
            <span className="alert-icon">✓</span>
            <span>Generation offset adjusted successfully!</span>
          </div>
        )}

        {/* Actions */}
        <div className="actions">
          <button
            className="btn btn-primary"
            onClick={handleAdjust}
            disabled={loading || offset === 0}
          >
            {loading ? 'Adjusting...' : 'Apply Offset'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={handleReset}
            disabled={loading}
          >
            Reset
          </button>
        </div>

        {/* Validation Info */}
        <div className="validation-info">
          <h4>Validation</h4>
          <ul>
            <li>✓ No circular relationships will be created</li>
            <li>✓ No orphaned persons will result</li>
            <li>✓ All relationships will be preserved</li>
          </ul>
        </div>
      </div>
    </div>
  );
}

export default GenerationAdjustment;
