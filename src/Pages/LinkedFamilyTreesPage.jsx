import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Swal from "sweetalert2";

const LinkedFamilyTreesPage = () => {
  const navigate = useNavigate();
  const [linkedFamilies, setLinkedFamilies] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || "Failed to fetch linked families");
      }

      setLinkedFamilies(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || "Failed to fetch linked families");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLinkedFamilies();
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

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      await Swal.fire({
        icon: "error",
        title: "Unlink Failed",
        text: data?.message || "Failed to unlink",
      });
      return;
    }

    await Swal.fire({
      icon: "success",
      title: "Unlinked",
      text: "Linked family removed successfully",
    });
    await fetchLinkedFamilies();
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
