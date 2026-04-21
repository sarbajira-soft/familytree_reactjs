import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Swal from 'sweetalert2';

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

const readRecoveryHint = () => {
  try {
    const raw = sessionStorage.getItem('accountRecoveryHint');
    if (!raw) return { identifier: '', purgeAfter: null };
    const parsed = JSON.parse(raw);
    return {
      identifier: String(parsed?.identifier || '').trim(),
      purgeAfter: parsed?.purgeAfter || null,
    };
  } catch (_) {
    return { identifier: '', purgeAfter: null };
  }
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const AccountRecoveryPage = () => {
  const navigate = useNavigate();
  const hint = useMemo(() => readRecoveryHint(), []);

  const [identifier, setIdentifier] = useState(hint.identifier);
  const [token, setToken] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [requestDone, setRequestDone] = useState(false);
  const [generatedToken, setGeneratedToken] = useState('');
  const [purgeAfter, setPurgeAfter] = useState(hint.purgeAfter);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [recoverable, setRecoverable] = useState(null);

  useEffect(() => {
    if (!purgeAfter) {
      setSecondsLeft(null);
      return;
    }

    const target = new Date(purgeAfter).getTime();
    if (!Number.isFinite(target)) {
      setSecondsLeft(null);
      return;
    }

    const update = () => {
      const delta = Math.floor((target - Date.now()) / 1000);
      setSecondsLeft(delta > 0 ? delta : 0);
    };

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [purgeAfter]);

  const validateIdentifier = (value) => {
    const normalized = String(value || '').trim();
    if (normalized.length < 3) return 'Identifier must be at least 3 characters.';

    if (normalized.includes('@')) {
      if (!emailRegex.test(normalized)) return 'Please enter a valid email address.';
      return '';
    }

    const digits = normalized.replaceAll(/\D/g, '');
    if (digits.length < 8) return 'Please enter a valid mobile number.';
    return '';
  };

  const validateToken = (value) => {
    const normalized = String(value || '').trim();
    if (normalized.length < 4) return 'Token must be at least 4 characters.';
    return '';
  };

  const formatCountdown = (secs) => {
    if (!Number.isFinite(secs) || secs < 0) return 'Unknown';
    const days = Math.floor(secs / 86400);
    const hours = Math.floor((secs % 86400) / 3600);
    const mins = Math.floor((secs % 3600) / 60);
    return `${days}d ${hours}h ${mins}m`;
  };

  const handleRequestToken = async (e) => {
    e.preventDefault();

    const normalized = String(identifier || '').trim();
    const identifierError = validateIdentifier(normalized);
    if (identifierError) {
      await Swal.fire({ icon: 'warning', title: 'Invalid Identifier', text: identifierError });
      return;
    }

    if (recoverable === false) {
      await Swal.fire({
        icon: 'warning',
        title: 'Account Not Recoverable',
        text: 'This account cannot be recovered.',
      });
      return;
    }

    setRequesting(true);
    try {
      const response = await fetch(`${apiBaseUrl}/user/account/recover/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalized }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'Failed to request recovery token.');
      }

      setRequestDone(true);
      setGeneratedToken(String(json?.token || '').trim());
      sessionStorage.setItem(
        'accountRecoveryHint',
        JSON.stringify({
          identifier: normalized,
          purgeAfter: purgeAfter || null,
        }),
      );
      await Swal.fire({
        icon: 'success',
        title: 'Recovery Token Sent',
        text: json?.message || 'If the account is recoverable, a token has been sent.',
      });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Request Failed',
        text: error?.message || 'Unable to request recovery token.',
      });
    } finally {
      setRequesting(false);
    }
  };

  const handleCheckStatus = async (options = {}) => {
    const { silent = false } = options;
    const normalized = String(identifier || '').trim();
    const identifierError = validateIdentifier(normalized);
    if (identifierError) {
      if (!silent) {
        await Swal.fire({ icon: 'warning', title: 'Invalid Identifier', text: identifierError });
      }
      return;
    }

    setCheckingStatus(true);
    try {
      const response = await fetch(`${apiBaseUrl}/user/account/recover/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalized }),
      });
      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'Unable to check recovery window.');
      }

      const nextRecoverable = json?.data?.recoverable === true;
      setRecoverable(nextRecoverable);

      const nextPurgeAfter = nextRecoverable ? (json?.data?.recoveryWindowEndsAt || null) : null;
      setPurgeAfter(nextPurgeAfter);
      sessionStorage.setItem(
        'accountRecoveryHint',
        JSON.stringify({
          identifier: normalized,
          purgeAfter: nextPurgeAfter,
        }),
      );

      if (!silent) {
        await Swal.fire({
          icon: nextRecoverable && nextPurgeAfter ? 'info' : 'warning',
          title: nextRecoverable && nextPurgeAfter ? 'Recovery Window Found' : 'Account Not Recoverable',
          text: nextRecoverable && nextPurgeAfter
            ? `Recovery available until ${new Date(nextPurgeAfter).toLocaleString()}.`
            : 'No recoverable account was found for this identifier.',
        });
      }
    } catch (error) {
      if (!silent) {
        await Swal.fire({
          icon: 'error',
          title: 'Status Check Failed',
          text: error?.message || 'Unable to check recovery status.',
        });
      }
    } finally {
      setCheckingStatus(false);
    }
  };

  useEffect(() => {
    if (!identifier) return;
    handleCheckStatus({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConfirmToken = async (e) => {
    e.preventDefault();

    if (recoverable === false) {
      await Swal.fire({
        icon: 'warning',
        title: 'Account Not Recoverable',
        text: 'This account cannot be recovered.',
      });
      return;
    }

    const normalizedIdentifier = String(identifier || '').trim();
    const identifierError = validateIdentifier(normalizedIdentifier);
    if (identifierError) {
      await Swal.fire({ icon: 'warning', title: 'Invalid Identifier', text: identifierError });
      return;
    }

    const normalizedToken = String(token || '').trim();
    const tokenError = validateToken(normalizedToken);
    if (tokenError) {
      await Swal.fire({ icon: 'warning', title: 'Invalid Token', text: tokenError });
      return;
    }

    setConfirming(true);
    try {
      const response = await fetch(`${apiBaseUrl}/user/account/recover/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: normalizedIdentifier, token: normalizedToken }),
      });

      const json = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(json?.message || 'Failed to recover account.');
      }

      sessionStorage.removeItem('accountRecoveryHint');
      await Swal.fire({
        icon: 'success',
        title: 'Account Recovered',
        text: json?.message || 'Your account has been recovered. Please login again.',
      });
      navigate('/login', { replace: true });
    } catch (error) {
      await Swal.fire({
        icon: 'error',
        title: 'Recovery Failed',
        text: error?.message || 'Unable to recover account.',
      });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <h1 className="text-2xl font-bold text-gray-900">Account Recovery</h1>
      <p className="text-sm text-gray-600 mt-2">
        Recover a deleted account within the 60-day window.
      </p>

        {recoverable === false ? (
          <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
            <p className="text-xs text-gray-600 font-semibold uppercase tracking-wide">Recovery Unavailable</p>
            <p className="text-sm text-gray-800 mt-1">This account is not eligible for recovery.</p>
          </div>
        ) : purgeAfter ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
            <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Recovery Window</p>
            <p className="text-sm text-amber-900 mt-1">
              Ends on: {new Date(purgeAfter).toLocaleString()}
            </p>
            {secondsLeft !== null && (
              <p className="text-sm text-amber-900">Time left: {formatCountdown(secondsLeft)}</p>
            )}
          </div>
        ) : null}

        <form onSubmit={handleRequestToken} className="mt-6 space-y-3">
          <label className="block text-sm font-medium text-gray-700">Email or Mobile</label>
          <input
            type="text"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="Enter account email or mobile"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            disabled={requesting}
          />
          <button
            type="submit"
            disabled={requesting || recoverable === false}
            className="w-full rounded-lg bg-primary-600 text-white font-semibold py-2.5 hover:bg-primary-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {requesting ? 'Sending...' : 'Send Recovery Token'}
          </button>
          <button
            type="button"
            disabled={checkingStatus}
            onClick={() => handleCheckStatus({ silent: false })}
            className="w-full rounded-lg border border-gray-300 bg-white text-gray-700 font-semibold py-2.5 hover:bg-gray-50 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {checkingStatus ? 'Checking...' : 'Check Recovery Window'}
          </button>
        </form>

        <form onSubmit={handleConfirmToken} className="mt-5 space-y-3">
          <label className="block text-sm font-medium text-gray-700">Recovery Token</label>
          <input
            id="token"
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={token}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, ''); // allow only digits
              if (val.length <= 8) setToken(val);
            }}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]"
            placeholder="Enter recovery token"
            disabled={confirming}
          />
          {/* <input
            type="number"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="Enter recovery token"
            className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300"
            disabled={confirming}
          /> */}
          {requestDone && generatedToken && (
            <p className="text-xs text-gray-500">
              Token fallback (non-email flow): <span className="font-semibold">{generatedToken}</span>
            </p>
          )}
          <button
            type="submit"
            disabled={confirming || recoverable === false}
            className="w-full rounded-lg bg-emerald-600 text-white font-semibold py-2.5 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {confirming ? 'Recovering...' : 'Recover Account'}
          </button>
        </form>

        <div className="mt-6 text-sm text-gray-600 flex items-center justify-between">
          <Link to="/login" className="text-primary-600 hover:text-primary-700 font-semibold">
            Back to Login
          </Link>
          <span>After recovery, re-request family join.</span>
        </div>
    </>
  );
};

export default AccountRecoveryPage;
