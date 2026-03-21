"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Send, X, Sparkles, Loader2 } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

// ─── Suggested Questions ─────────────────────────────────────────

const SUGGESTED_QUESTIONS = [
  "Wie viel habe ich diesen Monat ausgegeben?",
  "Was sind meine offenen Rechnungen?",
  "Wie hoch ist meine Vorsteuer?",
  "Zeig mir die letzten 10 Buchungen",
];

// ─── Chat Panel Component ────────────────────────────────────────

export function ChatPanel() {
  const [isOpen, setIsOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom when messages change
  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when panel opens
  React.useEffect(() => {
    if (isOpen) {
      // Small delay to allow the animation to start
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const sendMessage = React.useCallback(
    async (messageText: string) => {
      const trimmed = messageText.trim();
      if (!trimmed || isLoading) return;

      const userMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });

        const data = await res.json();

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: data.success
            ? data.answer
            : data.error || "Entschuldigung, es ist ein Fehler aufgetreten.",
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content:
            "Verbindungsfehler. Bitte versuche es erneut.",
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading]
  );

  const handleSubmit = React.useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      sendMessage(input);
    },
    [input, sendMessage]
  );

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage(input);
      }
    },
    [input, sendMessage]
  );

  const handleSuggestionClick = React.useCallback(
    (question: string) => {
      sendMessage(question);
    },
    [sendMessage]
  );

  const togglePanel = React.useCallback(() => {
    setIsOpen((prev) => !prev);
  }, []);

  const closePanel = React.useCallback(() => {
    setIsOpen(false);
  }, []);

  return (
    <>
      {/* Floating toggle button */}
      <button
        onClick={togglePanel}
        className={cn(
          "fixed bottom-6 right-6 z-50",
          "flex h-14 w-14 items-center justify-center",
          "rounded-full",
          "bg-[#1D1D1F] text-white",
          "shadow-[0_4px_24px_rgba(0,0,0,0.2)]",
          "transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          "hover:scale-105 hover:shadow-[0_8px_32px_rgba(0,0,0,0.3)]",
          "active:scale-95",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--color-bg)]",
          isOpen && "scale-0 opacity-0 pointer-events-none"
        )}
        aria-label="Frag ARCANA oeffnen"
      >
        <Sparkles className="h-6 w-6" strokeWidth={1.5} />
      </button>

      {/* Backdrop (mobile) */}
      <div
        className={cn(
          "fixed inset-0 z-50 md:hidden transition-all duration-300",
          isOpen
            ? "opacity-100 pointer-events-auto"
            : "opacity-0 pointer-events-none"
        )}
        onClick={closePanel}
        aria-hidden="true"
        style={{
          background: "rgba(0, 0, 0, 0.25)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
        }}
      />

      {/* Chat Panel */}
      <aside
        className={cn(
          "fixed top-0 right-0 z-50 h-full",
          "w-full sm:w-[400px]",
          "flex flex-col",
          "transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]",
          isOpen ? "translate-x-0" : "translate-x-full"
        )}
        style={{
          background: "rgba(245, 245, 247, 0.85)",
          backdropFilter: "blur(40px) saturate(180%)",
          WebkitBackdropFilter: "blur(40px) saturate(180%)",
          borderLeft: "1px solid rgba(0, 0, 0, 0.06)",
          boxShadow: isOpen
            ? "-8px 0 32px rgba(0, 0, 0, 0.08), 0 0 1px rgba(0, 0, 0, 0.1)"
            : "none",
        }}
        role="complementary"
        aria-label="ARCANA Chat-Assistent"
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{
            borderBottom: "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1D1D1F]">
              <Sparkles className="h-4.5 w-4.5 text-white" strokeWidth={1.5} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-[var(--color-text)]">
                Frag ARCANA
              </h2>
              <p className="text-2xs text-[var(--color-text-tertiary)]">
                KI-Finanzassistent
              </p>
            </div>
          </div>
          <button
            onClick={closePanel}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[rgba(0,0,0,0.04)] text-[var(--color-text-secondary)] hover:bg-[rgba(0,0,0,0.08)] hover:text-[var(--color-text)] transition-all duration-200"
            aria-label="Chat schliessen"
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Empty state with suggestions */}
          {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full gap-6 py-8">
              <div className="text-center space-y-2">
                <div className="flex h-12 w-12 mx-auto items-center justify-center rounded-2xl bg-[rgba(0,0,0,0.04)]">
                  <Sparkles
                    className="h-6 w-6 text-[var(--color-text-tertiary)]"
                    strokeWidth={1.5}
                  />
                </div>
                <p className="text-sm text-[var(--color-text-secondary)]">
                  Frag mich etwas ueber deine Finanzen
                </p>
              </div>
              <div className="w-full space-y-2">
                {SUGGESTED_QUESTIONS.map((question) => (
                  <button
                    key={question}
                    onClick={() => handleSuggestionClick(question)}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-xl text-sm",
                      "bg-[rgba(255,255,255,0.6)]",
                      "border border-[rgba(0,0,0,0.04)]",
                      "text-[var(--color-text-secondary)]",
                      "hover:bg-[rgba(255,255,255,0.85)] hover:text-[var(--color-text)] hover:border-[rgba(0,0,0,0.08)]",
                      "transition-all duration-200",
                      "active:scale-[0.98]"
                    )}
                  >
                    {question}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-[#1D1D1F] text-white rounded-br-md"
                    : "bg-[rgba(255,255,255,0.7)] text-[var(--color-text)] border border-[rgba(0,0,0,0.04)] rounded-bl-md shadow-sm"
                )}
                style={
                  msg.role === "assistant"
                    ? {
                        backdropFilter: "blur(12px)",
                        WebkitBackdropFilter: "blur(12px)",
                      }
                    : undefined
                }
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
                <p
                  className={cn(
                    "text-2xs mt-1.5",
                    msg.role === "user"
                      ? "text-white/50"
                      : "text-[var(--color-text-tertiary)]"
                  )}
                >
                  {msg.timestamp.toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isLoading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl rounded-bl-md px-4 py-3 bg-[rgba(255,255,255,0.7)] border border-[rgba(0,0,0,0.04)] shadow-sm"
                style={{
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--color-text-tertiary)]" />
                  <span className="text-sm text-[var(--color-text-tertiary)]">
                    ARCANA denkt nach...
                  </span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div
          className="flex-shrink-0 px-4 pb-4 pt-3"
          style={{
            borderTop: "1px solid rgba(0, 0, 0, 0.06)",
          }}
        >
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Frag mich etwas ueber deine Finanzen..."
                disabled={isLoading}
                className={cn(
                  "w-full h-11 rounded-xl px-4 pr-11 text-sm",
                  "bg-[rgba(255,255,255,0.7)]",
                  "border border-[rgba(0,0,0,0.06)]",
                  "text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)]",
                  "transition-all duration-200",
                  "focus:outline-none focus:border-[rgba(0,0,0,0.15)] focus:bg-[rgba(255,255,255,0.9)] focus:shadow-sm",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
                style={{
                  backdropFilter: "blur(12px)",
                  WebkitBackdropFilter: "blur(12px)",
                }}
                autoComplete="off"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className={cn(
                "flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl",
                "bg-[#1D1D1F] text-white",
                "transition-all duration-200",
                "hover:bg-black hover:shadow-md",
                "active:scale-95",
                "disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-[#1D1D1F] disabled:hover:shadow-none disabled:active:scale-100",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)] focus-visible:ring-offset-2"
              )}
              aria-label="Nachricht senden"
            >
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </form>
        </div>
      </aside>
    </>
  );
}
