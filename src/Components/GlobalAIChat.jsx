import React, { useState, useEffect, useRef } from "react";
import {
  FiX,
  FiCopy,
  FiCheck,
  FiShield,
  FiTrash2,
  FiSend,
} from "react-icons/fi";
import { Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import { motion, AnimatePresence } from "framer-motion";
import { authFetch } from "../utils/authFetch";

const GlobalAIChat = ({ isOpen: controlledIsOpen, setIsOpen: controlledSetIsOpen }) => {
  const [localIsOpen, localSetIsOpen] = useState(false);
  const isOpen = controlledIsOpen !== undefined ? controlledIsOpen : localIsOpen;
  const setIsOpen = controlledSetIsOpen !== undefined ? controlledSetIsOpen : localSetIsOpen;

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem("global_ai_chat_history");
      return saved ? JSON.parse(saved) : [
        {
          id: "welcome",
          role: "model",
          text: "Hello! I am your Family AI Assistant & User Guide. Ask me how to use any feature of this application (e.g., 'How do I create a family tree?') or enter keywords to generate posts and descriptions safely.",
        },
      ];
    } catch {
      return [
        {
          id: "welcome",
          role: "model",
          text: "Hello! I am your Family AI Assistant & User Guide. Ask me how to use any feature of this application (e.g., 'How do I create a family tree?') or enter keywords to generate posts and descriptions safely.",
        },
      ];
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Persist chat history
  useEffect(() => {
    try {
      localStorage.setItem("global_ai_chat_history", JSON.stringify(messages));
    } catch (e) {
      console.error("Failed to save AI chat history:", e);
    }
  }, [messages]);

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      const welcome = {
        id: "welcome",
        role: "model",
        text: "Hello! I am your Family AI Assistant & User Guide. Ask me how to use any feature of this application (e.g., 'How do I create a family tree?') or enter keywords to generate posts and descriptions safely.",
      };
      setMessages([welcome]);
      try {
        localStorage.removeItem("global_ai_chat_history");
      } catch (e) {}
      toast.success("Chat history cleared.");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    const query = input.trim();
    if (!query) return;

    if (query.length > 150) {
      toast.warn("Prompt cannot exceed 150 characters.");
      return;
    }

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      text: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const res = await authFetch("/ai/generate", {
        method: "POST",
        body: JSON.stringify({
          keywords: query,
          type: "general",
        }),
      });

      if (res && res.text) {
        setMessages((prev) => [
          ...prev,
          {
            id: (Date.now() + 1).toString(),
            role: "model",
            text: res.text,
          },
        ]);
      } else {
        throw new Error("Invalid response format");
      }
    } catch (err) {
      toast.error(err?.message || "Failed to generate AI response.");
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "model",
          text: "Sorry, I had trouble generating a response. Please check your keywords and try again.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (text, msgId) => {
    navigator.clipboard.writeText(text);
    setCopiedId(msgId);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.15 }}
          className="fixed bottom-24 lg:bottom-22 right-6 sm:w-[380px] w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-11rem)] z-[100] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border border-gray-200/80 dark:border-slate-800/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-205"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/60 backdrop-blur-sm flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow shadow-indigo-500/20">
                <Sparkles size={16} />
              </div>
              <div>
                <h3 className="font-bold text-xs text-gray-800 dark:text-white leading-tight">
                  Family AI Assistant
                </h3>
                <span className="text-[9px] text-green-600 dark:text-green-400 font-semibold flex items-center gap-1 mt-0.5">
                  <FiShield size={9} /> Private & Secure
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 1 && (
                <button
                  onClick={handleClearChat}
                  className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-slate-800 rounded-lg transition text-gray-400 hover:text-red-500"
                  title="Clear Chat"
                >
                  <FiTrash2 size={14} />
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-gray-200/50 dark:hover:bg-slate-800 rounded-lg transition text-gray-400 hover:text-gray-600 dark:hover:text-slate-300"
              >
                <FiX size={15} />
              </button>
            </div>
          </div>

          {/* Conversation Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50/30 dark:bg-slate-950/10">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${
                  msg.role === "user" ? "items-end" : "items-start"
                }`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs shadow-sm relative group ${
                    msg.role === "user"
                      ? "bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-tr-none"
                      : "bg-white dark:bg-slate-800 text-gray-800 dark:text-slate-100 border border-gray-100 dark:border-slate-700/80 rounded-tl-none"
                  }`}
                >
                  <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  
                  {msg.role === "model" && msg.id !== "welcome" && (
                    <button
                      onClick={() => handleCopy(msg.text, msg.id)}
                      className="absolute -right-7 top-1 p-1 text-gray-400 hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition duration-150"
                      title="Copy response"
                    >
                      {copiedId === msg.id ? (
                        <FiCheck size={12} className="text-green-500" />
                      ) : (
                        <FiCopy size={12} />
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start">
                <div className="bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700/80 text-gray-500 rounded-2xl rounded-tl-none px-4 py-3 text-xs flex items-center gap-2">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 bg-gray-400 dark:bg-slate-500 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                  <span>Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Footer Input Bar */}
          <form
            onSubmit={handleSendMessage}
            className="p-3 bg-white dark:bg-slate-900 border-t border-gray-100 dark:border-slate-800/80 flex flex-col gap-1.5"
          >
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                maxLength={150}
                disabled={isLoading}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about app features or enter keywords (e.g. how to build a tree)..."
                className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all placeholder-gray-400 dark:text-slate-100"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-2 bg-indigo-500 text-white rounded-xl hover:bg-indigo-600 transition duration-150 disabled:opacity-50 flex items-center justify-center shadow-md shadow-indigo-500/10"
              >
                <FiSend size={14} />
              </button>
            </div>
            
            <div className="flex justify-between items-center px-1 text-[9px] text-gray-400 dark:text-slate-500">
              <span>Never logs or shares your family details.</span>
              <span className={input.length > 130 ? "text-amber-500" : ""}>
                {input.length}/150
              </span>
            </div>
          </form>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default GlobalAIChat;
