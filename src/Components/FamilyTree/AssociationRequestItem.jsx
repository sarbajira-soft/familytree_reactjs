import React, { useState } from 'react';
import { UserPlus, Users, Check, X } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const AssociationRequestItem = ({ request, onAccept, onReject, loading = false }) => {
  // Extract data with defaults
  const { 
    id, 
    type = 'FAMILY_ASSOCIATION_REQUEST',
    createdAt,
    data = {},
    status = 'pending', // Include notification status
    triggeredByUser // User who sent the request
  } = request;

  const {
    senderId,
    senderName = 'A Family Member',
    senderFamilyCode = 'Their Family',
    targetFamilyCode = 'Your Family',
    requestType = 'family_association',
    message = ''
  } = data;
  
  // State for loading indicators
  const [isAccepting, setIsAccepting] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);
  
  // Determine if this is a family join request
  const isFamilyJoinRequest = type === 'FAMILY_JOIN_REQUEST' || type === 'family_join_request';
  
  // Format the request time
  const requestTime = new Date(createdAt);
  const timeAgo = formatDistanceToNow(requestTime, { addSuffix: true });
  const fullDateTime = requestTime.toLocaleString();
  
  // Handle accept/reject actions
  const handleAccept = async () => {
    try {
      setIsAccepting(true);
      await onAccept(id);
    } finally {
      setIsAccepting(false);
    }
  };

  const handleReject = async () => {
    try {
      setIsRejecting(true);
      await onReject(id);
    } finally {
      setIsRejecting(false);
    }
  };

  // Determine loading state
  const isLoading = loading || isAccepting || isRejecting;

  // Check if buttons should be shown (only for pending requests)
  const showActionButtons = status === 'pending';

  // Get status display info
  const getStatusDisplay = () => {
    switch (status) {
      case 'accepted':
        return { text: 'Accepted', color: 'text-green-600', bgColor: 'bg-green-100 dark:bg-green-900/40' };
      case 'rejected':
        return { text: 'Rejected', color: 'text-red-600', bgColor: 'bg-red-100' };
      case 'expired':
        return { text: 'Expired', color: 'text-gray-600 dark:text-slate-300', bgColor: 'bg-gray-100 dark:bg-slate-700' };
      default:
        return null;
    }
  };

  const statusDisplay = getStatusDisplay();

  return (
    <div className={`p-4 transition-colors duration-150 border-l-4 ${
      status === 'accepted' ? 'border-green-400 dark:border-green-500 bg-gradient-to-r from-green-50 to-white dark:from-green-900/20 dark:to-slate-800' :
      status === 'rejected' ? 'border-red-400 dark:border-red-500 bg-gradient-to-r from-red-50 to-white dark:from-red-900/20 dark:to-slate-800' :
      status === 'expired' ? 'border-gray-400 dark:border-slate-500 bg-gradient-to-r from-gray-50 to-white dark:from-slate-800 dark:to-slate-900 opacity-75' :
      'border-green-400 dark:border-green-500 bg-gradient-to-r from-green-50 to-white dark:from-green-900/20 dark:to-slate-800 hover:bg-green-50 dark:hover:bg-slate-700/50'
    }`}>
      <div className="flex items-start">
        <div className="flex-shrink-0 bg-green-100 dark:bg-green-900/40 rounded-full p-2 shadow-sm">
          {isFamilyJoinRequest ? (
            <Users className="h-5 w-5 text-green-600" />
          ) : (
            <UserPlus className="h-5 w-5 text-green-600" />
          )}
        </div>
        
        <div className="ml-3 flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-900 dark:text-slate-100 truncate">
              {request.message || message || (
                isFamilyJoinRequest 
                  ? `${senderName} wants to join ${targetFamilyCode}`
                  : `${senderName} wants to connect your family`
              )}
            </p>
            <div className="flex items-center space-x-2">
              {statusDisplay && (
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${statusDisplay.bgColor} ${statusDisplay.color}`}>
                  {statusDisplay.text}
                </span>
              )}
              <span 
                className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap" 
                title={fullDateTime}
              >
                {timeAgo}
              </span>
            </div>
          </div>
          
          {!isFamilyJoinRequest && senderFamilyCode && (
            <p className="text-xs text-green-600 dark:text-green-400 mt-1 font-medium">
              Connect {senderFamilyCode} ↔ {targetFamilyCode}
            </p>
          )}
          
          {showActionButtons && (
            <div className="mt-3 flex space-x-2">
              <button
                onClick={handleAccept}
                disabled={isLoading}
                className={`inline-flex items-center px-4 py-2 border border-transparent text-xs font-semibold rounded-lg shadow-md text-white focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                  isLoading && !isAccepting 
                    ? 'bg-gray-300 cursor-not-allowed' 
                    : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 focus:ring-green-500 hover:shadow-lg transform hover:scale-105'
                }`}
              >
                {isAccepting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Accepting...
                  </>
                ) : (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Accept
                  </>
                )}
              </button>
              
              <button
                onClick={handleReject}
                disabled={isLoading}
                className={`inline-flex items-center px-4 py-2 border text-xs font-semibold rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-2 transition-all duration-200 ${
                  isLoading && !isRejecting
                    ? 'border-gray-200 dark:border-slate-700 text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-800 cursor-not-allowed'
                    : 'border-red-300 dark:border-red-500/50 text-red-700 dark:text-red-400 bg-white dark:bg-slate-900 hover:bg-red-50 dark:hover:bg-red-900/20 focus:ring-red-500 hover:shadow-md transform hover:scale-105'
                }`}
              >
                {isRejecting ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-3 w-3 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Rejecting...
                  </>
                ) : (
                  <>
                    <X className="h-3 w-3 mr-1" />
                    Reject
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AssociationRequestItem;
