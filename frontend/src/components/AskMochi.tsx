import { useState, useRef, useEffect } from "react";
import { callClaude } from "@/lib/anthropic";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Trash2, MessageSquare, Sparkles, Loader2, History, Plus, Menu, X, Clock, ChevronRight } from "lucide-react";
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load sessions from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`${storageKey}-sessions`);
      if (saved) {
        const parsedSessions = JSON.parse(saved);
        setSessions(parsedSessions);
        
        // Load most recent session or create new one
        if (parsedSessions.length > 0) {
          const mostRecent = parsedSessions.sort((a: ChatSession, b: ChatSession) => b.updatedAt - a.updatedAt)[0];
          setCurrentSessionId(mostRecent.id);
          setMessages(mostRecent.messages);
        } else {
          createNewChat();
        }
      } else {
        createNewChat();
      }
    } catch {
      console.warn("Failed to load sessions");
      createNewChat();
    }
  }, [storageKey]);

  // Save sessions to localStorage
  useEffect(() => {
    if (sessions.length > 0) {
      localStorage.setItem(`${storageKey}-sessions`, JSON.stringify(sessions));
    }
  }, [sessions, storageKey]);

  // Auto scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedText]);

  // Typewriter effect
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

  // Create new chat session
  const createNewChat = () => {
    const newSessionId = Date.now().toString();
    const newSession: ChatSession = {
      id: newSessionId,
      title: "New Chat",
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSessionId);
    setMessages([]);
    setDisplayedText("");
    setIsTyping(false);
    setInput("");
    setSidebarOpen(false);
    
    // Focus input
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Load chat session
  const loadSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setCurrentSessionId(sessionId);
      setMessages(session.messages);
      setDisplayedText("");
      setIsTyping(false);
      setSidebarOpen(false);
    }
  };

  // Delete chat session
  const deleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
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

  // Update session title based on first message
  const updateSessionTitle = (sessionId: string, firstMessage: string) => {
    const title = firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : "");
    setSessions(prev => prev.map(session => 
      session.id === sessionId 
        ? { ...session, title, updatedAt: Date.now() }
        : session
    ));
  };

  // Send message
  const sendMessage = async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { 
      role: "user", 
      content: text.trim(),
      timestamp: Date.now()
    };
    
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Update session with new message
    if (currentSessionId) {
      const isFirstMessage = messages.length === 0;
      setSessions(prev => prev.map(session => 
        session.id === currentSessionId
          ? { 
              ...session, 
              messages: newMessages,
              updatedAt: Date.now(),
              title: isFirstMessage ? text.slice(0, 30) + (text.length > 30 ? "..." : "") : session.title
            }
          : session
      ));
    }

    try {
      const response = await callClaude(
        systemPrompt,
        newMessages.map((m) => ({
          role: m.role,
          content: m.content,
        })),
        1000
      );

      const assistantMsg: Message = {
        role: "assistant",
        content: response,
        timestamp: Date.now()
      };

      const finalMessages = [...newMessages, assistantMsg];
      setMessages(finalMessages);
      
      // Update session with assistant response
      if (currentSessionId) {
        setSessions(prev => prev.map(session => 
          session.id === currentSessionId
            ? { ...session, messages: finalMessages, updatedAt: Date.now() }
            : session
        ));
      }
      
      typeWriter(response);
    } catch (err: any) {
      const errorMsg: Message = {
        role: "assistant",
        content: `Error: ${err?.message || "Something went wrong"}`,
        timestamp: Date.now()
      };
      
      const finalMessages = [...newMessages, errorMsg];
      setMessages(finalMessages);
      
      if (currentSessionId) {
        setSessions(prev => prev.map(session => 
          session.id === currentSessionId
            ? { ...session, messages: finalMessages, updatedAt: Date.now() }
            : session
        ));
      }
    } finally {
      setLoading(false);
    }
  };

  // Clear current chat
  const clearCurrentChat = () => {
    if (currentSessionId && messages.length > 0) {
      setSessions(prev => prev.map(session => 
        session.id === currentSessionId
          ? { ...session, messages: [], updatedAt: Date.now(), title: "New Chat" }
          : session
      ));
      setMessages([]);
      setDisplayedText("");
    }
  };

  // Format date for display
  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (date.toDateString() === today.toDateString()) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (date.toDateString() === yesterday.toDateString()) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  // Render markdown safely
  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>")
      .replace(/\n/g, "<br/>")
      .replace(/•/g, "•");
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);
  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-[calc(100vh-6rem)] gap-4">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-80 bg-card border-r border-border transform transition-transform duration-200 ease-in-out lg:relative lg:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:block`}>
        <div className="flex flex-col h-full">
          {/* Sidebar Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">Chat History</h2>
              </div>
              <Button
                size="sm"
                onClick={createNewChat}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                New Chat
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {sessions.length} conversation{sessions.length !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">No conversations yet</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 p-3 rounded-lg cursor-pointer transition-colors ${
                    currentSessionId === session.id
                      ? "bg-primary/10 border border-primary/20"
                      : "hover:bg-muted/50 border border-transparent"
                  }`}
                  onClick={() => loadSession(session.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {session.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {session.messages.length} message{session.messages.length !== 1 ? "s" : ""} · {formatDate(session.updatedAt)}
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
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden h-8 w-8 p-0"
            >
              <Menu className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold tracking-tight text-foreground">
                Ask Mochi 🤖
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Your friendly AI pharmacy assistant
              </p>
            </div>
          </div>
          
          {hasMessages && (
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={createNewChat}
                className="h-8 gap-1 text-xs"
              >
                <Plus className="h-3 w-3" />
                New Chat
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={clearCurrentChat}
                className="h-8 gap-1 text-xs"
              >
                <Trash2 className="h-3 w-3" />
                Clear
              </Button>
            </div>
          )}
        </div>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {!hasMessages && !loading && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
              <p className="text-lg font-semibold text-foreground">Hi! I'm Mochi</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Ask me anything about medicines, symptoms, dosage, or general health questions.
              </p>
              
              {/* Suggested Questions */}
              <div className="flex flex-wrap gap-2 mt-6 max-w-lg justify-center">
                {suggestedPills.map((pill, idx) => (
                  <button
                    key={idx}
                    onClick={() => sendMessage(pill)}
                    className="px-3 py-1.5 text-xs rounded-full bg-muted hover:bg-accent transition-colors border border-border"
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
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2 shrink-0 mt-1">
                    <Sparkles className="h-3.5 w-3.5 text-primary" />
                  </div>
                )}
                
                <div
                  className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted border border-border"
                  }`}
                >
                  <div
                    dangerouslySetInnerHTML={{
                      __html: isLastAssistant && isTyping
                        ? renderMarkdown(displayedText)
                        : renderMarkdown(msg.content),
                    }}
                    className="prose prose-sm max-w-none"
                  />
                </div>
                
                {msg.role === "user" && (
                  <div className="ml-2 shrink-0 mt-1">
                    <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center">
                      <span className="text-xs font-medium">You</span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {loading && !isTyping && (
            <div className="flex justify-start">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-muted border border-border rounded-2xl px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="pt-4 border-t border-border">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && sendMessage(input)}
              placeholder={loading ? "Mochi is thinking..." : "Ask Mochi anything..."}
              disabled={loading}
              className="flex-1 h-10 text-sm bg-muted/30 border-border/60"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={loading || !input.trim()}
              size="sm"
              className="h-10 w-10 p-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-3">
            ⚠️ For informational purposes only. Always consult a doctor for medical advice.
          </p>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!showDeleteConfirm} onOpenChange={() => setShowDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Delete Conversation</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
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