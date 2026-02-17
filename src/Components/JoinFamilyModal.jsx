import React, { useEffect, useMemo, useState } from 'react';
import { FiX, FiUsers } from 'react-icons/fi';
import Swal from 'sweetalert2';
import { jwtDecode } from 'jwt-decode';

import { getToken } from '../utils/auth';
import { authFetchResponse } from '../utils/authFetch';

const JoinFamilyModal = ({ isOpen, onClose, token, onFamilyJoined }) => {
  const [familyCodeDigits, setFamilyCodeDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestedFamilies, setSuggestedFamilies] = useState([]);
  const [activeTab, setActiveTab] = useState('suggested');

  const extractDigits = (val) => String(val || '').replace(/\D+/g, '');
  const formatFamilyCode = (digits) => {
    const d = extractDigits(digits).slice(0, 6);
    return d.length ? `FAM${d}` : '';
  };
  const formattedFamilyCode = useMemo(
    () => formatFamilyCode(familyCodeDigits),
    [familyCodeDigits],
  );

  const accessToken = useMemo(() => getToken(), []);

  const currentUserId = useMemo(() => {
    try {
      if (!accessToken) return null;
      const decoded = jwtDecode(accessToken);
      return decoded?.id || decoded?.userId || decoded?.sub || null;
    } catch (_) {
      return null;
    }
  }, [accessToken]);

  useEffect(() => {
    if (!isOpen) return;
    setFamilyCodeDigits('');
    setSuggestedFamilies([]);
    setActiveTab('suggested');

    const loadSuggestedFamilies = async () => {
      if (!accessToken || !currentUserId) return;
      setSuggestionsLoading(true);
      try {
        const res = await authFetchResponse(
          `/family/member/suggest-family/${currentUserId}`,
          {
            method: 'GET',
            skipThrow: true,
            headers: {
              accept: 'application/json',
            },
          }
        );
        if (!res.ok) {
          setSuggestedFamilies([]);
          return;
        }

        const json = await res.json();
        const data = json?.data || [];
        const list = Array.isArray(data) ? data : [];
        setSuggestedFamilies(list);
        if (list.length === 0) {
          setActiveTab('code');
        }
      } catch (_) {
        setSuggestedFamilies([]);
        setActiveTab('code');
      } finally {
        setSuggestionsLoading(false);
      }
    };

    loadSuggestedFamilies();
  }, [isOpen, accessToken, currentUserId]);

  const requestJoinFamily = async (codeToJoin) => {
    if (!codeToJoin || !String(codeToJoin).trim()) {
      throw new Error('familyCode is required');
    }

    if (!accessToken || !currentUserId) {
      throw new Error('User ID not found');
    }

    const familyCodeNormalized = String(codeToJoin).trim().toUpperCase();

    const res = await authFetchResponse(`/family/member/request-join`, {
      method: 'POST',
      skipThrow: true,
      body: JSON.stringify({
        memberId: currentUserId,
        familyCode: familyCodeNormalized,
        approveStatus: 'pending',
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const message = json?.message || 'Failed to send join request';
      throw new Error(typeof message === 'string' ? message : 'Failed to send join request');
    }
    return json;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const digits = extractDigits(familyCodeDigits);
    if (digits.length !== 6) {
      Swal.fire({
        icon: 'error',
        title: 'Family Code Required',
        text: 'Please enter a valid 6-digit family code to join.',
      });
      return;
    }

    setLoading(true);
    try {
      await requestJoinFamily(formatFamilyCode(digits));

      await Swal.fire({
        icon: 'success',
        title: 'Your Request Sent',
        text: 'Your request was sent to the family admins for approval.',
        confirmButtonColor: '#3f982c'
      });

      if (typeof onFamilyJoined === 'function') {
        onFamilyJoined();
      }
      onClose();
    } catch (err) {
      Swal.fire({ 
        icon: 'error', 
        title: 'Failed to send join request', 
        text: err?.message || 'Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 font-inter">
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        role="button"
        tabIndex={-1}
        aria-label="Close"
      />

      <div className="relative min-h-full flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
          <div className="relative px-6 pt-6 pb-4 border-b border-gray-100">
            <button
              onClick={onClose}
              className="bg-unset absolute top-4 right-4 text-gray-500 hover:text-gray-700"
              aria-label="Close"
              type="button"
            >
              <FiX size={22} />
            </button>

            <div className="flex items-start gap-4">
              <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center flex-shrink-0">
                <FiUsers className="text-2xl text-primary-600" />
              </div>
              <div className="min-w-0">
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900">Join a family</h2>
                <p className="text-sm text-gray-600 mt-1">
                  Pick from suggestions or enter a family code.
                </p>
              </div>
            </div>

            <div className="mt-4">
              <div className="inline-flex w-full rounded-xl bg-gray-50 p-1 border border-gray-100">
                <button
                  type="button"
                  onClick={() => setActiveTab('suggested')}
                  className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition ${
                    activeTab === 'suggested'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Suggested
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('code')}
                  className={`flex-1 px-3 py-2 text-sm font-semibold rounded-lg transition ${
                    activeTab === 'code'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  Enter code
                </button>
              </div>
            </div>
          </div>

          <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
            {activeTab === 'suggested' ? (
              <div>
                {suggestionsLoading ? (
                  <div className="space-y-3">
                    <div className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                    <div className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                    <div className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                  </div>
                ) : suggestedFamilies.length === 0 ? (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm font-semibold text-gray-900">No suggestions found</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Add parent/spouse details in your profile to get better suggestions, or use the family code.
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('code')}
                      className="mt-3 text-sm font-semibold text-primary-700"
                    >
                      Enter family code
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {suggestedFamilies.map((fam) => {
                      const code = fam?.familyCode || '';
                      const name = fam?.familyName || 'Family';
                      const matchedNames = Array.isArray(fam?.matchedNames)
                        ? fam.matchedNames.filter(Boolean)
                        : [];
                      const matchCount = fam?.matchCount ?? matchedNames.length;
                      return (
                        <button
                          key={code}
                          type="button"
                          onClick={() => {
                            const pickedDigits = extractDigits(code).slice(0, 6);
                            setFamilyCodeDigits(pickedDigits);
                            setActiveTab('code');
                          }}
                          className="w-full text-left border border-gray-200 rounded-2xl px-4 py-3 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-gray-900 truncate">
                                {name}
                              </div>
                              <div className="text-xs text-gray-600 mt-0.5 truncate">
                                Family code: {formatFamilyCode(extractDigits(code))}
                              </div>
                              {matchCount ? (
                                <div className="text-[11px] text-gray-500 mt-1 truncate">
                                  Match score: {matchCount}
                                  {matchedNames.length > 0
                                    ? ` • ${matchedNames.slice(0, 3).join(', ')}`
                                    : ''}
                                </div>
                              ) : null}
                            </div>
                            <span className="text-xs font-semibold text-primary-700 bg-primary-50 border border-primary-100 px-2 py-1 rounded-lg">
                              Use
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block mb-2 text-sm font-semibold text-gray-800">
                      Family code
                    </label>
                    <input
                      type="text"
                      value={familyCodeDigits}
                      onChange={(e) => setFamilyCodeDigits(extractDigits(e.target.value).slice(0, 6))}
                      required
                      className="w-full border border-gray-300 rounded-xl px-4 py-3 focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter family code"
                      maxLength={6}
                      inputMode="numeric"
                      autoComplete="off"
                    />

                    <div className="text-xs text-gray-600 mt-2">
                      Full code: <span className="font-semibold">{formattedFamilyCode || 'FAM______'}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Ask the family administrator for the family code.
                    </p>
                  </div>

                  <div className="rounded-2xl border border-primary-100 bg-primary-50 p-4">
                    <div className="text-sm font-semibold text-primary-900">What happens next?</div>
                    <ul className="text-sm text-primary-800 mt-2 space-y-1">
                      <li>1) Your request goes to the family admin</li>
                      <li>2) You’ll get a notification after approval</li>
                      <li>3) You can request to join another family while waiting</li>
                    </ul>
                  </div>

                  <div className="sticky bottom-0 bg-white pt-2">
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-900 py-3 rounded-xl font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={loading || extractDigits(familyCodeDigits).length !== 6}
                        className="flex-1 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-400 text-white py-3 rounded-xl font-semibold transition-colors"
                      >
                        {loading ? 'Sending...' : 'Request to join'}
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinFamilyModal;