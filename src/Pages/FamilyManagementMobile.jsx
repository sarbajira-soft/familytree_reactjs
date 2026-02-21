import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../Contexts/UserContext";
import FamilyOverView from "../Components/FamilyOverView";
import FamilyView from "../Components/FamilyView";
import CreateFamilyModal from "../Components/CreateFamilyModal";
import JoinFamilyModal from "../Components/JoinFamilyModal";
import NoFamilyView from "../Components/NoFamilyView";
import PendingApprovalView from "../Components/PendingApprovalView";
import FamilyManagementShimmer from "./FamilyManagementShimmer";

import { authFetchResponse } from "../utils/authFetch";
import { getToken } from "../utils/auth";

const FamilyManagementMobile = () => {
  const navigate = useNavigate();
  const { userInfo } = useUser();

  const hasFamily = !!userInfo?.familyCode;
  const isApproved = userInfo?.approveStatus === "approved";
  const isAdmin = userInfo?.role === 2 || userInfo?.role === 3;

  const [familyData, setFamilyData] = useState(null);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [totalMembers, setTotalMembers] = useState(0);
  const [males, setMales] = useState(0);
  const [females, setFemales] = useState(0);
  const [averageAge, setAverageAge] = useState(0);
  const [showCopyMessage, setShowCopyMessage] = useState(false);

  const [token, setToken] = useState(null);
  const [isCreateFamilyModalOpen, setIsCreateFamilyModalOpen] = useState(false);
  const [isJoinFamilyModalOpen, setIsJoinFamilyModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const [membersPreview, setMembersPreview] = useState([]);
  const [membersList, setMembersList] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(null);
  const [pendingRequestsList, setPendingRequestsList] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);
  const [inviteCopySuccess, setInviteCopySuccess] = useState(false);

  useEffect(() => {
    const storedToken = getToken();
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!hasFamily || !userInfo?.familyCode) {
      setFamilyData(null);
      setMembersPreview([]);
      setPendingRequestsCount(null);
      return;
    }

    const baseUrl = import.meta.env.VITE_API_BASE_URL;
    if (!baseUrl) {
      return;
    }

    const controller = new AbortController();
    const { signal } = controller;

    const loadFamilyData = async () => {
      try {
        setFamilyLoading(true);
        const res = await authFetchResponse(`${baseUrl}/family/code/${userInfo.familyCode}`, {
          method: "GET",
          skipThrow: true,
          headers: { accept: "application/json" },
          signal,
        });
        if (!res.ok) {
          setFamilyData(null);
          return;
        }
        const json = await res.json();
        const payload = json?.data || json;
        if (!payload) {
          setFamilyData(null);
          return;
        }
        setFamilyData(payload);
        setTotalMembers(payload.totalMembers ?? 0);
        setMales(payload.males ?? 0);
        setFemales(payload.females ?? 0);
        setAverageAge(payload.averageAge ?? 0);
      } catch (_) {
        if (!signal.aborted) {
          setFamilyData(null);
        }
      } finally {
        if (!signal.aborted) {
          setFamilyLoading(false);
        }
      }
    };

    const loadMembersPreview = async () => {
      const token = getToken();
      if (!token) {
        setMembersPreview([]);
        return;
      }
      try {
        setMembersLoading(true);
        const res = await authFetchResponse(`${baseUrl}/family/member/${userInfo.familyCode}`, {
          method: "GET",
          skipThrow: true,
          headers: {
            Accept: "application/json",
          },
          signal,
        });
        if (!res.ok) {
          setMembersPreview([]);
          return;
        }
        const json = await res.json();
        const data = json?.data || [];
        const formatted = data.map((item) => {
          const user = item.user || {};
          const profile = user.userProfile || {};
          const fullName = (user.fullName || "").toString().trim();
          let name = fullName;
          if (!name || /\bnull\b|\bundefined\b/i.test(name)) {
            name = [profile.firstName, profile.lastName]
              .filter((v) => v && v !== "null" && v !== "undefined")
              .join(" ")
              .trim();
          }
          if (!name) {
            name = "Member";
          }
          return {
            id: item.id,
            name,
            status: item.approveStatus,
            profilePic: user.profileImage,
          };
        });
        const approved = formatted.filter((m) => m.status === "approved");
        setMembersList(approved);
        setMembersPreview(approved.slice(0, 3));
      } catch (_) {
        if (!signal.aborted) {
          setMembersPreview([]);
        }
      } finally {
        if (!signal.aborted) {
          setMembersLoading(false);
        }
      }
    };

    const loadPendingRequests = async () => {
      if (!isApproved || !isAdmin) {
        setPendingRequestsCount(null);
        return;
      }
      const token = getToken();
      if (!token) {
        setPendingRequestsCount(null);
        return;
      }
      try {
        setPendingLoading(true);

        const isJoinRequestType = (type) => {
          const normalizedType = String(type || '').trim();
          return [
            'FAMILY_JOIN_REQUEST',
            'FAMILY_JOIN_REQUEST_UPDATED',
            'FAMILY_ASSOCIATION_REQUEST',
            'family_join_request',
            'family_join_request_updated',
            'family_association_request',
          ].includes(normalizedType);
        };

        const isOpenRequestStatus = (status) => {
          const normalizedStatus = String(status || '').trim().toLowerCase();
          return !['accepted', 'rejected', 'expired', 'cancelled'].includes(normalizedStatus);
        };

        const normalizeFamilyCode = (value) => String(value || '').trim().toUpperCase();

        const res = await authFetchResponse(
          `${baseUrl}/notifications/${userInfo.familyCode}/join-requests`,
          {
            method: "GET",
            skipThrow: true,
            headers: {
              accept: "application/json",
            },
            signal,
          }
        );

        let requestList = [];
        if (res.ok) {
          const json = await res.json();
          requestList = json?.data || [];
        }

        // Fallback: fetch all notifications if family-specific endpoint returns empty
        if (requestList.length === 0) {
          const allRes = await authFetchResponse(
            `${baseUrl}/notifications?all=true`,
            {
              method: "GET",
              skipThrow: true,
              headers: { accept: "application/json" },
              signal,
            }
          );
          if (allRes.ok) {
            const allJson = await allRes.json();
            const allNotifications = allJson?.data || allJson || [];
            if (Array.isArray(allNotifications)) {
              requestList = allNotifications.filter((req) =>
                normalizeFamilyCode(req?.familyCode) === normalizeFamilyCode(userInfo.familyCode) &&
                isJoinRequestType(req?.type) &&
                isOpenRequestStatus(req?.status)
              );
            }
          }
        }

        const pending = requestList
          .filter((req) => req && typeof req === 'object')
          .filter((req) => isOpenRequestStatus(req?.status));

        setPendingRequestsCount(pending.length);

        const pendingMapped = pending.map(req => {
          let name = 'Member';
          let profilePic = null;
          if (req?.triggeredByUser) {
            name = req.triggeredByUser.name || (req.triggeredByUser.firstName + ' ' + (req.triggeredByUser.lastName || ''));
            profilePic = req.triggeredByUser.profile;
          } else if (req?.data?.requesterName) {
            name = req.data.requesterName;
          }
          return {
            id: req.id,
            name: name.trim() || 'Member',
            profilePic: profilePic,
            status: req.status
          };
        });
        setPendingRequestsList(pendingMapped);
      } catch (_) {
        if (!signal.aborted) {
          setPendingRequestsCount(null);
          setPendingRequestsList([]);
        }
      } finally {
        if (!signal.aborted) {
          setPendingLoading(false);
        }
      }
    };

    if (isApproved) {
      loadFamilyData();
    } else {
      setFamilyData(null);
    }
    loadMembersPreview();
    loadPendingRequests();

    return () => {
      controller.abort();
    };
  }, [hasFamily, isApproved, isAdmin, userInfo?.familyCode]);

  const handleManageMembers = () => {
    navigate("/my-family-member");
  };

  const handleManageEvents = () => {
    navigate("/events");
  };

  const handleManageGifts = () => {
    navigate("/gifts-memories");
  };

  const handleEditFamily = () => {
    setIsEditModalOpen(true);
  };

  const handleCreateFamily = () => {
    setIsCreateFamilyModalOpen(true);
  };

  const handleJoinFamily = () => {
    setIsJoinFamilyModalOpen(true);
  };

  const handleFamilyCreated = () => {
    setIsCreateFamilyModalOpen(false);
    globalThis.location.reload();
  };

  const handleFamilyJoined = () => {
    setIsJoinFamilyModalOpen(false);
    globalThis.location.reload();
  };

  const handleShareFamilyCode = () => {
    if (!familyData?.familyCode) return;

    navigator.clipboard
      .writeText(familyData.familyCode)
      .then(() => {
        setShowCopyMessage(true);
        setTimeout(() => setShowCopyMessage(false), 2000);
      })
      .catch(() => {
        // Ignore clipboard errors silently
      });
  };

  const accessView = !hasFamily ? (
    <NoFamilyView onCreateFamily={handleCreateFamily} onJoinFamily={handleJoinFamily} />
  ) : !isApproved ? (
    <PendingApprovalView
      familyCode={userInfo?.familyCode}
      onJoinFamily={handleJoinFamily}
    />
  ) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white dark:from-slate-950 dark:to-slate-900">
      {accessView ? (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24">
          <div className="min-h-[calc(100vh-10rem)] flex items-center justify-center">
            {accessView}
          </div>
        </div>
      ) : familyLoading || !familyData ? (
        <FamilyManagementShimmer />
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24">
          <div className="md:hidden mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
              Family Management
            </h1>
            <p className="hidden md:block mt-1 text-sm text-gray-600 dark:text-slate-300">
              Quickly access all family-related tools from a single place.
            </p>
          </div>

          {hasFamily && (
            <div className="mb-5 space-y-6">
              <FamilyView
                familyData={familyData}
                totalMembers={totalMembers}
                males={males}
                females={females}
                averageAge={averageAge}
                onManageMembers={handleManageMembers}
                onManageEvents={handleManageEvents}
                onManageGifts={handleManageGifts}
                onEditFamily={handleEditFamily}
                onShareFamilyCode={handleShareFamilyCode}
              />
              {showCopyMessage && (
                <div className="mt-2 text-xs text-green-600 dark:text-green-400">
                  Family code copied to clipboard
                </div>
              )}

              {/* Dashboard Grid Layout */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">

                {/* Left Column: Stats & Directory */}
                <div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6">
                  <FamilyOverView
                    familyCode={userInfo.familyCode}
                    token={getToken()}
                  />

                  {/* Directory (Moved to Left Column) */}
                  {membersLoading ? (
                    <div className="h-64 rounded-[2rem] bg-white/60 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 animate-pulse mt-4" />
                  ) : (
                    membersPreview.length > 0 && (
                      <div className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white dark:border-slate-800 p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] mt-2 lg:-mt-2">
                        <div className="flex flex-col mb-6">
                          <div className="flex items-center justify-between w-full mb-2">
                            <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3">
                              <span className="relative flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                              </span>
                              Directory
                            </h3>
                            <button
                              type="button"
                              onClick={() => navigate("/my-family-member")}
                              className="px-4 py-2 text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-xl hover:bg-blue-500 hover:text-white dark:hover:bg-blue-500 dark:hover:text-white active:scale-95 transition-all duration-300 shadow-sm"
                            >
                              Manage All
                            </button>
                          </div>
                          <p className="text-sm font-medium text-gray-500 dark:text-slate-400">
                            A quick snapshot of your family connection.
                          </p>
                        </div>

                        <div className="flex -space-x-4 mb-6">
                          {membersPreview.map((m, idx) => (
                            <div
                              key={m.id}
                              className="w-14 h-14 rounded-full border-4 border-white dark:border-slate-900 overflow-hidden bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 shadow-md relative hover:z-20 hover:scale-125 transition-all duration-300 hover:-translate-y-2 cursor-pointer group/avatar"
                              style={{ zIndex: 10 - idx }}
                            >
                              {m.profilePic ? (
                                <img
                                  src={m.profilePic}
                                  alt={m.name}
                                  className="w-full h-full object-cover group-hover/avatar:scale-110 transition-transform duration-300"
                                />
                              ) : (
                                m.name
                                  .split(" ")
                                  .map((part) => part[0])
                                  .join("")
                                  .slice(0, 2)
                              )}
                            </div>
                          ))}
                          {membersList.length > 3 && (
                            <div className="w-14 h-14 rounded-full border-4 border-white dark:border-slate-900 overflow-hidden bg-blue-50 dark:bg-slate-700 flex items-center justify-center text-sm font-bold text-blue-600 shadow-md relative z-0 hover:scale-110 hover:-translate-y-1 transition-all duration-300 cursor-pointer">
                              +{membersList.length - 3}
                            </div>
                          )}
                        </div>

                        {membersList.length > 0 && (
                          <div className="space-y-3">
                            {membersList.slice(0, 3).map((m) => (
                              <div
                                key={m.id}
                                className="group/item flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-700 hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                              >
                                <div className="flex items-center space-x-3 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-full overflow-hidden bg-white dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0 shadow-sm border border-gray-100 dark:border-slate-600 group-hover/item:shadow-md transition-all duration-300 group-hover/item:scale-110">
                                    {m.profilePic ? (
                                      <img
                                        src={m.profilePic}
                                        alt={m.name}
                                        className="w-full h-full object-cover"
                                      />
                                    ) : (
                                      m.name
                                        .split(" ")
                                        .map((part) => part[0])
                                        .join("")
                                        .slice(0, 2)
                                    )}
                                  </div>
                                  <span className="text-xs font-bold text-gray-800 dark:text-slate-100 truncate group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors">
                                    {m.name}
                                  </span>
                                </div>
                                <span
                                  className={`ml-2 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase group-hover/item:scale-105 transition-transform duration-300 ${m.status === "approved"
                                    ? "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                                    : m.status === "pending"
                                      ? "bg-amber-100/80 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                                      : "bg-gray-100/80 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                    }`}
                                >
                                  {m.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* Right Column: Invites & Pending Requests */}
                <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6 lg:mt-6 mt-0">

                  {/* Invite Links */}
                  {isApproved && (
                    <div className="group relative bg-gradient-to-br from-indigo-50/80 to-blue-50/80 dark:from-indigo-900/40 dark:to-blue-900/20 backdrop-blur-md rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] border border-indigo-100/50 dark:border-indigo-800/30 p-6 sm:p-8 transition-all duration-500 hover:shadow-[0_20px_40px_rgba(99,102,241,0.15)] overflow-hidden">
                      <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl transform translate-x-10 -translate-y-10 pointer-events-none group-hover:scale-125 transition-transform duration-700"></div>

                      <div className="relative z-10 flex flex-col gap-4">
                        <div className="flex flex-col">
                          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/80 dark:bg-slate-800/80 shadow-sm mb-4 group-hover:scale-110 group-hover:rotate-12 transition-all duration-300">
                            <span className="text-2xl bounce">✨</span>
                          </div>
                          <h3 className="text-xl font-extrabold text-indigo-950 dark:text-indigo-100 tracking-tight">
                            Share The Love
                          </h3>
                          <p className="mt-1 text-sm font-medium text-indigo-800/80 dark:text-indigo-200/80">
                            Send a link or share your family code so relatives can join easily.
                          </p>
                        </div>

                        <div className="w-full relative mt-2">
                          {userInfo?.familyCode && (
                            <div className="flex flex-col gap-3">
                              <button
                                type="button"
                                onClick={() => {
                                  const rawBaseUrl = import.meta.env.VITE_BASE_URL || window.location.origin;
                                  const baseUrl = /^https?:\/\//i.test(rawBaseUrl)
                                    ? rawBaseUrl
                                    : `https://${rawBaseUrl}`;
                                  const link = `${baseUrl.replace(/\/$/, "")}/edit-profile?familyCode=${userInfo.familyCode}`;
                                  navigator.clipboard
                                    .writeText(link)
                                    .then(() => {
                                      setInviteCopySuccess(true);
                                      setTimeout(() => setInviteCopySuccess(false), 2000);
                                    })
                                    .catch(() => {
                                      setInviteCopySuccess(false);
                                    });
                                }}
                                className="relative w-full flex items-center justify-center gap-2 px-6 py-3 text-sm font-bold text-indigo-700 dark:text-indigo-300 bg-white dark:bg-slate-800 rounded-2xl hover:bg-indigo-50 dark:hover:bg-slate-700 hover:scale-105 active:scale-95 transition-all duration-300 shadow-sm hover:shadow-md border border-indigo-100/50 dark:border-indigo-800/50"
                              >
                                <span>Copy Link</span>
                                <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                              </button>
                              <button
                                type="button"
                                onClick={() => navigate("/pending-request")}
                                className="w-full px-6 py-3 text-sm font-bold text-white bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 rounded-2xl hover:scale-105 active:scale-95 transition-all duration-300 shadow-[0_8px_20px_rgba(99,102,241,0.3)] hover:shadow-[0_12px_25px_rgba(99,102,241,0.4)]"
                              >
                                Invite Now
                              </button>
                            </div>
                          )}
                          {inviteCopySuccess && (
                            <div className="absolute -bottom-10 left-0 right-0 text-center text-[11px] font-bold tracking-wide text-emerald-700 dark:text-emerald-300 bg-emerald-100/90 dark:bg-emerald-900/50 py-2 px-4 rounded-full backdrop-blur-sm shadow-sm animate-bounce">
                              Invite link copied! 🎉
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Pending Requests List */}
                  {isAdmin && !pendingLoading && (
                    <div className="group relative bg-white/80 dark:bg-slate-900/80 backdrop-blur-md rounded-[2rem] shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)] border border-white dark:border-slate-800 p-6 sm:p-8 transition-all duration-300 hover:shadow-[0_15px_40px_rgba(0,0,0,0.08)] mt-2">
                      <div className="flex flex-col mb-4">
                        <div className="flex items-center justify-between w-full mb-2">
                          <h3 className="text-xl font-extrabold text-gray-900 dark:text-white flex items-center gap-3 tracking-tight">
                            <span className="relative flex h-3 w-3">
                              {pendingRequestsCount > 0 && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>}
                              <span className={`relative inline-flex rounded-full h-3 w-3 ${pendingRequestsCount > 0 ? "bg-red-500" : "bg-gray-400"}`}></span>
                            </span>
                            Pending Requests
                          </h3>
                        </div>
                        <p className={`text-sm font-medium ${pendingRequestsCount > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-500 dark:text-slate-400'}`}>
                          {pendingRequestsCount === 0
                            ? "No new requests to review"
                            : `${pendingRequestsCount} new request${pendingRequestsCount > 1 ? "s" : ""} waiting`}
                        </p>
                      </div>

                      {pendingRequestsList && pendingRequestsList.length > 0 && (
                        <div className="space-y-3 mb-4">
                          {pendingRequestsList.slice(0, 3).map((m) => (
                            <div
                              key={m.id}
                              className="group/item flex items-center justify-between p-3 rounded-2xl bg-gray-50/50 dark:bg-slate-800/50 border border-gray-100/50 dark:border-slate-700/50 hover:bg-white dark:hover:bg-slate-700 hover:shadow-md transition-all duration-300 hover:-translate-y-1 cursor-pointer"
                              onClick={() => navigate("/suggestion-approving")}
                            >
                              <div className="flex items-center space-x-3 min-w-0 flex-1">
                                <div className="w-10 h-10 rounded-full overflow-hidden bg-white dark:bg-slate-600 flex items-center justify-center text-[10px] font-bold text-gray-600 flex-shrink-0 shadow-sm border border-gray-100 dark:border-slate-600 group-hover/item:shadow-md transition-all duration-300 group-hover/item:scale-110">
                                  {m.profilePic ? (
                                    <img
                                      src={m.profilePic}
                                      alt={m.name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    m.name
                                      .split(" ")
                                      .map((part) => part[0])
                                      .join("")
                                      .slice(0, 2)
                                  )}
                                </div>
                                <span className="text-xs font-bold text-gray-800 dark:text-slate-100 truncate group-hover/item:text-blue-600 dark:group-hover/item:text-blue-400 transition-colors">
                                  {m.name}
                                </span>
                              </div>
                              <span className="ml-2 px-2.5 py-1 rounded-full text-[9px] font-bold tracking-wider uppercase bg-amber-100/80 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 group-hover/item:scale-105 transition-transform duration-300">
                                PENDING
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={() => navigate("/suggestion-approving")}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-50 dark:bg-slate-800/50 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-xl text-sm font-bold transition-colors shadow-sm border border-gray-100 dark:border-slate-700"
                      >
                        {pendingRequestsCount > 0 ? "Review All Requests" : "View Previous"}
                        <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          )}

          {isEditModalOpen && (
            <CreateFamilyModal
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              onFamilyCreated={() => { }}
              token={token}
              mode="edit"
              initialData={familyData}
            />
          )}
        </div>
      )}

      <CreateFamilyModal
        isOpen={isCreateFamilyModalOpen}
        onClose={() => setIsCreateFamilyModalOpen(false)}
        onFamilyCreated={handleFamilyCreated}
        token={token}
      />

      <JoinFamilyModal
        isOpen={isJoinFamilyModalOpen}
        onClose={() => setIsJoinFamilyModalOpen(false)}
        onFamilyJoined={handleFamilyJoined}
        token={token}
      />
    </div>
  );
};

export default FamilyManagementMobile;
