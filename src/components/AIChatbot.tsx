import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";

type Message = { id: string; role: "user" | "bot"; text: string; suggestions?: string[] };

type RoleCtx = "customer" | "vendor" | "admin" | "public";

function detectRole(pathname: string): RoleCtx {
    if (pathname.startsWith("/customer")) return "customer";
    if (pathname.startsWith("/vendor")) return "vendor";
    if (pathname.startsWith("/admin")) return "admin";
    return "public";
}

const welcomeMessages: Record<RoleCtx, string> = {
    customer:
        "👋 Hi there! I can help you discover services, manage bookings, or answer questions. What do you need?",
    vendor:
        "👋 Welcome back! I can help with your earnings, service listings, and booking management. How can I assist?",
    admin:
        "👋 Hello, Admin! I can help with platform stats, vendor management, and moderation. What would you like to know?",
    public:
        "👋 Hi! I'm the ServiceBook assistant. I can help you find services, learn about our platform, or answer questions. Ask away!",
};

const welcomeSuggestions: Record<RoleCtx, string[]> = {
    customer: ["My bookings", "Find a service", "Help"],
    vendor: ["My earnings", "My bookings", "Add service"],
    admin: ["Platform stats", "Manage vendors", "Moderate reviews"],
    public: ["Browse services", "How to book", "Sign up"],
};

let idCounter = 0;
const uid = () => `msg-${++idCounter}-${Date.now()}`;

/** Render text that may contain **bold** markers. */
function renderFormattedText(text: string) {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
        if (part.startsWith("**") && part.endsWith("**")) {
            return (
                <strong key={i} className="font-semibold">
                    {part.slice(2, -2)}
                </strong>
            );
        }
        return <span key={i}>{part}</span>;
    });
}

export default function AIChatbot() {
    const { pathname } = useLocation();
    const role = detectRole(pathname);
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [typing, setTyping] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const initializedRole = useRef<RoleCtx | null>(null);

    // Reset & add welcome when role changes or first open
    useEffect(() => {
        if (open && initializedRole.current !== role) {
            initializedRole.current = role;
            setMessages([
                {
                    id: uid(),
                    role: "bot",
                    text: welcomeMessages[role],
                    suggestions: welcomeSuggestions[role],
                },
            ]);
        }
    }, [open, role]);

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

    const sendMessage = useCallback(
        async (text: string) => {
            if (!text.trim() || typing) return;

            const userMsg: Message = { id: uid(), role: "user", text: text.trim() };
            setMessages((prev) => [...prev, userMsg]);
            setInput("");
            setTyping(true);

            try {
                const res = await fetch("/api/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: "include",
                    body: JSON.stringify({ message: text.trim() }),
                });

                if (!res.ok) {
                    throw new Error(`Server error (${res.status})`);
                }

                const data = (await res.json()) as { reply: string; suggestions?: string[] };
                setMessages((prev) => [
                    ...prev,
                    {
                        id: uid(),
                        role: "bot",
                        text: data.reply,
                        suggestions: data.suggestions,
                    },
                ]);
            } catch {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: uid(),
                        role: "bot",
                        text: "Something went wrong. Please try again in a moment. 😕",
                        suggestions: ["Help"],
                    },
                ]);
            } finally {
                setTyping(false);
            }
        },
        [typing]
    );

    const handleSend = useCallback(() => {
        sendMessage(input);
    }, [input, sendMessage]);

    const handleSuggestionClick = useCallback(
        (suggestion: string) => {
            if (typing) return;
            sendMessage(suggestion);
        },
        [typing, sendMessage]
    );

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
                                        Always here to help
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
                                <div key={msg.id}>
                                    <motion.div
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"
                                            }`}
                                    >
                                        {msg.role === "bot" && (
                                            <div className="w-6 h-6 rounded-full bg-primary/20 flex-shrink-0 flex items-center justify-center mt-0.5">
                                                <Bot size={12} className="text-primary" />
                                            </div>
                                        )}
                                        <div
                                            className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === "user"
                                                    ? "bg-primary text-primary-foreground rounded-br-md"
                                                    : "bg-secondary text-foreground rounded-bl-md"
                                                }`}
                                        >
                                            {renderFormattedText(msg.text)}
                                        </div>
                                        {msg.role === "user" && (
                                            <div className="w-6 h-6 rounded-full bg-muted flex-shrink-0 flex items-center justify-center mt-0.5">
                                                <User size={12} className="text-muted-foreground" />
                                            </div>
                                        )}
                                    </motion.div>

                                    {/* Suggestion chips */}
                                    {msg.role === "bot" &&
                                        msg.suggestions &&
                                        msg.suggestions.length > 0 && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 4 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.15 }}
                                                className="flex flex-wrap gap-1.5 mt-2 ml-8"
                                            >
                                                {msg.suggestions.map((s) => (
                                                    <button
                                                        key={s}
                                                        onClick={() => handleSuggestionClick(s)}
                                                        disabled={typing}
                                                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                                    >
                                                        {s}
                                                    </button>
                                                ))}
                                            </motion.div>
                                        )}
                                </div>
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
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                    placeholder="Type a message…"
                                    className="flex-1 px-3 py-2 rounded-xl bg-background border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!input.trim() || typing}
                                    className="w-9 h-9 rounded-xl bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-40"
                                    aria-label="Send message"
                                >
                                    <Send size={16} />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}
