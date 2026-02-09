import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useUser } from "../Contexts/UserContext";
import FamilyOverView from "../Components/FamilyOverView";
import FamilyView from "../Components/FamilyView";
import CreateFamilyModal from "../Components/CreateFamilyModal";
import JoinFamilyModal from "../Components/JoinFamilyModal";
import NoFamilyView from "../Components/NoFamilyView";
import PendingApprovalView from "../Components/PendingApprovalView";

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
  const [pendingLoading, setPendingLoading] = useState(false);
  const [inviteCopySuccess, setInviteCopySuccess] = useState(false);

  useEffect(() => {
    const storedToken = localStorage.getItem("access_token");
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
        const res = await fetch(`${baseUrl}/family/code/${userInfo.familyCode}`, {
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
      const token = localStorage.getItem("access_token");
      if (!token) {
        setMembersPreview([]);
        return;
      }
      try {
        setMembersLoading(true);
        const res = await fetch(`${baseUrl}/family/member/${userInfo.familyCode}`, {
          headers: {
            Authorization: `Bearer ${token}`,
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
      const token = localStorage.getItem("access_token");
      if (!token) {
        setPendingRequestsCount(null);
        return;
      }
      try {
        setPendingLoading(true);
        const res = await fetch(
          `${baseUrl}/notifications/${userInfo.familyCode}/join-requests`,
          {
            headers: {
              accept: "application/json",
              Authorization: `Bearer ${token}`,
            },
            signal,
          }
        );
        if (!res.ok) {
          setPendingRequestsCount(null);
          return;
        }
        const json = await res.json();
        const list = json?.data || [];
        const pending = list.filter((item) => item.status === "pending");
        setPendingRequestsCount(pending.length);
      } catch (_) {
        if (!signal.aborted) {
          setPendingRequestsCount(null);
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
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-4 pb-24">
          <div className="md:hidden mb-4">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-50">
              Family Management
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
              Quickly access all family-related tools from a single place.
            </p>
          </div>

          {hasFamily && (
            <div className="mb-5 space-y-3">
              {familyLoading ? (
                <div className="h-40 rounded-3xl bg-white/60 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 animate-pulse" />
              ) : (
                familyData && (
                  <>
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
                  </>
                )
              )}

              <FamilyOverView
                familyCode={userInfo.familyCode}
                token={localStorage.getItem("access_token")}
              />

              {membersLoading ? (
                <div className="h-16 rounded-2xl bg-white/60 dark:bg-slate-900/40 border border-gray-100 dark:border-slate-800 animate-pulse" />
              ) : (
                membersPreview.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 px-4 py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                          Members
                        </div>
                        <div className="mt-1 flex -space-x-2">
                          {membersPreview.map((m) => (
                            <div
                              key={m.id}
                              className="w-8 h-8 rounded-full border-2 border-white dark:border-slate-900 overflow-hidden bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600"
                            >
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
                          ))}
                        </div>
                        <div className="mt-0.5 text-[11px] text-gray-600 dark:text-slate-300">
                          A quick snapshot of your family.
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate("/my-family-member")}
                        className="ml-3 text-xs bg-white font-semibold text-primary-600 dark:text-primary-400"
                      >
                        Manage
                      </button>
                    </div>

                    {membersList.length > 0 && (
                      <div className="mt-3 border-t border-gray-100 dark:border-slate-800 pt-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                            Members list
                          </span>
                          <span className="text-[11px] text-gray-500 dark:text-slate-400">
                            Showing {Math.min(membersList.length, 5)} of {membersList.length}
                          </span>
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {membersList.slice(0, 5).map((m) => (
                            <div
                              key={m.id}
                              className="flex items-center justify-between py-1.5"
                            >
                              <div className="flex items-center space-x-2 min-w-0">
                                <div className="w-7 h-7 rounded-full overflow-hidden bg-gray-100 flex items-center justify-center text-[10px] font-semibold text-gray-600 flex-shrink-0">
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
                                <span className="text-xs font-medium text-gray-800 dark:text-slate-100 truncate">
                                  {m.name}
                                </span>
                              </div>
                              <span
                                className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  m.status === "approved"
                                    ? "bg-green-50 text-green-700 border border-green-100"
                                    : m.status === "pending"
                                    ? "bg-amber-50 text-amber-700 border border-amber-100"
                                    : "bg-gray-50 text-gray-600 border border-gray-100"
                                }`}
                              >
                                {m.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              )}

              {/* Invite Links */}
              {isApproved && (
                <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-col sm:flex-row sm:items-center">
                  <div className="flex-1">
                    <div className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                      Invite links
                    </div>
                    <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-slate-50">
                      Share your family invite
                    </div>
                    <div className="mt-1 text-xs text-gray-600 dark:text-slate-300">
                      Send a link or share your family code so relatives can join easily.
                    </div>
                  </div>
                  <div className="w-full sm:w-72 mt-2 sm:mt-0">
                    {userInfo?.familyCode && (
                      <div className="flex flex-col sm:flex-row gap-2">
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
                          className="flex-1 text-xs font-semibold text-primary-600 dark:text-primary-400 border border-primary-100 dark:border-primary-900 rounded-lg px-3 py-2 bg-primary-50/60 dark:bg-primary-950/40 hover:bg-primary-50 dark:hover:bg-primary-900/60 transition-colors"
                        >
                          Copy invite link
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate("/pending-request")}
                          className="w-full sm:w-auto text-xs font-semibold text-white bg-secondary-500 hover:bg-primary-700 rounded-lg px-3 py-2 transition-colors"
                        >
                          Invite
                        </button>
                      </div>
                    )}
                    {inviteCopySuccess && (
                      <div className="mt-1 text-[11px] text-green-600 dark:text-green-400">
                        Invite link copied to clipboard
                      </div>
                    )}
                  </div>
                </div>
                </div>
              )}

            {isAdmin && !pendingLoading && pendingRequestsCount != null && (
              <button
                type="button"
                onClick={() => navigate("/suggestion-approving")}
                className="w-full flex items-center justify-between bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-gray-100 dark:border-slate-800 px-4 py-3 active:scale-[0.99] transition-transform"
              >
                <div>
                  <div className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                    Pending requests
                  </div>
                  <div className="mt-0.5 text-sm font-semibold text-gray-900 dark:text-slate-50">
                    {pendingRequestsCount === 0
                      ? "No pending join requests"
                      : `${pendingRequestsCount} pending join request${
                          pendingRequestsCount > 1 ? "s" : ""
                        }`}
                  </div>
                </div>
                <span className="ml-3 text-xs font-semibold text-primary-600 dark:text-primary-400">
                  Manage
                </span>
              </button>
            )}
            </div>
          )}

          {isEditModalOpen && (
            <CreateFamilyModal
              isOpen={isEditModalOpen}
              onClose={() => setIsEditModalOpen(false)}
              onFamilyCreated={() => {}}
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
