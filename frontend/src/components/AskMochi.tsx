import { useState, useRef, useEffect } from "react";
import { callClaude } from "@/lib/anthropic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Send,
  Trash2,
  MessageSquare,
  Sparkles,
  Loader2,
  Plus,
  Menu,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Message {
  role: "user" | "assistant";
  content: string;
  timestamp?: number;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

interface AskMochiProps {
  systemPrompt: string;
  suggestedPills: string[];
  storageKey: string;
}

const AskMochi = ({
  systemPrompt,
  suggestedPills,
  storageKey,
}: AskMochiProps) => {
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [displayedText, setDisplayedText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    // Persist sidebar collapse state
    const saved = localStorage.getItem(`${storageKey}-sidebar-collapsed`);
    return saved === "true";
  });
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Save collapse preference
  useEffect(() => {
    localStorage.setItem(`${storageKey}-sidebar-collapsed`, String(isCollapsed));
  }, [isCollapsed, storageKey]);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}-sessions`);
      if (saved) {
        const parsedSessions = JSON.parse(saved);
        setSessions(parsedSessions);
        if (parsedSessions.length > 0) {
          const mostRecent = parsedSessions.sort(
            (a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt
          )[0];
          setCurrentSessionId(mostRecent.id);
          setMessages(mostRecent.messages);
        } else {
          createNewChat();
        }
      } else {
        createNewChat();
      }
    } catch {
      createNewChat();
    }
  }, [storageKey]);

  // Save sessions
  useEffect(() => {
    if (sessions.length) {
      localStorage.setItem(`${storageKey}-sessions`, JSON.stringify(sessions));
    }
  }, [sessions, storageKey]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedText]);

  const typeWriter = (text: string) => {
    setIsTyping(true);
    setDisplayedText("");
    let i = 0;
    const interval = setInterval(() => {
      if (i < text.length) {
        setDisplayedText(text.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setIsTyping(false);
      }
    }, 20);
    return () => clearInterval(interval);
  };

  const createNewChat = () => {
    const newSessionId = Date.now().toString();
    const newSession: ChatSession = {
      id: newSessionId,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setSessions((prev) => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setDisplayedText("");
    setIsTyping(false);
    setInput("");
    setMobileSidebarOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const loadSession = (sessionId: string) => {
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setDisplayedText("");
      setIsTyping(false);
      setMobileSidebarOpen(false);
    }
  };

  const deleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(updatedSessions);
    if (currentSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        loadSession(updatedSessions[0].id);
      } else {
        createNewChat();
      }
    }
    setShowDeleteConfirm(null);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = {
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    if (currentSessionId) {
      const isFirstMessage = messages.length === 0;
      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? {
                ...session,
                messages: newMessages,
                updatedAt: Date.now(),
                title: isFirstMessage
                  ? text.slice(0, 30) + (text.length > 30 ? "..." : "")
                  : session.title,
              }
            : session
        )
      );
    }

    try {
      const response = await callClaude(
        systemPrompt,
        newMessages.map((m) => ({ role: m.role, content: m.content })),
        1000
      );
      const assistantMsg: Message = {
        role: "assistant",
        content: response,
        timestamp: Date.now(),
      };
      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      if (currentSessionId) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === currentSessionId
              ? { ...session, messages: finalMessages, updatedAt: Date.now() }
              : session
          )
        );
      }
      typeWriter(response);
    } catch (err: any) {
      const errorMsg: Message = {
        role: "assistant",
        content: `Error: ${err?.message || "Something went wrong"}`,
        timestamp: Date.now(),
      };
      const finalMessages = [...newMessages, errorMsg];
      setMessages(finalMessages);
      if (currentSessionId) {
        setSessions((prev) =>
          prev.map((session) =>
            session.id === currentSessionId
              ? { ...session, messages: finalMessages, updatedAt: Date.now() }
              : session
          )
        );
      }
    } finally {
      setLoading(false);
    }
  };

  const clearCurrentChat = () => {
    if (currentSessionId && messages.length) {
      setSessions((prev) =>
        prev.map((session) =>
          session.id === currentSessionId
            ? { ...session, messages: [], updatedAt: Date.now(), title: "New Chat" }
            : session
        )
      );
      setMessages([]);
      setDisplayedText("");
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    }
    return date.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>")
      .replace(/•/g, "•");
  };

  const hasMessages = messages.length > 0;

  // Sidebar width classes
  const sidebarWidth = isCollapsed ? "w-20" : "w-80";
  const sidebarTransition = "transition-all duration-300 ease-in-out";

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-0 bg-gradient-to-br from-slate-50 to-white dark:from-slate-950 dark:to-slate-900 rounded-xl shadow-sm">
      {/* Desktop Sidebar (collapsible) */}
      <aside
        className={`hidden lg:flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 ${sidebarWidth} ${sidebarTransition} relative`}
      >
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className={`p-4 border-b border-slate-200 dark:border-slate-800 ${isCollapsed ? "items-center" : ""}`}>
            {!isCollapsed ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-500" />
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">History</h2>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setIsCollapsed(true)}
                    className="h-8 w-8 p-0"
                    title="Collapse sidebar"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={createNewChat}
                    className="h-8 gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Plus className="h-3 w-3" />
                    New Chat
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsCollapsed(false)}
                  className="h-8 w-8 p-0"
                  title="Expand sidebar"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={createNewChat}
                  className="h-8 w-8 p-0 bg-indigo-600 hover:bg-indigo-700 text-white"
                  title="New chat"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-slate-300 dark:text-slate-700 mx-auto mb-2" />
                {!isCollapsed && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">No conversations yet</p>
                )}
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 p-2 rounded-lg cursor-pointer transition-all ${
                    currentSessionId === session.id
                      ? "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-transparent"
                  } ${isCollapsed ? "justify-center" : ""}`}
                  onClick={() => loadSession(session.id)}
                >
                  <MessageSquare className="h-4 w-4 shrink-0 text-slate-500" />
                  {!isCollapsed && (
                    <>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                          {session.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {session.messages.length} msg · {formatDate(session.updatedAt)}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          setShowDeleteConfirm(session.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                      </Button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      <div
        className={`fixed inset-0 z-50 bg-black/50 transition-opacity lg:hidden ${
          mobileSidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMobileSidebarOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-80 bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800 transform transition-transform duration-300 lg:hidden ${
          mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-indigo-500" />
                <h2 className="font-semibold text-slate-900 dark:text-slate-100">Chat History</h2>
              </div>
              <Button
                size="sm"
                onClick={createNewChat}
                className="h-8 gap-1 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
              >
                <Plus className="h-3 w-3" />
                New Chat
              </Button>
            </div>
            <p className="text-xs text-slate-500">{sessions.length} conversation(s)</p>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.map((session) => (
              <div
                key={session.id}
                className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer ${
                  currentSessionId === session.id
                    ? "bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200"
                    : "hover:bg-slate-100 dark:hover:bg-slate-800/50"
                }`}
                onClick={() => loadSession(session.id)}
              >
                <MessageSquare className="h-4 w-4 shrink-0 text-slate-500" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                    {session.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {session.messages.length} msg · {formatDate(session.updatedAt)}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowDeleteConfirm(session.id);
                  }}
                >
                  <Trash2 className="h-3.5 w-3.5 text-slate-400 hover:text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-white dark:bg-slate-950 rounded-r-xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden h-8 w-8 p-0 text-slate-700 dark:text-slate-300"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Ask Mochi
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                AI Pharmacy Assistant
              </p>
            </div>
          </div>
          {hasMessages && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={createNewChat}
                className="h-8 gap-1 text-xs border-slate-300 dark:border-slate-700"
              >
                <Plus className="h-3 w-3" />
                New Chat
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearCurrentChat}
                className="h-8 gap-1 text-xs border-slate-300 dark:border-slate-700"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
          {!hasMessages && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-100 to-indigo-50 dark:from-indigo-950/50 dark:to-indigo-900/30 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <p className="text-lg font-semibold text-slate-900 dark:text-slate-100">Hi! I'm Mochi</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Ask me about medicines, symptoms, dosage, or general health questions.
              </p>
              <div className="flex flex-wrap gap-2 mt-6 max-w-lg justify-center">
                {suggestedPills.map((pill, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(pill)}
                    className="px-3 py-1.5 text-xs rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    {pill}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => {
            const isLastAssistant = idx === messages.length - 1 && msg.role === "assistant";
            return (
              <div
                key={idx}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mr-2 shrink-0 mt-1">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm shadow-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-br-sm"
                      : "bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 rounded-bl-sm"
                  }`}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: isLastAssistant && isTyping ? renderMarkdown(displayedText) : renderMarkdown(msg.content),
                    }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
                {msg.role === "user" && (
                  <div className="ml-2 shrink-0 mt-1">
                    <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
                      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">You</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {loading && !isTyping && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center mr-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
              </div>
              <div className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-slate-500" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage(input)}
              placeholder={loading ? "Mochi is thinking..." : "Ask Mochi anything..."}
              disabled={loading}
              className="flex-1 h-10 text-sm bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 focus:ring-indigo-500"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              size="sm"
              className="h-10 w-10 p-0 bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-slate-400 text-center mt-3">
            ⚠️ For informational purposes only. Always consult a doctor for medical advice.
          </p>
        </div>
      </main>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Conversation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-500">
            Are you sure you want to delete this conversation? This action cannot be undone.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowDeleteConfirm(null)} className="h-8 text-xs">
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => showDeleteConfirm && deleteSession(showDeleteConfirm)}
              className="h-8 text-xs gap-1"
            >
              <Trash2 className="h-3 w-3" />
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AskMochi;