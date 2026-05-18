"use client";

import { useState, useEffect, useRef } from "react";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface Metrics {
  completionTokens: number;
  totalTokens: number;
  model: string;
}

type Session = {
  id: string;
  title: string;
  createdAt: number;
  messages: Message[];
  metrics: Metrics;
};

type SessionStore = Record<string, Session>;

export default function GroqChat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionStore>({});
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [switching, setSwitching] = useState(false);
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<Metrics>({
    completionTokens: 0,
    totalTokens: 0,
    model: "",
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const createNewSession = () => {
    const id = `session_${Date.now()}`;
    const newSession: Session = {
      id,
      title: "New conversation",
      createdAt: Date.now(),
      messages: [],
      metrics: { completionTokens: 0, totalTokens: 0, model: "" },
    };

    setSessions((prev) => {
      const next = { ...prev, [id]: newSession };
      localStorage.setItem("groq_sessions", JSON.stringify(next));
      return next;
    });
    setActiveSessionId(id);
    setMessages([]);
    setMetrics({ completionTokens: 0, totalTokens: 0, model: "" });
    setError(null);
    setInput("");
  };

  const formatSessionDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfToday.getDate() - 1);

    if (date >= startOfToday) return "Today";
    if (date >= startOfYesterday && date < startOfToday) return "Yesterday";
    return date.toLocaleDateString();
  };

  // TODO — load messages and metrics from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem("groq_sessions");

    if (savedSessions) {
      const parsedSessions: SessionStore = JSON.parse(savedSessions);
      const sessionList = Object.values(parsedSessions);

      if (sessionList.length > 0) {
        setSessions(parsedSessions);
        const mostRecent = sessionList.sort((a, b) => b.createdAt - a.createdAt)[0];
        setActiveSessionId(mostRecent.id);
        return;
      }
    }

    createNewSession();
  }, []);

  useEffect(() => {
    if (!activeSessionId) return;
    const activeSession = sessions[activeSessionId];
    if (!activeSession) return;

    setSwitching(true);
    setMessages(activeSession.messages);
    setMetrics(activeSession.metrics);

    const timeout = setTimeout(() => {
      setSwitching(false);
    }, 150);

    return () => clearTimeout(timeout);
  }, [activeSessionId]);

  // TODO — save messages to localStorage
  useEffect(() => {
    if (!activeSessionId) return;

    setSessions((prev) => {
      const activeSession = prev[activeSessionId];
      if (!activeSession) return prev;

      const firstUserMessage = messages.find((message) => message.role === "user" && message.content.trim());
      const nextTitle =
        activeSession.title === "New conversation" && firstUserMessage
          ? firstUserMessage.content.trim().slice(0, 40)
          : activeSession.title;

      const next = {
        ...prev,
        [activeSessionId]: {
          ...activeSession,
          title: nextTitle || "New conversation",
          messages,
          metrics,
        },
      };

      localStorage.setItem("groq_sessions", JSON.stringify(next));
      return next;
    });
  }, [messages, metrics, activeSessionId]);

  // TODO — call Groq API
  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const updatedMessages = [...messages, userMessage];
    setLoading(true);
    setError(null);
    setMessages(updatedMessages);
    setInput("");

    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: updatedMessages,
        }),
      });

      const data: any = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || "Failed to fetch chat completion");
      }

      const assistantReply = data?.choices?.[0]?.message?.content || "";
      const completionTokens = data?.usage?.completion_tokens || 0;
      const totalTokens = data?.usage?.total_tokens || 0;
      const model = data?.model || "";

      setMetrics((prev: Metrics) => ({
        completionTokens: prev.completionTokens + completionTokens,
        totalTokens: prev.totalTokens + totalTokens,
        model,
      }));

      setMessages((prev: Message[]) => [...prev, { role: "assistant", content: assistantReply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  // TODO — reset state and clear localStorage
  const handleClear = () => {
    createNewSession();
  };

  const handleDeleteSession = (sessionId: string, e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();

    const nextSessions = { ...sessions };
    delete nextSessions[sessionId];

    setSessions(nextSessions);
    localStorage.setItem("groq_sessions", JSON.stringify(nextSessions));

    const remainingSessions = Object.values(nextSessions).sort((a, b) => b.createdAt - a.createdAt);
    if (remainingSessions.length === 0) {
      createNewSession();
      return;
    }

    if (activeSessionId === sessionId) {
      setActiveSessionId(remainingSessions[0].id);
    }
  };

  const sortedSessions = Object.values(sessions).sort((a, b) => b.createdAt - a.createdAt);
  const groupedSessions = sortedSessions.reduce((acc, session) => {
    const label = formatSessionDate(session.createdAt);
    if (!acc[label]) {
      acc[label] = [];
    }
    acc[label].push(session);
    return acc;
  }, {} as Record<string, Session[]>);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div suppressHydrationWarning
      style={{
        display: "flex",
        height: "100vh",
        position: "relative",
        background: `
          radial-gradient(ellipse 80% 40% at 50% -10%, rgba(232,224,208,0.04) 0%, transparent 70%),
          radial-gradient(ellipse 50% 30% at -10% 110%, rgba(232,224,208,0.02) 0%, transparent 60%),
          #090909
        `,
      }}
    >
      <aside
        style={{
          width: sidebarOpen ? "240px" : "0px",
          overflow: "hidden",
          transition: "width 300ms cubic-bezier(0.16, 1, 0.3, 1)",
          background: "rgba(255,255,255,0.015)",
          backdropFilter: "blur(20px) saturate(150%)",
          borderRight: "1px solid rgba(255,255,255,0.05)",
          boxShadow: "inset -1px 0 0 rgba(255,255,255,0.03), 4px 0 24px rgba(0,0,0,0.4)",
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            height: "48px",
            padding: "0 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}
        >
          <span
            style={{
              fontSize: "0.6rem",
              textTransform: "uppercase",
              letterSpacing: "0.18em",
              color: "rgba(232,224,208,0.3)",
              fontWeight: 500,
            }}
          >
            Sessions
          </span>
          <button
            onClick={createNewSession}
            title="New conversation"
            style={{
              background: "none",
              border: "none",
              width: "24px",
              height: "24px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              transition: "all 150ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "rgba(232,224,208,0.08)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "none";
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(232,224,208,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
        </div>

        <div
          id="session-list"
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "0.5rem 0",
            scrollbarWidth: "none",
          }}
        >
          {Object.entries(groupedSessions).map(([dateLabel, items]) => (
            <div key={dateLabel}>
              <div
                style={{
                  padding: "0.75rem 1rem 0.25rem",
                  fontSize: "0.58rem",
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "rgba(232,224,208,0.2)",
                  fontWeight: 500,
                }}
              >
                {dateLabel}
              </div>

              {items.map((session) => {
                const isActive = session.id === activeSessionId;
                const isHovered = hoveredSessionId === session.id;

                return (
                  <div
                    key={session.id}
                    onClick={() => setActiveSessionId(session.id)}
                    onMouseEnter={() => setHoveredSessionId(session.id)}
                    onMouseLeave={() => setHoveredSessionId(null)}
                    style={{
                      padding: "0.5rem 1rem",
                      margin: "1px 0",
                      cursor: "pointer",
                      borderLeft: isActive ? "2px solid rgba(232,224,208,0.5)" : "2px solid transparent",
                      background: isActive ? "rgba(232,224,208,0.06)" : isHovered ? "rgba(255,255,255,0.03)" : "transparent",
                      boxShadow: isActive ? "inset 0 0 20px rgba(232,224,208,0.02)" : "none",
                      transition: "all 180ms ease",
                      position: "relative",
                      overflow: "visible",
                    }}
                  >
                    <div style={{ minWidth: 0, maxWidth: "160px" }}>
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 500,
                          color: isActive ? "var(--text-primary)" : "rgba(232,224,208,0.5)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: "160px",
                          transition: "color 150ms ease",
                        }}
                      >
                        {session.title}
                      </div>
                      <div
                        style={{
                          fontSize: "0.62rem",
                          color: "rgba(232,224,208,0.25)",
                          marginTop: "2px",
                        }}
                      >
                        {formatSessionDate(session.createdAt)}
                      </div>
                    </div>

                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      style={{
                        position: "absolute",
                        right: "0.75rem",
                        top: "50%",
                        transform: "translateY(-50%)",
                        opacity: isHovered ? 1 : 0,
                        fontSize: "0.7rem",
                        color: "rgba(232,224,208,0.35)",
                        width: "18px",
                        height: "18px",
                        borderRadius: "4px",
                        transition: "all 120ms ease",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "rgba(192,57,43,0.15)";
                        e.currentTarget.style.color = "#c0392b";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "none";
                        e.currentTarget.style.color = "rgba(232,224,208,0.35)";
                      }}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div
          style={{
            height: "48px",
            borderTop: "1px solid rgba(255,255,255,0.04)",
            padding: "0 1rem",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "0.65rem",
              color: "rgba(232,224,208,0.2)",
              textTransform: "uppercase",
              letterSpacing: "0.12em",
            }}
          >
            {sortedSessions.length} sessions
          </span>
        </div>
      </aside>

      <button
        onClick={() => setSidebarOpen((prev) => !prev)}
        style={{
          position: "absolute",
          left: sidebarOpen ? "239px" : "0px",
          top: "50%",
          transform: "translateY(-50%)",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: "0 6px 6px 0",
          width: "20px",
          height: "36px",
          color: "rgba(232,224,208,0.3)",
          fontSize: "0.65rem",
          outline: "none",
          cursor: "pointer",
          transition: "all 150ms ease",
          zIndex: 10,
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.07)";
          e.currentTarget.style.color = "rgba(232,224,208,0.7)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "rgba(255,255,255,0.04)";
          e.currentTarget.style.color = "rgba(232,224,208,0.3)";
        }}
      >
        {sidebarOpen ? "‹" : "›"}
      </button>

      <div
        className="flex flex-col h-screen"
        style={{
          flex: 1,
          minWidth: 0,
          background: "transparent",
        }}
      >
      {/* Fixed Header */}
      <header 
        className="flex items-center justify-between px-8 shrink-0"
        style={{
          height: '56px',
          background: 'rgba(9,9,9,0.85)',
          backdropFilter: 'blur(20px) saturate(180%)',
          borderBottom: '1px solid var(--border-subtle)'
        }}
      >
        <span 
          className="font-medium"
          style={{ 
            fontSize: '0.9rem', 
            color: 'var(--text-secondary)',
            letterSpacing: '-0.01em'
          }}
        >
          Groq Chat
        </span>
        <button
          onClick={handleClear}
          className="transition-colors duration-200"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.75rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em'
          }}
          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
        >
          Clear Conversation
        </button>
      </header>

      {/* Error Banner */}
      {error && (
        <div 
          className="flex items-center justify-between px-8 py-3 shrink-0"
          style={{
            background: 'rgba(192,57,43,0.1)',
            borderBottom: '1px solid rgba(192,57,43,0.2)'
          }}
        >
          <span style={{ color: '#c0392b', fontSize: '0.8rem' }}>{error}</span>
          <button
            onClick={() => setError(null)}
            className="transition-opacity hover:opacity-70"
            style={{ color: '#c0392b', background: 'none', border: 'none' }}
          >
            ×
          </button>
        </div>
      )}

      {/* Metrics Bar */}
      <div 
        className="flex items-center justify-center shrink-0"
        style={{
          height: '48px',
          background: 'var(--bg-glass)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: 'inset 0 -1px 0 rgba(255,255,255,0.03)'
        }}
      >
        <div className="flex items-center">
          {/* Completion Tokens */}
          <div className="flex flex-col items-center px-8">
            <span 
              style={{ 
                fontSize: '0.6rem', 
                textTransform: 'uppercase', 
                letterSpacing: '0.15em',
                opacity: 0.35,
                color: 'var(--text-primary)'
              }}
            >
              Completion
            </span>
            <span 
              className="font-medium transition-all duration-150"
              style={{ 
                fontSize: '0.95rem', 
                color: 'var(--accent)',
                fontFeatureSettings: '"tnum"'
              }}
            >
              {metrics.completionTokens}
            </span>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />

          {/* Total Tokens */}
          <div className="flex flex-col items-center px-8">
            <span 
              style={{ 
                fontSize: '0.6rem', 
                textTransform: 'uppercase', 
                letterSpacing: '0.15em',
                opacity: 0.35,
                color: 'var(--text-primary)'
              }}
            >
              Total
            </span>
            <span 
              className="font-medium transition-all duration-150"
              style={{ 
                fontSize: '0.95rem', 
                color: 'var(--accent)',
                fontFeatureSettings: '"tnum"'
              }}
            >
              {metrics.totalTokens}
            </span>
          </div>

          <div style={{ width: '1px', height: '24px', background: 'var(--border-subtle)' }} />

          {/* Model */}
          <div className="flex flex-col items-center px-8">
            <span 
              style={{ 
                fontSize: '0.6rem', 
                textTransform: 'uppercase', 
                letterSpacing: '0.15em',
                opacity: 0.35,
                color: 'var(--text-primary)'
              }}
            >
              Model
            </span>
            <span 
              className="font-medium transition-all duration-150"
              style={{ 
                fontSize: '0.95rem', 
                color: 'var(--accent)'
              }}
            >
              {metrics.model}
            </span>
          </div>
        </div>
      </div>

      {/* Scrollable Message List */}
      <main
        className="flex-1 overflow-y-auto px-8 py-6"
        style={{
          opacity: switching ? 0 : 1,
          transform: switching ? "translateY(4px)" : "translateY(0)",
          transition: switching
            ? "opacity 150ms ease, transform 150ms ease"
            : "opacity 200ms ease, transform 200ms ease",
        }}
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="flex flex-col items-center">
              <div
                style={{
                  width: "40px",
                  height: "1px",
                  background: "rgba(232,224,208,0.1)",
                }}
              />
              <p
                style={{
                  marginTop: "0.75rem",
                  fontSize: "0.8rem",
                  color: "rgba(232,224,208,0.2)",
                  letterSpacing: "0.05em",
                }}
              >
                New conversation
              </p>
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto flex flex-col gap-5">
            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex animate-message-enter ${message.role === "user" ? "justify-end" : "justify-start"}`}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                <div
                  style={{
                    maxWidth: '68%',
                    padding: '0.75rem 1rem',
                    background: message.role === "user" ? 'var(--user-bubble)' : 'var(--assistant-bubble)',
                    border: `1px solid ${message.role === "user" ? 'var(--border-glow)' : 'var(--border-subtle)'}`,
                    borderRadius: message.role === "user" ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                    boxShadow: message.role === "user" 
                      ? '0 2px 12px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.06)' 
                      : '0 2px 20px rgba(0,0,0,0.5)',
                    backdropFilter: message.role === "assistant" ? 'blur(8px)' : 'none',
                    color: message.role === "user" ? 'var(--text-primary)' : 'rgba(232,224,208,0.85)',
                    fontSize: '0.9rem',
                    lineHeight: 1.65,
                    letterSpacing: '-0.01em'
                  }}
                >
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}

            {/* Loading State */}
            {loading && (
              <div className="flex justify-start animate-message-enter">
                <div
                  className="animate-ambient-glow"
                  style={{
                    padding: '0.75rem 1rem',
                    background: 'var(--assistant-bubble)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: '4px 16px 16px 16px',
                    backdropFilter: 'blur(8px)',
                    boxShadow: '0 2px 20px rgba(0,0,0,0.5)'
                  }}
                >
                  <div className="flex gap-1.5">
                    <span 
                      className="animate-dot-pulse"
                      style={{ 
                        width: '4px', 
                        height: '4px', 
                        borderRadius: '50%', 
                        background: 'var(--accent-muted)',
                        animationDelay: '0s'
                      }} 
                    />
                    <span 
                      className="animate-dot-pulse"
                      style={{ 
                        width: '4px', 
                        height: '4px', 
                        borderRadius: '50%', 
                        background: 'var(--accent-muted)',
                        animationDelay: '0.2s'
                      }} 
                    />
                    <span 
                      className="animate-dot-pulse"
                      style={{ 
                        width: '4px', 
                        height: '4px', 
                        borderRadius: '50%', 
                        background: 'var(--accent-muted)',
                        animationDelay: '0.4s'
                      }} 
                    />
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </main>

      {/* Sticky Bottom Input Area */}
      <footer 
        className="px-8 py-4 shrink-0"
        style={{
          background: 'rgba(9,9,9,0.9)',
          backdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--border-subtle)'
        }}
      >
        <div className="max-w-3xl mx-auto flex gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type your message..."
            disabled={loading}
            className="flex-1 transition-all duration-200 focus:outline-none disabled:opacity-50"
            style={{
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '0.75rem 1rem',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              letterSpacing: '-0.01em'
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-glow)';
              e.currentTarget.style.boxShadow = '0 0 0 3px rgba(232,224,208,0.04)';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = 'var(--border-subtle)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="flex items-center justify-center transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed group"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'var(--accent)',
              border: 'none'
            }}
            onMouseEnter={(e) => {
              if (!loading && input.trim()) {
                e.currentTarget.style.background = '#ffffff';
                e.currentTarget.style.boxShadow = '0 4px 20px rgba(232,224,208,0.2)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--accent)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {loading ? (
              <div 
                className="animate-spinner"
                style={{
                  width: '16px',
                  height: '16px',
                  border: '1.5px solid rgba(9,9,9,0.2)',
                  borderTopColor: '#090909',
                  borderRadius: '50%'
                }}
              />
            ) : (
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="#090909" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round"
                className="transition-transform duration-200 group-hover:rotate-45"
                style={{ transform: 'rotate(0deg)' }}
              >
                <path d="M12 19V5M5 12l7-7 7 7" />
              </svg>
            )}
          </button>
        </div>
      </footer>
    </div>

      <style jsx>{`
        #session-list::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
