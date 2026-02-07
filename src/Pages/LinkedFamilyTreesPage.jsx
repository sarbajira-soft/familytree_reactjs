import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";
import { throwIfNotOk } from "../utils/apiMessages";

const LinkedFamilyTreesPage = () => {
  const navigate = useNavigate();
  const [linkedFamilies, setLinkedFamilies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [pendingLoading, setPendingLoading] = useState(false);

  const fetchLinkedFamilies = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("access_token");
      if (!token) {
        throw new Error("Unauthorized");
      }

      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
      const res = await fetch(`${baseUrl}/family/linked-families`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      await throwIfNotOk(res, { fallback: "We couldn’t load linked families right now." });
      const data = await res.json().catch(() => null);
      setLinkedFamilies(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to fetch linked families");
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      setPendingLoading(true);
      const token = localStorage.getItem("access_token");
      if (!token) throw new Error("Your session has expired. Please log in again.");

      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
      const res = await fetch(`${baseUrl}/family/tree-link-requests/sent`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      });

      await throwIfNotOk(res, { fallback: "We couldn’t load your pending link requests." });
      const data = await res.json().catch(() => null);
      const list = Array.isArray(data?.data) ? data.data : [];
      setPendingRequests(list);
    } catch (e) {
      setPendingRequests([]);
    } finally {
      setPendingLoading(false);
    }
  };

  useEffect(() => {
    fetchLinkedFamilies();
    fetchPendingRequests();
  }, []);

  const handleUnlinkFamily = async (otherFamilyCode) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      await Swal.fire({
        icon: "error",
        title: "Unauthorized",
        text: "Please login again",
      });
      return;
    }

    const result = await Swal.fire({
      icon: "warning",
      title: "Unlink this family?",
      text: "This will remove the linked-family connection and any linked cards created from it in your tree.",
      showCancelButton: true,
      confirmButtonText: "Yes, unlink",
      cancelButtonText: "Cancel",
    });

    if (!result.isConfirmed) return;

    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
    const res = await fetch(`${baseUrl}/family/unlink-linked-family`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ otherFamilyCode }),
    });
    await throwIfNotOk(res, { fallback: "We couldn’t unlink this family right now." });

    await Swal.fire({
      icon: "success",
      title: "Unlinked",
      text: "Linked family removed successfully",
    });
    await fetchLinkedFamilies();
  };

  const handleRevokeRequest = async (requestId) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      await Swal.fire({
        icon: "error",
        title: "Session expired",
        text: "Please log in again.",
      });
      return;
    }

    const confirm = await Swal.fire({
      icon: "warning",
      title: "Revoke this request?",
      text: "This will cancel the pending link request.",
      showCancelButton: true,
      confirmButtonText: "Yes, revoke",
      cancelButtonText: "Cancel",
    });
    if (!confirm.isConfirmed) return;

    const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:3001";
    const res = await fetch(`${baseUrl}/family/revoke-tree-link-request`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ treeLinkRequestId: Number(requestId) }),
    });
    await throwIfNotOk(res, { fallback: "We couldn’t revoke this request right now." });

    await Swal.fire({
      icon: "success",
      title: "Request revoked",
      text: "Your link request has been cancelled.",
    });
    await fetchPendingRequests();
  };

  return (
    <div className="w-full max-w-6xl mx-auto px-4 sm:px-6 py-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div>
          <div className="text-xl font-semibold text-gray-900 dark:text-slate-100">Linked Family Trees</div>
          <div className="text-sm text-gray-600 dark:text-slate-300">
            View families linked via Link Family Tree (does not merge trees).
          </div>
        </div>
        <button
          type="button"
          className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          onClick={() => navigate("/family-tree")}
        >
          My Birth Family Tree
        </button>
      </div>

      <div className="mb-6">
        <div className="text-lg font-semibold text-gray-900 dark:text-slate-100">
          Pending Link Requests
        </div>
        <div className="text-sm text-gray-600 dark:text-slate-300">
          These are the link requests you’ve sent and are still waiting for approval.
        </div>

        {pendingLoading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600" />
          </div>
        ) : pendingRequests.length === 0 ? (
          <div className="mt-3 p-4 rounded-lg bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
            <div className="text-gray-700 dark:text-slate-200 font-semibold">
              No pending link requests
            </div>
            <div className="text-sm text-gray-600 dark:text-slate-300">
              When you send a Link Tree request, it will appear here until it’s accepted or rejected.
            </div>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingRequests.map((req) => (
              <div
                key={req.id}
                className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm"
              >
                <div className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                  {req.receiverFamilyCode}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Relationship: {String(req.relationshipType || "").toUpperCase()}
                  {req.parentRole ? ` • ${String(req.parentRole).toUpperCase()}` : ""}
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Receiver: {req.receiverPerson?.name || "Unknown"} •{" "}
                  {String(req.receiverPerson?.nodeUid || "").slice(0, 8)}…
                </div>
                <div className="text-xs text-gray-500 dark:text-slate-400 mt-1">
                  Sent: {req.createdAt ? new Date(req.createdAt).toLocaleString() : "—"}
                </div>
                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    className="px-3 py-2 rounded-lg bg-red-600 text-white text-xs font-semibold hover:bg-red-700"
                    onClick={() => handleRevokeRequest(req.id)}
                  >
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-blue-600" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg bg-red-50 text-red-700 border border-red-200">
          {error}
        </div>
      ) : linkedFamilies.length === 0 ? (
        <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800">
          <div className="text-gray-700 dark:text-slate-200 font-semibold">No linked families yet</div>
          <div className="text-sm text-gray-600 dark:text-slate-300 mt-1">
            When you accept a Tree Link Request, it will appear here.
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {linkedFamilies.map((f) => (
            <div
              key={f.familyCode}
              className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 shadow-sm"
            >
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gray-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                  {f.familyPhoto ? (
                    <img
                      src={f.familyPhoto}
                      alt={f.familyName || f.familyCode}
                      className="h-12 w-12 object-cover"
                    />
                  ) : (
                    <span className="text-sm font-bold text-gray-600 dark:text-slate-200">
                      {(f.familyCode || "?").slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-gray-900 dark:text-slate-100 truncate">
                    {f.familyName || "Family"}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-slate-400 truncate">{f.familyCode}</div>
                </div>
              </div>

              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-semibold hover:bg-red-700 mr-2"
                  onClick={() => handleUnlinkFamily(String(f.familyCode || "").trim())}
                >
                  Unlink
                </button>
                <button
                  type="button"
                  className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-semibold hover:bg-green-700"
                  onClick={() => navigate(`/family-tree/${encodeURIComponent(String(f.familyCode || "").trim())}`)}
                >
                  View Birth Tree
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default LinkedFamilyTreesPage;
