import React, { useState } from "react";
import { FiLoader } from "react-icons/fi";
import { Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import { authFetch } from "../utils/authFetch";

const AITextareaHelper = ({ value, onChange, type, disabled = false }) => {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const keywords = String(value || "").trim();

    if (!keywords) {
      toast.warn("Please enter a few keywords first (e.g., birthday reunion summer)");
      return;
    }

    if (keywords.length > 150) {
      toast.warn("AI input keywords cannot exceed 150 characters.");
      return;
    }

    setLoading(true);

    try {
      const res = await authFetch("/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          keywords,
          type,
        }),
      });

      if (res && res.text) {
        const limit = 250;
        let processedText = res.text;
        if (processedText.length > limit) {
          const sub = processedText.slice(0, limit);
          const lastSentenceEnd = Math.max(
            sub.lastIndexOf("."),
            sub.lastIndexOf("!"),
            sub.lastIndexOf("?")
          );
          if (lastSentenceEnd >= 100) {
            processedText = sub.slice(0, lastSentenceEnd + 1).trim();
          } else {
            const lastSpace = sub.lastIndexOf(" ");
            processedText = lastSpace !== -1 ? sub.slice(0, lastSpace).trim() + "..." : sub;
          }
        }
        onChange(processedText);
        toast.success("AI Content Generated!");
      } else {
        throw new Error("Invalid response format from AI assistant");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to generate content. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const getTooltipText = () => {
    switch (type) {
      case "caption":
        return "Write Caption with AI";
      case "description":
        return "Write Description with AI";
      case "bio":
        return "Generate Bio with AI";
      case "event":
        return "Generate Event Details with AI";
      default:
        return "Generate with AI";
    }
  };

  return (
    <motion.button
      type="button"
      onClick={handleGenerate}
      disabled={disabled || loading}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      className={`absolute top-3 right-3 p-1.5 rounded-lg bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-pink-600 transition-all duration-200 flex items-center justify-center group z-10 ${
        disabled || loading ? "opacity-50 cursor-not-allowed" : ""
      }`}
      title={getTooltipText()}
    >
      {loading ? (
        <FiLoader className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Sparkles className="w-3.5 h-3.5 animate-pulse text-yellow-100" />
      )}
      <span className="absolute bottom-full right-0 mb-2 hidden group-hover:block bg-slate-900 text-white text-[9px] px-2 py-1 rounded shadow-lg whitespace-nowrap z-[100] font-sans">
        {getTooltipText()}
      </span>
    </motion.button>
  );
};

export default AITextareaHelper;
