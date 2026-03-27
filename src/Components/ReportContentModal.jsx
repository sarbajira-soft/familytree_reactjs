import React, { useEffect, useMemo, useRef, useState } from "react";
import { FiX } from "react-icons/fi";
import { toast } from "react-toastify";

import { authFetchResponse } from "../utils/authFetch";

const DEFAULT_REASONS = [
  { value: "spam", label: "Spam" },
  { value: "foul_language", label: "Foul language" },
  { value: "nudity", label: "Nudity" },
  { value: "violence", label: "Violence" },
  { value: "other", label: "Other" },
];

const normalizeTargetType = (value) => {
  const t = String(value || "").trim().toLowerCase();
  if (t === "post" || t === "gallery" || t === "event") return t;
  return "post";
};

const normalizeTargetId = (value) => {
  const id = Number(value);
  if (!Number.isFinite(id) || Number.isNaN(id) || id <= 0) return null;
  return id;
};

const ReportContentModal = ({
  isOpen,
  onClose,
  targetType,
  targetId,
  targetLabel,
  reasons = DEFAULT_REASONS,
}) => {
  const modalRef = useRef(null);

  const normalizedType = useMemo(() => normalizeTargetType(targetType), [targetType]);
  const normalizedId = useMemo(() => normalizeTargetId(targetId), [targetId]);

  const [reason, setReason] = useState(reasons?.[0]?.value || "spam");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    if (typeof onClose !== "function") return;
    if (!window.__appModalBackStack) window.__appModalBackStack = [];

    const handler = () => {
      onClose();
    };

    window.__appModalBackStack.push(handler);

    return () => {
      const stack = window.__appModalBackStack;
      if (!Array.isArray(stack)) return;
      const idx = stack.lastIndexOf(handler);
      if (idx >= 0) stack.splice(idx, 1);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setReason(reasons?.[0]?.value || "spam");
    setDescription("");
    setSubmitting(false);
  }, [isOpen, reasons]);

  if (!isOpen) return null;

  const canSubmit = Boolean(normalizedId) && Boolean(String(reason || "").trim()) && !submitting;

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose?.();
    }
  };

  const handleSubmit = async () => {
    if (!normalizedId) {
      toast.error("Unable to report this content.");
      return;
    }

    if (!normalizedType || !["post", "gallery", "event"].includes(String(normalizedType))) {
      toast.error("Unable to report this content.");
      return;
    }

    const trimmedReason = String(reason || "").trim();
    const trimmedDescription = String(description || "").trim();

    if (!trimmedReason) {
      toast.error("Please select a reason.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await authFetchResponse("/report", {
        method: "POST",
        body: JSON.stringify({
          targetType: String(normalizedType).toLowerCase(),
          targetId: normalizedId,
          reason: trimmedReason,
          description: trimmedDescription || undefined,
        }),
      });

      const json = await response.json().catch(() => null);

      if (json?.alreadyReported) {
        toast.info(json?.message || "You already reported this content.");
      } else {
        toast.success(json?.message || "Report submitted.");
      }

      onClose?.();
    } catch (error) {
      toast.error(error?.message || "Unable to submit report.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-transparent px-4"
      onMouseDown={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white shadow-md">
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Report</h3>
            {targetLabel ? (
              <p className="text-xs text-gray-500">{targetLabel}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100"
            aria-label="Close"
          >
            <FiX />
          </button>
        </div>

        <div className="px-4 py-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
            >
              {(Array.isArray(reasons) ? reasons : DEFAULT_REASONS).map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Description (optional)</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-2 w-full resize-none rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary-500"
              placeholder="Add more details..."
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-3">
          <button
            type="button"
            onClick={() => onClose?.()}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="rounded-xl bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
            disabled={!canSubmit}
          >
            {submitting ? "Submitting..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportContentModal;
