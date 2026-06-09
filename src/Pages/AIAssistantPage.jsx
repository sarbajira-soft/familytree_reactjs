import React, { useState, useEffect } from "react";
import {
  FiFileText,
  FiImage,
  FiCalendar,
  FiUser,
  FiCopy,
  FiCheck,
  FiTrash2,
  FiClock,
  FiInfo,
} from "react-icons/fi";
import { Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "../utils/authFetch";

const AIAssistantPage = () => {
  const [activeTab, setActiveTab] = useState("caption"); // caption | description | bio | event
  const [keywords, setKeywords] = useState({
    caption: "",
    description: "",
    bio: "",
    event: "",
  });
  const [results, setResults] = useState({
    caption: "",
    description: "",
    bio: "",
    event: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [history, setHistory] = useState([]);

  // Load history from localStorage on mount
  useEffect(() => {
    try {
      const savedHistory = localStorage.getItem("ai_generation_history");
      if (savedHistory) {
        setHistory(JSON.parse(savedHistory));
      }
    } catch (e) {
      console.error("Failed to load AI history:", e);
    }
  }, []);

  // Save history helper
  const saveToHistory = (type, keywordInput, outputText) => {
    const newItem = {
      id: Date.now(),
      type,
      keywords: keywordInput,
      output: outputText,
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    };
    const updated = [newItem, ...history].slice(0, 50); // Limit to last 50 items
    setHistory(updated);
    try {
      localStorage.setItem("ai_generation_history", JSON.stringify(updated));
    } catch (e) {
      console.error("Failed to save AI history:", e);
    }
  };

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear your generation history?")) {
      setHistory([]);
      try {
        localStorage.removeItem("ai_generation_history");
        toast.success("History cleared.");
      } catch (e) {}
    }
  };

  const handleGenerate = async () => {
    const textInput = keywords[activeTab].trim();

    if (!textInput) {
      toast.warn("Please enter a few keywords first.");
      return;
    }

    if (textInput.length > 150) {
      toast.warn("Keywords input must be 150 characters or less.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authFetch("/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          keywords: textInput,
          type: activeTab,
        }),
      });

      if (res && res.text) {
        setResults((prev) => ({
          ...prev,
          [activeTab]: res.text,
        }));
        saveToHistory(activeTab, textInput, res.text);
        toast.success("AI Content Generated!");
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to generate AI content. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const getPlaceholderText = () => {
    switch (activeTab) {
      case "caption":
        return "e.g., birthday reunion cake cousins laughing";
      case "description":
        return "e.g., summer 1995 Kerala trip grandma house";
      case "bio":
        return "e.g., loves cooking gardening genealogy photography";
      case "event":
        return "e.g., annual family picnic food games garden";
      default:
        return "Type keywords here...";
    }
  };

  const getTabLabel = (tab) => {
    switch (tab) {
      case "caption":
        return "Post Caption";
      case "description":
        return "Gallery Description";
      case "bio":
        return "Profile Bio";
      case "event":
        return "Event Details";
      default:
        return "";
    }
  };

  const getTabIcon = (tab, size = 16) => {
    switch (tab) {
      case "caption":
        return <FiFileText size={size} />;
      case "description":
        return <FiImage size={size} />;
      case "bio":
        return <FiUser size={size} />;
      case "event":
        return <FiCalendar size={size} />;
      default:
        return null;
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-gray-50 dark:bg-slate-950 text-gray-800 dark:text-slate-100 overflow-hidden font-sans">
      {/* 1. Main Generator Area */}
      <div className="flex-1 flex flex-col p-4 md:p-8 overflow-y-auto max-w-4xl mx-auto custom-scrollbar">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow">
              <Sparkles size={16} />
            </div>
            <h1 className="text-2xl font-bold tracking-tight">AI Writing Assistant</h1>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400">
            Generate compliant, engaging, and GDPR-safe text for your family posts, albums, events, and bios.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-6 bg-gray-150 dark:bg-slate-900/60 p-1 rounded-xl">
          {["caption", "description", "event", "bio"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                activeTab === tab
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                  : "text-gray-500 hover:text-gray-700 dark:hover:text-slate-350"
              }`}
            >
              {getTabIcon(tab)}
              {getTabLabel(tab)}
            </button>
          ))}
        </div>

        {/* Content Generator Card */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-md mb-6 space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500">
                Input Keywords
              </label>
              <span className={`text-xs ${keywords[activeTab].length > 150 ? "text-red-500" : "text-gray-400"}`}>
                {keywords[activeTab].length} / 150
              </span>
            </div>

            <textarea
              className="w-full p-4 bg-gray-55 border border-gray-200 dark:border-slate-700 dark:bg-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm sm:text-base resize-none h-28 transition-all duration-150 placeholder-gray-400"
              placeholder={getPlaceholderText()}
              value={keywords[activeTab]}
              maxLength={150}
              onChange={(e) =>
                setKeywords((prev) => ({
                  ...prev,
                  [activeTab]: e.target.value,
                }))
              }
            />

            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-950 p-2.5 rounded-lg border border-gray-150 dark:border-slate-900">
              <FiInfo size={13} className="text-indigo-500 flex-shrink-0" />
              <span>
                <strong>Tip:</strong> Avoid using real names of family members (e.g. use "grandma", "sibling", or "cousins").
              </span>
            </div>
          </div>

          <button
            onClick={handleGenerate}
            disabled={isLoading || !keywords[activeTab].trim()}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Sparkles size={16} />
                Generate {getTabLabel(activeTab)}
              </>
            )}
          </button>
        </div>

        {/* Generated Output */}
        <div className="bg-white dark:bg-slate-900 border border-gray-200/80 dark:border-slate-800/80 rounded-2xl p-5 md:p-6 shadow-md space-y-4">
          <label className="text-xs font-bold uppercase tracking-wider text-gray-400 dark:text-slate-500 block">
            Generated Output
          </label>

          {results[activeTab] ? (
            <div className="relative p-4 bg-indigo-50/30 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl">
              <p className="text-sm leading-relaxed whitespace-pre-wrap pr-10">{results[activeTab]}</p>
              <button
                onClick={() => handleCopy(results[activeTab], activeTab)}
                className="absolute top-3 right-3 p-2 hover:bg-indigo-50 dark:hover:bg-slate-800 rounded-lg text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                title="Copy to clipboard"
              >
                {copiedIndex === activeTab ? <FiCheck className="text-green-500 w-4 h-4" /> : <FiCopy className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <div className="py-10 text-center border border-dashed border-gray-200 dark:border-slate-800 rounded-xl">
              <p className="text-xs text-gray-400 dark:text-slate-500 italic">
                Generated suggestions will appear here. Enter keywords above and click generate!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 2. History Sidebar */}
      <div className="hidden lg:flex flex-col w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 flex-shrink-0">
        <div className="p-4 border-b border-gray-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="font-bold text-sm flex items-center gap-1.5 text-gray-800 dark:text-white">
            <FiClock size={16} className="text-indigo-500" />
            Recently Generated
          </h3>
          {history.length > 0 && (
            <button
              onClick={clearHistory}
              className="p-1 text-gray-400 hover:text-red-500 rounded transition"
              title="Clear all"
            >
              <FiTrash2 size={14} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
          {history.length === 0 ? (
            <div className="h-full flex flex-col justify-center items-center text-center text-gray-400 dark:text-slate-500">
              <FiClock size={24} className="mb-2 opacity-50" />
              <p className="text-xs italic">No generations yet.</p>
            </div>
          ) : (
            history.map((item, idx) => (
              <div
                key={item.id}
                className="p-3 bg-gray-50 dark:bg-slate-950 border border-gray-150 dark:border-slate-900 rounded-xl relative group hover:border-indigo-300 dark:hover:border-indigo-800 transition"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 font-semibold px-2 py-0.5 rounded-full flex items-center gap-1">
                    {getTabIcon(item.type, 10)}
                    {getTabLabel(item.type)}
                  </span>
                  <span className="text-[9px] text-gray-400">{item.date}</span>
                </div>
                <p className="text-[10px] text-gray-400 mb-1.5 truncate">
                  <strong>Keywords:</strong> "{item.keywords}"
                </p>
                <p className="text-xs text-gray-700 dark:text-slate-300 line-clamp-3 leading-relaxed">
                  {item.output}
                </p>

                <button
                  onClick={() => handleCopy(item.output, idx)}
                  className="absolute top-2.5 right-2.5 opacity-0 group-hover:opacity-100 p-1.5 bg-white dark:bg-slate-900 border border-gray-150 dark:border-slate-800 hover:text-indigo-600 rounded shadow-sm transition"
                  title="Copy output"
                >
                  {copiedIndex === idx ? <FiCheck className="text-green-500 w-3.5 h-3.5" /> : <FiCopy className="w-3.5 h-3.5" />}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default AIAssistantPage;
