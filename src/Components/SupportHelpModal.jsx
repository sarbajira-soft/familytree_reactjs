import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  FiAlertCircle,
  FiCopy,
  FiExternalLink,
  FiMail,
  FiX,
} from "react-icons/fi";

const REPORT_GUIDELINES = [
  "What happened",
  "Expected result",
  "Steps to reproduce",
  "Screenshot",
];

const CONTACT_GUIDELINES = [
  "Account help",
  "Family code",
  "General question",
];

const buildMailtoHref = ({ to, subject = "", body = "" }) => {
  const safeTo = String(to || "").trim();
  const query = [];

  if (subject) {
    query.push(`subject=${encodeURIComponent(subject)}`);
  }
  if (body) {
    query.push(`body=${encodeURIComponent(body)}`);
  }

  return `mailto:${safeTo}${query.length ? `?${query.join("&")}` : ""}`;
};

const copyText = async (value) => {
  const text = String(value || "");
  if (!text) return;

  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "readonly");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.appendChild(textArea);
  textArea.select();
  document.execCommand("copy");
  document.body.removeChild(textArea);
};

const formatPageSection = (path) => {
  const value = String(path || "").trim();
  return value || "";
};

const SupportHelpModal = ({
  isOpen,
  onClose,
  supportEmail,
  userInfo,
  currentPath,
  mode = "report",
}) => {
  const modalRef = useRef(null);
  const [feedback, setFeedback] = useState("");
  const [activeMode, setActiveMode] = useState(
    mode === "contact" ? "contact" : "report"
  );

  const isReportMode = activeMode === "report";

  const displayName = useMemo(() => {
    return (
      [userInfo?.firstName, userInfo?.lastName].filter(Boolean).join(" ").trim() ||
      userInfo?.name ||
      userInfo?.email ||
      ""
    );
  }, [userInfo]);

  const familyCode = useMemo(() => {
    return String(userInfo?.familyCode || userInfo?.pendingFamilyCode || "").trim();
  }, [userInfo]);

  const pageSection = useMemo(() => formatPageSection(currentPath), [currentPath]);

  const detailPills = useMemo(() => {
    return [
      familyCode ? `Family Code: ${familyCode}` : null,
      pageSection ? `Page: ${pageSection}` : null,
    ].filter(Boolean);
  }, [familyCode, pageSection]);

  const reportTemplate = useMemo(() => {
    return [
      "Subject: Issue Report - [Short Title]",
      `Name: ${displayName}`,
      `Family Code: ${familyCode}`,
      `Page/Section: ${pageSection}`,
      "What happened:",
      "What did you expect:",
      "Steps to reproduce:",
      "Device/Browser:",
      "Screenshot attached: Yes/No",
    ].join("\n");
  }, [displayName, familyCode, pageSection]);

  const reportEmailBody = useMemo(() => {
    return reportTemplate.split("\n").slice(1).join("\n");
  }, [reportTemplate]);

  const supportEmailHref = useMemo(() => {
    return buildMailtoHref({
      to: supportEmail,
      subject: "Support Request - Familyss",
    });
  }, [supportEmail]);

  const reportEmailHref = useMemo(() => {
    return buildMailtoHref({
      to: supportEmail,
      subject: "Issue Report - [Short Title]",
      body: reportEmailBody,
    });
  }, [reportEmailBody, supportEmail]);

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
    setActiveMode(mode === "contact" ? "contact" : "report");
    setFeedback("");
  }, [isOpen, mode]);

  useEffect(() => {
    setFeedback("");
  }, [activeMode]);

  useEffect(() => {
    if (!feedback) return undefined;
    const timer = window.setTimeout(() => setFeedback(""), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === modalRef.current) {
      onClose?.();
    }
  };

  const handleCopy = async (value, successMessage) => {
    try {
      await copyText(value);
      setFeedback(successMessage);
    } catch (error) {
      setFeedback("Unable to copy automatically. Please copy it manually.");
    }
  };

  const handleMailAction = (href, note) => {
    setFeedback(note);
    window.location.href = href;
  };

  return (
    <div
      ref={modalRef}
      className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 px-4 py-6 backdrop-blur-[2px]"
      onMouseDown={handleBackdropClick}
      role="dialog"
      aria-modal="true"
      aria-labelledby="support-help-title"
    >
      <div className="flex min-h-full items-center justify-center">
        <div className="w-full max-w-[44rem] rounded-[28px] border border-gray-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.20)] dark:border-slate-700 dark:bg-slate-900">
          <div className="px-5 pb-5 pt-5 sm:px-6 sm:pb-6">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3.5">
                <div
                  className={`mt-0.5 flex h-[48px] w-[48px] shrink-0 items-center justify-center rounded-[18px] ${
                    isReportMode
                      ? "bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300"
                      : "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300"
                  }`}
                >
                  {isReportMode ? <FiAlertCircle size={20} /> : <FiMail size={20} />}
                </div>

                <div className="min-w-0">
                  <h2
                    id="support-help-title"
                    className="text-[1.45rem] font-semibold leading-tight text-gray-900 dark:text-slate-100 sm:text-[1.65rem]"
                  >
                    {isReportMode ? "Report a Problem" : "Contact Us"}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => onClose?.()}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100"
                aria-label="Close support modal"
              >
                <FiX size={18} />
              </button>
            </div>

            {detailPills.length ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {detailPills.map((item) => (
                  <span
                    key={item}
                    className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-[11px] font-medium text-gray-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  >
                    {item}
                  </span>
                ))}
              </div>
            ) : null}

            {feedback ? (
              <div className="mt-4 rounded-2xl border border-primary-100 bg-primary-50 px-4 py-2.5 text-sm font-medium text-primary-700 dark:border-primary-500/20 dark:bg-primary-500/10 dark:text-primary-200">
                {feedback}
              </div>
            ) : null}

            <div className="mt-4 flex">
              <div className="grid w-full grid-cols-2 rounded-[18px] border border-gray-200 bg-gray-100/90 p-1 dark:border-slate-700 dark:bg-slate-800/90 sm:w-auto">
                <button
                  type="button"
                  onClick={() => setActiveMode("contact")}
                  className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold transition ${
                    !isReportMode
                      ? "bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300"
                      : "text-gray-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-900/60"
                  }`}
                >
                  <FiMail size={16} />
                  Contact Us
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMode("report")}
                  className={`inline-flex items-center justify-center gap-2 rounded-[14px] px-4 py-2.5 text-sm font-semibold transition ${
                    isReportMode
                      ? "bg-white text-red-600 shadow-sm dark:bg-slate-900 dark:text-red-300"
                      : "text-gray-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-900/60"
                  }`}
                >
                  <FiAlertCircle size={16} />
                  Report
                </button>
              </div>
            </div>

            {isReportMode ? (
              <section className="mt-4 rounded-[26px] border border-red-100 bg-gradient-to-br from-red-50 via-white to-white p-5 shadow-sm dark:border-red-400/20 dark:from-red-500/10 dark:via-slate-900 dark:to-slate-900">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-red-600 shadow-sm dark:bg-slate-900 dark:text-red-300">
                    <FiMail size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600/80 dark:text-red-300">
                      Send report to
                    </p>
                    <p className="mt-2 break-all text-[1.25rem] font-semibold leading-[1.12] text-gray-900 dark:text-slate-100 sm:text-[1.45rem]">
                      {supportEmail}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                      Best for bug reports and broken flows.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {REPORT_GUIDELINES.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-red-400/20 dark:bg-slate-900 dark:text-slate-200"
                    >
                      <span className="h-2 w-2 shrink-0 rounded-full bg-red-400 dark:bg-red-300" />
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(supportEmail, "Support email copied.")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FiCopy size={16} />
                    Copy Email
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleMailAction(
                        reportEmailHref,
                        "Opening your mail app with the report template."
                      )
                    }
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-red-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-red-700"
                  >
                    <FiExternalLink size={16} />
                    Open Report Draft
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(reportTemplate, "Report format copied.")}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-red-600 transition hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                >
                  <FiCopy size={15} />
                  Copy Format
                </button>
              </section>
            ) : (
              <section className="mt-4 rounded-[26px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-5 shadow-sm dark:border-blue-400/20 dark:from-blue-500/10 dark:via-slate-900 dark:to-slate-900">
                <div className="flex min-w-0 items-start gap-3.5">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-900 dark:text-blue-300">
                    <FiMail size={20} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-600/80 dark:text-blue-300">
                      Contact us
                    </p>
                    <p className="mt-2 break-all text-[1.25rem] font-semibold leading-[1.12] text-gray-900 dark:text-slate-100 sm:text-[1.45rem]">
                      {supportEmail}
                    </p>
                    <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
                      Fastest for everyday help.
                    </p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {CONTACT_GUIDELINES.map((item) => (
                    <span
                      key={item}
                      className="inline-flex items-center rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-medium text-gray-700 dark:border-blue-400/20 dark:bg-slate-900 dark:text-slate-200"
                    >
                      {item}
                    </span>
                  ))}
                </div>

                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(supportEmail, "Support email copied.")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium text-gray-700 transition hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <FiCopy size={16} />
                    Copy Email
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMailAction(supportEmailHref, "Opening your mail app.")}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary-600 px-4 py-3 text-sm font-medium text-white transition hover:bg-primary-700"
                  >
                    <FiExternalLink size={16} />
                    Open Mail App
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveMode("report")}
                  className="mt-3 inline-flex items-center gap-2 text-sm font-medium text-red-600 transition hover:text-red-700 dark:text-red-300 dark:hover:text-red-200"
                >
                  <FiAlertCircle size={15} />
                  Switch to Report
                </button>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportHelpModal;

