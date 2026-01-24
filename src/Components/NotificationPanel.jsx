import React, { useEffect, useState } from 'react';
import {
  FiBell,
  FiX,
  FiCheck,
  FiUser,
  FiCalendar,
  FiGift,
  FiHeart,
  FiUsers,
  FiUserPlus,
  FiUserX
} from 'react-icons/fi';
import { getNotificationType } from '../utils/notifications';
import AssociationRequestItem from './FamilyTree/AssociationRequestItem';
import { useNotificationSocket } from '../hooks/useNotificationSocket';
import { useUser } from '../Contexts/UserContext';

const NotificationPanel = ({ open, onClose, onNotificationCountUpdate , isConnected ,wsNotifications , refetchUnreadCount  }) => {
  const { userInfo } = useUser();
  // const { isConnected, notifications: wsNotifications, refetchUnreadCount } = useNotificationSocket(userInfo);
  
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [processingRequest, setProcessingRequest] = useState(null);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'requests', 'other'

  const notificationTypes = {
    request: { icon: <FiUser />, color: 'from-blue-500 to-blue-300' },
    birthday: { icon: <FiGift />, color: 'from-pink-500 to-pink-300' },
    event: { icon: <FiCalendar />, color: 'from-purple-500 to-purple-300' },
    anniversary: { icon: <FiHeart />, color: 'from-red-500 to-red-300' },
    family_association_request: { icon: <FiUsers />, color: 'from-blue-500 to-blue-300' },
    FAMILY_ASSOCIATION_REQUEST: { icon: <FiUsers />, color: 'from-blue-500 to-blue-300' },
    family_association_accepted: { icon: <FiUserPlus />, color: 'from-teal-500 to-teal-300' },
    FAMILY_ASSOCIATION_ACCEPTED: { icon: <FiUserPlus />, color: 'from-teal-500 to-teal-300' },
    family_association_rejected: { icon: <FiUserX />, color: 'from-orange-500 to-orange-300' },
    FAMILY_ASSOCIATION_REJECTED: { icon: <FiUserX />, color: 'from-orange-500 to-orange-300' },
    family_member_removed: { icon: <FiUserX />, color: 'from-red-500 to-red-300' },
    family_member_joined: { icon: <FiUserPlus />, color: 'from-purple-500 to-purple-300' },
  };

  const fetchNotifications = async (getAll = false) => {
    try {
      setLoading(true);
      const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
      const url = `${baseUrl}/notifications${getAll ? '?all=true' : ''}`;

      console.log('🔍 Fetching notifications from:', url);
      console.log('🔑 Using token:', localStorage.getItem('access_token') ? 'Token exists' : 'No token');
      
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      console.log('📡 API Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        console.error('❌ Failed to fetch notifications:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('❌ Error details:', errorText);
        return;
      }

      const data = await response.json();
      console.log('📥 Raw notification data from API:', data);
      console.log('📊 Data type:', typeof data, 'Is array:', Array.isArray(data), 'Length:', data?.length);

      const formatted = data.map((n) => ({
        id: n.id,
        type: n.type, // Keep original case to handle both formats
        title: n.title,
        message: n.message,
        time: n.createdAt, // Keep the original ISO string for proper parsing
        read: n.isRead,
        status: n.status || 'pending', // Include notification status
        data: n.data || {},
        createdAt: n.createdAt,
        triggeredBy: n.triggeredBy,
        triggeredByUser: n.triggeredByUser || null,
      }));

      // Debug: Log all notifications to see what types we're getting
      console.log('All notifications received:', formatted.map(n => ({ id: n.id, type: n.type, title: n.title, status: n.status, read: n.read })));
      
      // Debug: Log association requests specifically
      const associationNotifs = formatted.filter(n => 
        n.type === 'family_association_request' || n.type === 'FAMILY_ASSOCIATION_REQUEST'
      );
      console.log('Association notifications found:', associationNotifs.length);
      associationNotifs.forEach(notif => {
        console.log(`🔍 Association Notification ${notif.id}: status=${notif.status}, read=${notif.read}, isRead=${notif.isRead}`);
      });

      setNotifications(formatted);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id) => {
    try {
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/notifications/${id}/read`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        },
      });

      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      if (onNotificationCountUpdate) {
        onNotificationCountUpdate();
      }
    } catch (err) {
      console.error('Failed to mark as read:', err);
    }
  };

  // Sync WebSocket notifications with local state
  useEffect(() => {
    if (wsNotifications && wsNotifications.length > 0) {
      console.log('🔄 WebSocket notifications updated:', wsNotifications.length);
      // WebSocket provides real-time notifications
      setNotifications(wsNotifications);
    }
  }, [wsNotifications]);

  useEffect(() => {
    if (open) {
      // Fetch initial notifications only once when panel opens
      fetchNotifications(true);
      console.log('✅ NotificationPanel opened - WebSocket active:', isConnected);
    }
  }, [open]);

  if (!open) return null;

  // Separate notifications by type first
  const allAssociationRequests = notifications.filter(n => 
    n.type === 'family_association_request' || n.type === 'FAMILY_ASSOCIATION_REQUEST'
  );
  const allOtherNotifications = notifications.filter(n => 
    n.type !== 'family_association_request' && n.type !== 'FAMILY_ASSOCIATION_REQUEST'
  );

  // Filter based on active tab
  const getFilteredNotifications = () => {
    switch (activeTab) {
      case 'requests':
        // Only show association requests
        return { associationRequests: allAssociationRequests, otherNotifications: [] };
      case 'other':
        // Only show other notifications
        return { associationRequests: [], otherNotifications: allOtherNotifications };
      default:
        // Show all notifications
        return { associationRequests: allAssociationRequests, otherNotifications: allOtherNotifications };
    }
  };

  // Time-based filtering (Instagram style)
  const filterByTime = (notificationList) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    return notificationList.filter(n => {
      const notifDate = new Date(n.createdAt || n.time);
      // Only show notifications from last 30 days
      return notifDate >= thirtyDaysAgo;
    });
  };

  // Group notifications by time period
  const groupByTime = (notificationList) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groups = {
      today: [],
      last7Days: [],
      last30Days: []
    };

    notificationList.forEach(n => {
      const notifDate = new Date(n.createdAt || n.time);
      
      if (notifDate >= today) {
        groups.today.push(n);
      } else if (notifDate >= sevenDaysAgo) {
        groups.last7Days.push(n);
      } else if (notifDate >= thirtyDaysAgo) {
        groups.last30Days.push(n);
      }
      // Older than 30 days are not included (hidden)
    });

    return groups;
  };

  const { associationRequests, otherNotifications } = getFilteredNotifications();
  
  // Filter by time (last 30 days only)
  const timeFilteredAssociations = filterByTime(associationRequests);
  const timeFilteredOthers = filterByTime(otherNotifications);
  
  // Group by time periods
  const associationGroups = groupByTime(timeFilteredAssociations);
  const otherGroups = groupByTime(timeFilteredOthers);
  
  const filteredNotifications = [...timeFilteredAssociations, ...timeFilteredOthers];

  // Debug: Log the filtering results
  console.log('📊 Time-based filtering:', {
    activeTab,
    total: notifications.length,
    filtered: filteredNotifications.length,
    today: associationGroups.today.length + otherGroups.today.length,
    last7Days: associationGroups.last7Days.length + otherGroups.last7Days.length,
    last30Days: associationGroups.last30Days.length + otherGroups.last30Days.length
  });

  const handleAcceptRequest = async (notification) => {
    try {
      setProcessingRequest(notification.id);
      
      // Extract required data from notification
      const requestData = notification.data || {};
      
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/family/accept-association`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: notification.id
        })
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Accept response:', responseData);
        
        // Update the notification status and mark as read immediately in local state
        setNotifications(prev => prev.map(n => 
          n.id === notification.id 
            ? { ...n, status: 'accepted', read: true }
            : n
        ));
        
        // Update notification count via WebSocket
        if (refetchUnreadCount) {
          refetchUnreadCount();
        }
        if (onNotificationCountUpdate) {
          onNotificationCountUpdate();
        }
        
        // WebSocket will automatically update notifications in real-time
        console.log('✅ WebSocket will update notifications automatically');
        
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ Error accepting association:', errorData);
        alert(`Failed to accept request: ${errorData.message || 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Network error accepting association:', error);
      alert('Network error. Please check your connection and try again.');
      return false;
    } finally {
      setProcessingRequest(null);
    }
  };

  const handleRejectRequest = async (notification) => {
    try {
      setProcessingRequest(notification.id);
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/family/reject-association`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: notification.id
        }),
      });

      if (response.ok) {
        const responseData = await response.json();
        console.log('✅ Reject response:', responseData);
        
        // Update the notification status and mark as read immediately in local state
        setNotifications(prev => prev.map(n => 
          n.id === notification.id 
            ? { ...n, status: 'rejected', read: true }
            : n
        ));
        
        // Update notification count via WebSocket
        if (refetchUnreadCount) {
          refetchUnreadCount();
        }
        if (onNotificationCountUpdate) {
          onNotificationCountUpdate();
        }
        
        // WebSocket will automatically update notifications in real-time
        console.log('✅ WebSocket will update notifications automatically');
        
        return true;
      } else {
        const errorData = await response.json();
        console.error('❌ Error rejecting association:', errorData);
        alert(`Failed to reject request: ${errorData.message || 'Unknown error'}`);
        return false;
      }
    } catch (error) {
      console.error('❌ Network error rejecting association:', error);
      alert('Network error. Please check your connection and try again.');
      return false;
    } finally {
      setProcessingRequest(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div
        className="absolute inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
      />
      <div className="absolute right-0 top-0 h-full w-full max-w-md transform overflow-hidden bg-white shadow-xl transition-transform duration-300 ease-in-out dark:bg-slate-900">
        <div className="flex h-full flex-col">
          {/* Header */}
          <div className="border-b border-gray-200 bg-white px-4 py-3 dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                Notifications
              </h3>
              <button
                onClick={onClose}
                className="rounded-full p-1 bg-white text-gray-400 hover:bg-gray-100 hover:text-gray-500 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <FiX className="h-5 w-5" />
              </button>
            </div>

            {/* Tab Navigation - Uniform Green Style */}
            <div className="flex gap-2 p-2">
              <button
                onClick={() => setActiveTab("all")}
                className={`flex-1 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "all"
                    ? "bg-gradient-to-r from-secondary-600 to-secondary-500 text-white shadow-md"
                    : "bg-gradient-to-r from-primary-600 to-primary-500 text-gray-300 opacity-90 hover:opacity-100"
                }`}
              >
                All
                <span className="ml-1 text-xs">({notifications.length})</span>
              </button>
              <button
                onClick={() => setActiveTab("requests")}
                className={`flex-1 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "requests"
                    ? "bg-gradient-to-r from-secondary-600 to-secondary-500 text-white shadow-md"
                    : "bg-gradient-to-r from-primary-600 to-primary-500 text-gray-300 opacity-90 hover:opacity-100"
                }`}
              >
                Requests
                <span className="ml-1 text-xs">
                  ({allAssociationRequests.length})
                </span>
              </button>
              <button
                onClick={() => setActiveTab("other")}
                className={`flex-1 px-4 py-3 text-sm font-semibold rounded-lg transition-all ${
                  activeTab === "other"
                    ? "bg-gradient-to-r from-secondary-600 to-secondary-500 text-white shadow-md"
                    : "bg-gradient-to-r from-primary-600 to-primary-500 text-gray-300 opacity-90 hover:opacity-100"
                }`}
              >
                Other
                <span className="ml-1 text-xs">
                  ({allOtherNotifications.length})
                </span>
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary-500" />
              </div>
            ) : filteredNotifications.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center p-6 text-center">
                <FiBell className="mb-2 h-10 w-10 text-gray-400 dark:text-slate-400" />
                <h4 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                  {activeTab === "requests"
                    ? "No association requests"
                    : activeTab === "other"
                    ? "No other notifications"
                    : "No notifications"}
                </h4>
                <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                  {activeTab === "requests"
                    ? "No pending family association requests."
                    : activeTab === "other"
                    ? "No other notifications available."
                    : "We'll let you know when there's something new."}
                </p>
              </div>
            ) : (
              <>
                {/* Time-grouped notifications - Instagram style */}

                {/* Today Section */}
                {(associationGroups.today.length > 0 ||
                  otherGroups.today.length > 0) && (
                  <>
                    <div className="bg-gray-50 px-4 py-2 sticky top-0 z-10 dark:bg-slate-800">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-slate-300">
                        Today
                      </h4>
                    </div>

                    {/* Today's Association Requests */}
                    {associationGroups.today.map((notification) => {
                      const requesterId =
                        notification.data?.requesterId ||
                        notification.sender?.id ||
                        notification.data?.sender?.id;
                      const requesterName =
                        notification.data?.senderName ||
                        notification.data?.requesterName ||
                        "Someone";
                      const requesterFamilyCode =
                        notification.data?.senderFamilyCode ||
                        notification.data?.requesterFamilyCode ||
                        "Their Family";

                      return (
                        <div
                          key={notification.id}
                          className="border-b border-gray-200 dark:border-slate-800"
                        >
                          <AssociationRequestItem
                            request={{
                              ...notification,
                              id: notification.id,
                              type: notification.type,
                              message: notification.message,
                              status: notification.status,
                              data: {
                                ...notification.data,
                                senderId: requesterId,
                                senderName: requesterName,
                                senderFamilyCode: requesterFamilyCode,
                                targetUserId: notification.data?.targetUserId,
                                targetName: notification.data?.targetName,
                                targetFamilyCode:
                                  notification.data?.targetFamilyCode ||
                                  notification.data?.familyCode,
                                requestType: "family_association",
                              },
                              createdAt: notification.createdAt,
                            }}
                            onAccept={() => handleAcceptRequest(notification)}
                            onReject={() => handleRejectRequest(notification)}
                            loading={processingRequest === notification.id}
                          />
                        </div>
                      );
                    })}

                    {/* Today's Other Notifications */}
                    {otherGroups.today.map((notification) => (
                      <div
                        key={notification.id}
                        className={`relative px-4 py-3 hover:bg-gray-50 border-b border-gray-200 dark:hover:bg-slate-800 dark:border-slate-800 ${
                          !notification.read ? "bg-blue-50 dark:bg-slate-800" : ""
                        }`}
                        onClick={() =>
                          !notification.read && markAsRead(notification.id)
                        }
                      >
                        <div className="flex items-start">
                          <div
                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r ${
                              notificationTypes[notification.type]?.color ||
                              "from-gray-400 to-gray-300"
                            }`}
                          >
                            {notificationTypes[notification.type]?.icon || (
                              <FiBell className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {notification.title ||
                                  getNotificationType(notification.type)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {new Date(notification.time).toLocaleTimeString(
                                  [],
                                  { hour: "2-digit", minute: "2-digit" }
                                )}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                              {notification.message}
                            </p>
                            {!notification.read && (
                              <div className="mt-1">
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                                  New
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Last 7 Days Section */}
                {(associationGroups.last7Days.length > 0 ||
                  otherGroups.last7Days.length > 0) && (
                  <>
                    <div className="bg-gray-50 px-4 py-2 sticky top-0 z-10 dark:bg-slate-800">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-slate-300">
                        Last 7 Days
                      </h4>
                    </div>

                    {/* Last 7 Days Association Requests */}
                    {associationGroups.last7Days.map((notification) => {
                      const requesterId =
                        notification.data?.requesterId ||
                        notification.sender?.id ||
                        notification.data?.sender?.id;
                      const requesterName =
                        notification.data?.senderName ||
                        notification.data?.requesterName ||
                        "Someone";
                      const requesterFamilyCode =
                        notification.data?.senderFamilyCode ||
                        notification.data?.requesterFamilyCode ||
                        "Their Family";

                      return (
                        <div
                          key={notification.id}
                          className="border-b border-gray-200 dark:border-slate-800"
                        >
                          <AssociationRequestItem
                            request={{
                              ...notification,
                              id: notification.id,
                              type: notification.type,
                              message: notification.message,
                              status: notification.status,
                              data: {
                                ...notification.data,
                                senderId: requesterId,
                                senderName: requesterName,
                                senderFamilyCode: requesterFamilyCode,
                                targetUserId: notification.data?.targetUserId,
                                targetName: notification.data?.targetName,
                                targetFamilyCode:
                                  notification.data?.targetFamilyCode ||
                                  notification.data?.familyCode,
                                requestType: "family_association",
                              },
                              createdAt: notification.createdAt,
                            }}
                            onAccept={() => handleAcceptRequest(notification)}
                            onReject={() => handleRejectRequest(notification)}
                            loading={processingRequest === notification.id}
                          />
                        </div>
                      );
                    })}

                    {/* Last 7 Days Other Notifications */}
                    {otherGroups.last7Days.map((notification) => (
                      <div
                        key={notification.id}
                        className={`relative px-4 py-3 hover:bg-gray-50 border-b border-gray-200 dark:hover:bg-slate-800 dark:border-slate-800 ${
                          !notification.read ? "bg-blue-50 dark:bg-slate-800" : ""
                        }`}
                        onClick={() =>
                          !notification.read && markAsRead(notification.id)
                        }
                      >
                        <div className="flex items-start">
                          <div
                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r ${
                              notificationTypes[notification.type]?.color ||
                              "from-gray-400 to-gray-300"
                            }`}
                          >
                            {notificationTypes[notification.type]?.icon || (
                              <FiBell className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {notification.title ||
                                  getNotificationType(notification.type)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {new Date(notification.time).toLocaleDateString(
                                  [],
                                  { month: "short", day: "numeric" }
                                )}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                              {notification.message}
                            </p>
                            {!notification.read && (
                              <div className="mt-1">
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                                  New
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}

                {/* Last 30 Days Section */}
                {(associationGroups.last30Days.length > 0 ||
                  otherGroups.last30Days.length > 0) && (
                  <>
                    <div className="bg-gray-50 px-4 py-2 sticky top-0 z-10 dark:bg-slate-800">
                      <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide dark:text-slate-300">
                        Last 30 Days
                      </h4>
                    </div>

                    {/* Last 30 Days Association Requests */}
                    {associationGroups.last30Days.map((notification) => {
                      const requesterId =
                        notification.data?.requesterId ||
                        notification.sender?.id ||
                        notification.data?.sender?.id;
                      const requesterName =
                        notification.data?.senderName ||
                        notification.data?.requesterName ||
                        "Someone";
                      const requesterFamilyCode =
                        notification.data?.senderFamilyCode ||
                        notification.data?.requesterFamilyCode ||
                        "Their Family";

                      return (
                        <div
                          key={notification.id}
                          className="border-b border-gray-200 dark:border-slate-800"
                        >
                          <AssociationRequestItem
                            request={{
                              ...notification,
                              id: notification.id,
                              type: notification.type,
                              message: notification.message,
                              status: notification.status,
                              data: {
                                ...notification.data,
                                senderId: requesterId,
                                senderName: requesterName,
                                senderFamilyCode: requesterFamilyCode,
                                targetUserId: notification.data?.targetUserId,
                                targetName: notification.data?.targetName,
                                targetFamilyCode:
                                  notification.data?.targetFamilyCode ||
                                  notification.data?.familyCode,
                                requestType: "family_association",
                              },
                              createdAt: notification.createdAt,
                            }}
                            onAccept={() => handleAcceptRequest(notification)}
                            onReject={() => handleRejectRequest(notification)}
                            loading={processingRequest === notification.id}
                          />
                        </div>
                      );
                    })}

                    {/* Last 30 Days Other Notifications */}
                    {otherGroups.last30Days.map((notification) => (
                      <div
                        key={notification.id}
                        className={`relative px-4 py-3 hover:bg-gray-50 border-b border-gray-200 dark:hover:bg-slate-800 dark:border-slate-800 ${
                          !notification.read ? "bg-blue-50 dark:bg-slate-800" : ""
                        }`}
                        onClick={() =>
                          !notification.read && markAsRead(notification.id)
                        }
                      >
                        <div className="flex items-start">
                          <div
                            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-r ${
                              notificationTypes[notification.type]?.color ||
                              "from-gray-400 to-gray-300"
                            }`}
                          >
                            {notificationTypes[notification.type]?.icon || (
                              <FiBell className="h-5 w-5 text-white" />
                            )}
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-medium text-gray-900 dark:text-slate-100">
                                {notification.title ||
                                  getNotificationType(notification.type)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-slate-400">
                                {new Date(notification.time).toLocaleDateString(
                                  [],
                                  { month: "short", day: "numeric" }
                                )}
                              </p>
                            </div>
                            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                              {notification.message}
                            </p>
                            {!notification.read && (
                              <div className="mt-1">
                                <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900/40 dark:text-blue-200">
                                  New
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 p-4 text-center dark:border-slate-800">
            <button
              onClick={() => fetchNotifications(true)}
              style={{
                fontSize: "14px",
                fontWeight: "500",
                color: "#2563eb",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
                textDecoration: "none",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.target.style.color = "#1d4ed8";
                e.target.style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                e.target.style.color = "#2563eb";
                e.target.style.textDecoration = "none";
              }}
            >
              View all notifications
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationPanel;
