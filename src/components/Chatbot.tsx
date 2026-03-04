import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { toast } from "sonner";

type Message = { id: string; role: "user" | "bot"; text: string };

type RoleCtx = "customer" | "vendor" | "admin" | "public";

function detectRole(pathname: string): RoleCtx {
  if (pathname.startsWith("/customer")) return "customer";
  if (pathname.startsWith("/vendor")) return "vendor";
  if (pathname.startsWith("/admin")) return "admin";
  return "public";
}

const welcomeMessages: Record<RoleCtx, string> = {
  customer:
    "👋 Hi there! I can help you discover services, manage bookings, or answer questions powered by AI. What do you need?",
  vendor:
    "👋 Welcome back! I can help with your earnings, service listings, and booking management using smart insights. How can I assist?",
  admin:
    "👋 Hello, Admin! I can help with platform stats, vendor management, and moderation with AI assistance. What would you like to know?",
  public:
    "👋 Hi! I'm the ServiceBook AI assistant. I can help you find services, learn about our platform, or answer questions. Ask away!",
};

let idCounter = 0;
const uid = () => `msg-${++idCounter}-${Date.now()}`;

export default function Chatbot() {
  const { pathname } = useLocation();
  const role = detectRole(pathname);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initializedRole = useRef<RoleCtx | null>(null);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("chatbot_history");
    if (saved) {
      try {
        const loaded = JSON.parse(saved);
        setMessages(loaded);
      } catch {
        console.warn("Failed to load chat history");
      }
    }
  }, []);

  // Save to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chatbot_history", JSON.stringify(messages));
    }
  }, [messages]);

  // Add welcome message when chat opens for the first time
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ id: uid(), role: "bot", text: welcomeMessages[role] }]);
      initializedRole.current = role;
    } else if (open && initializedRole.current !== role) {
      // Role changed, add new welcome
      initializedRole.current = role;
      setMessages([{ id: uid(), role: "bot", text: welcomeMessages[role] }]);
    }
  }, [open, role, messages.length]);

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, typing]);

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || typing) return;
    
    const userMsg: Message = { id: uid(), role: "user", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setTyping(true);

    try {
      // Call RAG-powered backend
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      const reply =
        data.reply || "I couldn't process that request. Please try again.";
      
      setMessages((prev) => [...prev, { id: uid(), role: "bot", text: reply }]);
    } catch (error) {
      console.error("Chat error:", error);
      toast.error("Failed to send message. Please try again.");
      
      const errorReply = "Sorry, I encountered an error. Please try again in a moment.";
      setMessages((prev) => [...prev, { id: uid(), role: "bot", text: errorReply }]);
    } finally {
      setTyping(false);
    }
  }, [input, typing]);

  const clearChat = () => {
    setMessages([]);
    localStorage.removeItem("chatbot_history");
    // Add welcome message back
    setMessages([{ id: uid(), role: "bot", text: welcomeMessages[role] }]);
  };

  return (
    <>
      {/* Floating bubble */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
            aria-label="Open chat"
          >
            <MessageCircle size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat panel */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 350 }}
            className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] h-[520px] max-h-[calc(100vh-3rem)] rounded-2xl border border-border bg-background shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <Bot size={16} className="text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground leading-none">
                    ServiceBook AI
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Powered by Groq & RAG
                  </p>
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                aria-label="Close chat"
              >
                <X size={16} />
              </button>
            </div>

            {/* Messages */}
            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
            >
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-2 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  {msg.role === "bot" && (
                    <div className="w-6 h-6 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center mt-0.5">
                      <Bot size={12} className="text-primary" />
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.text}
                  </div>
                  {msg.role === "user" && (
                    <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0 flex items-center justify-center mt-0.5">
                      <User size={12} className="text-muted-foreground" />
                    </div>
                  )}
                </motion.div>
              ))}

              {/* Typing indicator */}
              {typing && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex gap-2 items-start"
                >
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center mt-0.5">
                    <Bot size={12} className="text-primary" />
                  </div>
                  <div className="bg-secondary px-4 py-3 rounded-2xl rounded-bl-md flex gap-1">
                    {[0, 1, 2].map((i) => (
                      <motion.span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-muted-foreground"
                        animate={{ y: [0, -4, 0] }}
                        transition={{
                          duration: 0.5,
                          repeat: Infinity,
                          delay: i * 0.15,
                        }}
                      />
                    ))}
                  </div>
                </motion.div>
              )}
            </div>

            {/* Input */}
            <div className="px-3 py-3 border-t border-border bg-secondary/40">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && send()}
                  placeholder="Type a message…"
                  className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
                <button
                  onClick={send}
                  disabled={!input.trim() || typing}
                  className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40"
                  aria-label="Send message"
                >
                  <Send size={16} />
                </button>
              </div>
              {messages.length > 1 && (
                <button
                  type="button"
                  onClick={clearChat}
                  className="text-xs text-primary hover:text-primary/80 w-full text-center py-1.5 hover:bg-secondary/50 rounded mt-2 transition-colors"
                >
                  Clear chat
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
