import React, { useState } from 'react';
import { REPORT_REASONS } from '../../constants/chat.constants';
import { reportMessage } from '../../services/chat.service';

const ReportMessageModal = ({ message, familyCode, onClose }) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  if (!message) return null;

  const handleSubmit = async () => {
    if (!selectedReason || submitting || !familyCode) return;
    setSubmitting(true);
    try {
      await reportMessage(message.id, familyCode, selectedReason, '');
      setDone(true);
      setTimeout(() => onClose?.(), 1500);
    } catch {
      alert('Failed to submit report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="report-modal-overlay" onClick={onClose}>
      <div className="report-modal" onClick={(e) => e.stopPropagation()}>
        {done ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: '40px', marginBottom: '12px' }}>✅</div>
            <h3 style={{ margin: 0 }}>Report Submitted</h3>
            <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '8px' }}>
              Thank you. Our team will review this message.
            </p>
          </div>
        ) : (
          <>
            <h3>Report Message</h3>
            <p style={{ fontSize: '13px', color: '#6b7280', marginBottom: '12px' }}>
              Why are you reporting this message?
            </p>
            {REPORT_REASONS.map((reason) => (
              <div
                key={reason.id}
                className={`report-reason-item${selectedReason === reason.id ? ' selected' : ''}`}
                onClick={() => setSelectedReason(reason.id)}
              >
                <div className={`report-radio${selectedReason === reason.id ? ' checked' : ''}`} />
                <span style={{ fontSize: '14px', color: '#374151' }}>{reason.label}</span>
              </div>
            ))}
            <div className="report-modal-actions">
              <button className="report-btn report-btn--cancel" onClick={onClose}>Cancel</button>
              <button
                className="report-btn report-btn--submit"
                onClick={handleSubmit}
                disabled={!selectedReason || submitting}
              >
                {submitting ? 'Submitting...' : 'Submit Report'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReportMessageModal;
