import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Loader2, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { useLanguage } from '../../Contexts/LanguageContext';
import AssociationRequestItem from './AssociationRequestItem';
import { getCurrentUserId } from '../../utils/auth';

import { getToken } from '../../utils/auth';
import { authFetchResponse } from '../../utils/authFetch';

const AssociationRequests = () => {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const { language } = useLanguage();

  useEffect(() => {
    fetchAssociationRequests();
  }, []);

  const fetchAssociationRequests = async () => {
    try {
      setLoading(true);
      const token = getToken();
      
      // Backend now filters by type and applies 15-day rule automatically
      const response = await authFetchResponse(
        `/notifications?all=true&type=FAMILY_ASSOCIATION_REQUEST`,
        {
          method: 'GET',
          skipThrow: true,
          headers: {
            accept: 'application/json',
          },
        }
      );
      
      if (response.ok) {
        const data = await response.json();
        
        // Backend already filters by:
        // - type: FAMILY_ASSOCIATION_REQUEST
        // - createdAt: last 15 days only
        // - status: not expired
        // Frontend only needs to filter for pending status
        const familyRequests = data.filter(n => 
          n.status === 'pending' || !n.status
        );
        
        console.log('✅ Family association requests (last 15 days):', familyRequests.length);
        setRequests(familyRequests);
      }
    } catch (error) {
      console.error('Error fetching association requests:', error);
    } finally {
      setLoading(false);
    }
  };

  // Clear success/error messages after a delay
  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const handleResponse = async (notificationId, action) => {
    try {
      setProcessing(true);
      setError(null);
      setSuccess(null);
      
      const token = getToken();
      const userId = getCurrentUserId();
      
      if (!token || !userId) {
        throw new Error('Please log in to respond to requests');
      }

      const requestId = parseInt(notificationId, 10);
      if (isNaN(requestId)) {
        throw new Error('Invalid request ID');
      }
      
      // Get the full notification data
      const notification = requests.find(req => req.id === notificationId);
      if (!notification) {
        throw new Error('Notification not found');
      }
      
      // For family association requests, we need to include the family code
      // Family proxy endpoints expect { requestId }
      const requestData = { requestId };
      
      // Add additional data for family association requests
      if (notification.type === 'FAMILY_ASSOCIATION_REQUEST' && notification.data) {
        requestData.senderId = notification.data.senderId;
        requestData.senderFamilyCode = notification.data.senderFamilyCode;
        requestData.targetFamilyCode = notification.familyCode;
      }
      
      const endpoint = action === 'accept' ? 'family/accept-association' : 'family/reject-association';
      const response = await authFetchResponse(`/${endpoint}`, {
        method: 'POST',
        skipThrow: true,
        body: JSON.stringify(requestData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to process request');
      }

      // Update the UI by removing the handled request
      setRequests(prev => prev.filter(req => req.id !== notificationId));

      // Show appropriate success message based on the response
      // Normalize payload to support both direct service response and proxy-wrapped response
      const payload = data?.data || data;
      if (action === 'accept' && payload?.data?.bidirectionalCardsCreated) {
        setSuccess('Family connection established successfully with bidirectional cards created');
      } else if (action === 'accept') {
        setSuccess('Family connection established successfully');
      } else {
        setSuccess(`Family association request ${action}ed successfully`);
      }

      // After successful accept, navigate to the associated tree starting from the TARGET user (who received/accepted the request)
      if (action === 'accept') {
        try {
          // Find the full notification again for reliable data access
          const acceptedNotification = notification;
          const senderId = acceptedNotification?.data?.senderId;
          const targetUserId = acceptedNotification?.data?.targetUserId || acceptedNotification?.data?.targetId;
          const senderFamilyCode = acceptedNotification?.data?.senderFamilyCode || acceptedNotification?.familyCode;
          const targetFamilyCode = acceptedNotification?.familyCode || acceptedNotification?.data?.targetFamilyCode;
          // Prefer TARGET (recipient/acceptor)
          let startFromUserId = targetUserId;
          // Fallbacks: use API response acceptingUserId, finally senderId
          if (!startFromUserId && payload?.data?.acceptingUserId) {
            startFromUserId = payload.data.acceptingUserId;
          }
          if (!startFromUserId) {
            startFromUserId = senderId;
          }

          // Persist deterministic counterpart pair locally for focus routing on eye-icon
          try {
            const requesterId = senderId;
            const acceptorId = startFromUserId;
            if (requesterId && acceptorId && senderFamilyCode && targetFamilyCode) {
              const storePair = (fromUserId, toFamilyCode, counterpartUserId) => {
                const key = `assoc_pair:${fromUserId}:${toFamilyCode}`;
                localStorage.setItem(key, String(counterpartUserId));
              };
              // requester -> acceptor family maps to acceptor
              storePair(requesterId, targetFamilyCode, acceptorId);
              // acceptor -> requester family maps to requester
              storePair(acceptorId, senderFamilyCode, requesterId);
            }
          } catch (_) {}

          if (startFromUserId) {
            navigate(`/associated-family-tree-user/${startFromUserId}`);
          } else {
            console.warn('Association accept: could not determine target userId for navigation', {
              senderIdFromNotif: senderId, targetUserIdFromNotif: targetUserId, resp: data?.data
            });
          }
        } catch (_) {
          // no-op if we cannot navigate
        }
      }
      
    } catch (error) {
      console.error(`Error processing request:`, error);
      setError(error.message || 'An error occurred while processing your request');
    } finally {
      setProcessing(false);
    }  
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-4">
        <Loader2 className="animate-spin h-6 w-6 text-blue-500" />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="p-4 text-center text-gray-500">
        {language === 'en' ? 'No pending association requests' : 'நிலுவையில் உள்ள இணைப்பு கோரிக்கைகள் இல்லை'}
      </div>
    );
  }

  // Create a handler function that will be called with the notification ID
  const handleAccept = (notificationId) => handleResponse(notificationId, 'accept');
  const handleReject = (notificationId) => handleResponse(notificationId, 'reject');

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="p-2 rounded-full hover:bg-gray-100 relative"
        aria-label="Association requests"
        aria-expanded={showDropdown}
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {requests.length > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
            {requests.length}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50 border border-gray-200">
          <div className="p-3 border-b border-gray-200">
            <h3 className="font-medium text-gray-800">Association Requests</h3>
          </div>
          
          {/* Success/Error Messages */}
          {success && (
            <div className="p-3 bg-green-50 text-green-700 text-sm flex items-center">
              <CheckCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {success}
            </div>
          )}
          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-sm flex items-center">
              <XCircle className="w-4 h-4 mr-2 flex-shrink-0" />
              {error}
            </div>
          )}
          
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="p-4 flex justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : requests.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No pending requests
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {requests.map((request) => (
                  <AssociationRequestItem
                    key={request.id}
                    request={request}
                    onAccept={(id) => handleResponse(id, 'accept')}
                    onReject={(id) => handleResponse(id, 'reject')}
                    loading={processing}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AssociationRequests;
