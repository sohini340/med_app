import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState } from "@/components/EmptyState";
import { LoadingSkeleton } from "@/components/LoadingSkeleton";
import { toast } from "sonner";
import { Star, MessageSquare, Send, User, Briefcase, Pill, Stethoscope, Smile, Meh, Frown, Battery, CheckCircle, XCircle } from "lucide-react";

const API = "http://localhost:8000/owner/feedback";

type Feedback = {
  feedback_id: number;
  name: string;
  overall_rating: number;
  review_text: string | null;
  category: string | null;
  mood_tag: string | null;
  would_recommend: boolean;
  sub_rating_value: number;
  sub_rating_friendliness: number;
  sub_rating_wait: number;
  owner_reply: string | null;
  created_at: string | null;
};

const OwnerFeedback = () => {
  const { token } = useAuthStore();
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<number, string>>({});
  const [sending, setSending] = useState<number | null>(null);

  // ---------------- LOAD ----------------
  const load = async () => {
    try {
      const res = await fetch(API, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load feedback");
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("Invalid response");
      setFeedback(data);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Error loading feedback");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) load();
    else {
      setLoading(false);
      toast.error("Not authenticated");
    }
  }, [token]);

  // ---------------- REPLY ----------------
  const handleReply = async (id: number) => {
    const reply = (replies[id] || "").trim();
    if (!reply) return;

    try {
      setSending(id);
      const res = await fetch(`${API}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reply }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Reply failed");
      }
      setFeedback((prev) =>
        prev.map((f) =>
          f.feedback_id === id ? { ...f, owner_reply: reply } : f
        )
      );
      setReplies((prev) => ({ ...prev, [id]: "" }));
      toast.success("Reply sent");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Reply error");
    } finally {
      setSending(null);
    }
  };

  // ---------------- Helpers ----------------
  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-3.5 w-3.5 ${
            star <= (rating || 0)
              ? "fill-yellow-400 text-yellow-400"
              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
          }`}
        />
      ))}
    </div>
  );

  const getCategoryLabel = (category: string | null) => {
    switch (category) {
      case "employee_behaviour":
        return { label: "Employee Behaviour", icon: Briefcase };
      case "medicine_quality":
        return { label: "Medicine Quality", icon: Pill };
      case "service":
        return { label: "Service", icon: MessageSquare };
      case "doctor":
        return { label: "Doctor", icon: Stethoscope };
      default:
        return { label: category || "General", icon: MessageSquare };
    }
  };

  const getMoodIcon = (mood: string | null) => {
    switch (mood) {
      case "happy": return <Smile className="h-3.5 w-3.5 text-green-600" />;
      case "satisfied": return <Smile className="h-3.5 w-3.5 text-green-500" />;
      case "neutral": return <Meh className="h-3.5 w-3.5 text-yellow-500" />;
      case "bad": return <Frown className="h-3.5 w-3.5 text-orange-500" />;
      case "frustrated": return <Battery className="h-3.5 w-3.5 text-red-500" />;
      default: return <Meh className="h-3.5 w-3.5 text-muted-foreground" />;
    }
  };

  const totalFeedback = feedback.length;
  const avgRating =
    totalFeedback > 0
      ? (feedback.reduce((sum, f) => sum + (f.overall_rating || 0), 0) / totalFeedback).toFixed(1)
      : 0;
  const recommendCount = feedback.filter((f) => f.would_recommend === true).length;
  const notRecommendCount = feedback.filter((f) => f.would_recommend === false).length;

  if (loading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Customer Feedback</h1>
          <p className="text-sm text-muted-foreground mt-0.5">View and respond to customer reviews</p>
        </div>
        {totalFeedback > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50 px-2.5 py-1 rounded-full border border-border">
            <MessageSquare className="h-3 w-3" />
            {totalFeedback} review{totalFeedback !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/20">
              <MessageSquare className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Total Reviews</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{totalFeedback}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-yellow-50 dark:bg-yellow-950/20">
              <Star className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Avg Rating</span>
          </div>
          <p className="text-xl font-semibold text-foreground">{avgRating} / 5</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-green-50 dark:bg-green-950/20">
              <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Recommend</span>
          </div>
          <p className="text-xl font-semibold text-green-600">{recommendCount}</p>
        </div>
        <div className="bg-card rounded-xl border border-border p-3">
          <div className="flex items-center gap-2 mb-2">
            <div className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/20">
              <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />
            </div>
            <span className="text-xs text-muted-foreground uppercase tracking-wide">Not Recommend</span>
          </div>
          <p className="text-xl font-semibold text-red-600">{notRecommendCount}</p>
        </div>
      </div>

      {/* Feedback List */}
      {feedback.length === 0 ? (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="py-12 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No customer feedback yet</p>
            <p className="text-xs text-muted-foreground mt-1">Reviews will appear here once customers submit feedback</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {feedback.map((f) => {
            const categoryInfo = getCategoryLabel(f.category);
            const CategoryIcon = categoryInfo.icon;
            return (
              <div
                key={f.feedback_id}
                className="bg-card rounded-xl border border-border overflow-hidden hover:border-primary/30 transition-colors"
              >
                {/* Header */}
                <div className="px-4 py-3 border-b border-border bg-muted/20">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="font-medium text-sm text-foreground">{f.name}</span>
                      </div>
                      {renderStars(f.overall_rating)}
                      <span className="text-xs font-medium text-muted-foreground">
                        {f.overall_rating}/5
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {f.category && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                          <CategoryIcon className="h-2.5 w-2.5" />
                          {categoryInfo.label}
                        </span>
                      )}
                      {f.mood_tag && (
                        <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-2 py-0.5 rounded-full">
                          {getMoodIcon(f.mood_tag)}
                          <span className="capitalize">{f.mood_tag}</span>
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {f.created_at
                          ? new Date(f.created_at).toLocaleDateString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="p-4 space-y-3">
                  {/* Sub Ratings */}
                  <div className="flex flex-wrap gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Value:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-2.5 w-2.5 ${
                              s <= (f.sub_rating_value || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-gray-200 text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Friendliness:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-2.5 w-2.5 ${
                              s <= (f.sub_rating_friendliness || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-gray-200 text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">Wait Time:</span>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`h-2.5 w-2.5 ${
                              s <= (f.sub_rating_wait || 0)
                                ? "fill-yellow-400 text-yellow-400"
                                : "fill-gray-200 text-gray-200"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {f.would_recommend ? (
                        <>
                          <CheckCircle className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">Recommends</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="h-3 w-3 text-red-600" />
                          <span className="text-red-600">Does not recommend</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Review Text */}
                  {f.review_text && (
                    <p className="text-sm text-foreground italic">"{f.review_text}"</p>
                  )}

                  {/* Reply Section */}
                  {f.owner_reply ? (
                    <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <p className="text-xs font-medium text-primary mb-1">Your Reply:</p>
                      <p className="text-sm text-foreground">{f.owner_reply}</p>
                    </div>
                  ) : (
                    <div className="flex gap-2 mt-2">
                      <Input
                        placeholder="Write a reply to this customer..."
                        value={replies[f.feedback_id] || ""}
                        onChange={(e) =>
                          setReplies((prev) => ({ ...prev, [f.feedback_id]: e.target.value }))
                        }
                        className="h-9 text-sm bg-muted/30 border-border/60"
                      />
                      <Button
                        size="sm"
                        disabled={sending === f.feedback_id || !(replies[f.feedback_id]?.trim())}
                        onClick={() => handleReply(f.feedback_id)}
                        className="h-9 gap-1.5 text-xs"
                      >
                        {sending === f.feedback_id ? (
                          <>
                            <div className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="h-3 w-3" />
                            Reply
                          </>
                        )}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default OwnerFeedback;