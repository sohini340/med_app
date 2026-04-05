import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Star, MessageSquare, User, Pill, Stethoscope, Send, History, ThumbsUp, ThumbsDown, Eye, EyeOff, Briefcase, Heart, Activity, Users, Smile, Meh, Frown, Zap, Battery } from "lucide-react";

const API_BASE_URL = "http://localhost:8000";

interface FeedbackHistory {
  id: number;
  rating: number;
  review: string | null;
  category: string | null;
  mood: string | null;
  created_at: string;
  owner_reply: string | null;
  doctor_name: string | null;
  medicine_name: string | null;
  sub_ratings: {
    value: number;
    friendliness: number;
    wait: number;
  };
  would_recommend: boolean;
  is_anonymous: boolean;
}

interface Doctor {
  id: number;
  name: string;
}

interface Medicine {
  id: number;
  name: string;
}

interface FeedbackInitData {
  doctors: Doctor[];
  medicines: Medicine[];
  history: FeedbackHistory[];
}

const Feedback = () => {
  const { user, token } = useAuthStore();

  const [history, setHistory] = useState<FeedbackHistory[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [medicines, setMedicines] = useState<Medicine[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(true);
  
  // Form state
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [review, setReview] = useState("");
  const [category, setCategory] = useState("");
  const [mood, setMood] = useState("");
  const [doctorId, setDoctorId] = useState("none");
  const [medicineId, setMedicineId] = useState("none");
  const [subValue, setSubValue] = useState(3);
  const [subFriendliness, setSubFriendliness] = useState(3);
  const [subWait, setSubWait] = useState(3);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(false);

  useEffect(() => {
    if (!token) return;

    const fetchData = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/customer/feedback/init`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!res.ok) throw new Error("Failed to fetch");

        const data: FeedbackInitData = await res.json();
        setHistory(data.history || []);
        setDoctors(data.doctors || []);
        setMedicines(data.medicines || []);
      } catch (err) {
        toast.error("Unable to load feedback data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      toast.error("Please select a rating");
      return;
    }
    
    if (wouldRecommend === null) {
      toast.error("Please specify if you would recommend us");
      return;
    }
    
    setSubmitting(true);
    
    try {
      const res = await fetch(`${API_BASE_URL}/customer/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rating,
          review,
          category: category || null,
          mood: mood || null,
          doctor_id: doctorId && doctorId !== "none" ? parseInt(doctorId) : null,
          medicine_id: medicineId && medicineId !== "none" ? parseInt(medicineId) : null,
          sub_value: subValue,
          sub_friendliness: subFriendliness,
          sub_wait: subWait,
          recommend: wouldRecommend,
          anonymous: isAnonymous,
        }),
      });
      
      if (!res.ok) throw new Error("Failed to submit feedback");
      
      toast.success("Thank you for your feedback!");
      
      // Reset form
      setRating(0);
      setReview("");
      setCategory("");
      setMood("");
      setDoctorId("none");
      setMedicineId("none");
      setSubValue(3);
      setSubFriendliness(3);
      setSubWait(3);
      setWouldRecommend(null);
      setIsAnonymous(false);
      
      // Refresh history
      const refreshRes = await fetch(`${API_BASE_URL}/customer/feedback/init`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshRes.ok) {
        const data: FeedbackInitData = await refreshRes.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      toast.error("Failed to submit feedback");
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (currentRating: number, interactive = false) => {
    const stars = [];
    const value = interactive ? (hoverRating || rating) : currentRating;
    
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <button
          key={i}
          type="button"
          onClick={() => interactive && setRating(i)}
          onMouseEnter={() => interactive && setHoverRating(i)}
          onMouseLeave={() => interactive && setHoverRating(0)}
          className={`${interactive ? 'cursor-pointer' : 'cursor-default'} focus:outline-none transition-transform hover:scale-110`}
        >
          <Star
            className={`h-6 w-6 ${
              i <= value
                ? "fill-yellow-400 text-yellow-400"
                : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
            } transition-colors`}
          />
        </button>
      );
    }
    return stars;
  };

  const getCategoryIcon = (cat: string) => {
    switch (cat) {
      case "employee_behaviour":
        return <Users className="h-4 w-4" />;
      case "medicine_quality":
        return <Pill className="h-4 w-4" />;
      case "service":
        return <Briefcase className="h-4 w-4" />;
      case "doctor":
        return <Stethoscope className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getMoodIcon = (moodValue: string) => {
    switch (moodValue) {
      case "happy":
        return <Smile className="h-4 w-4" />;
      case "satisfied":
        return <Smile className="h-4 w-4" />;
      case "neutral":
        return <Meh className="h-4 w-4" />;
      case "bad":
        return <Frown className="h-4 w-4" />;
      case "frustrated":
        return <Battery className="h-4 w-4" />;
      default:
        return <Meh className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-xl" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Feedback</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Share your experience with us</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowForm(!showForm)}
          className="gap-2"
        >
          {showForm ? <History className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
          {showForm ? "View History" : "Write Review"}
        </Button>
      </div>

      {/* Feedback Form */}
      {showForm && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground">Share Your Feedback</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Your opinion helps us improve</p>
          </div>
          
          <form onSubmit={handleSubmit} className="p-5 space-y-5">
            {/* Overall Rating */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Overall Rating *</Label>
              <div className="flex gap-1">
                {renderStars(rating, true)}
              </div>
              {rating === 0 && (
                <p className="text-xs text-red-500">Please select a rating</p>
              )}
            </div>
            
            {/* Would Recommend */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Would you recommend us? *</Label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setWouldRecommend(true)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    wouldRecommend === true
                      ? "border-green-500 bg-green-50 dark:bg-green-950/20 text-green-700"
                      : "border-border hover:border-green-300"
                  }`}
                >
                  <ThumbsUp className="h-4 w-4" />
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setWouldRecommend(false)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    wouldRecommend === false
                      ? "border-red-500 bg-red-50 dark:bg-red-950/20 text-red-700"
                      : "border-border hover:border-red-300"
                  }`}
                >
                  <ThumbsDown className="h-4 w-4" />
                  No
                </button>
              </div>
            </div>
            
            {/* Sub Ratings */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Detailed Ratings</Label>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Value for Money</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSubValue(v)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            v <= subValue
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Friendliness</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSubFriendliness(v)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            v <= subFriendliness
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Wait Time</p>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setSubWait(v)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-5 w-5 ${
                            v <= subWait
                              ? "fill-yellow-400 text-yellow-400"
                              : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                          } transition-colors`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            
            {/* Category - Updated */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/60">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="employee_behaviour">Employee Behaviour</SelectItem>
                  <SelectItem value="medicine_quality">Medicine Quality</SelectItem>
                  <SelectItem value="service">Service</SelectItem>
                  <SelectItem value="doctor">Doctor</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Mood - Updated (no emojis) */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Mood</Label>
              <Select value={mood} onValueChange={setMood}>
                <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/60">
                  <SelectValue placeholder="How do you feel?" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="happy">Happy</SelectItem>
                  <SelectItem value="satisfied">Satisfied</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                  <SelectItem value="bad">Bad</SelectItem>
                  <SelectItem value="frustrated">Frustrated</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Doctor & Medicine */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Related Doctor (Optional)</Label>
                <Select value={doctorId} onValueChange={setDoctorId}>
                  <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/60">
                    <SelectValue placeholder="Select doctor" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {doctors.map((doc) => (
                      <SelectItem key={doc.id} value={String(doc.id)}>
                        {doc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Related Medicine (Optional)</Label>
                <Select value={medicineId} onValueChange={setMedicineId}>
                  <SelectTrigger className="h-9 text-sm bg-muted/30 border-border/60">
                    <SelectValue placeholder="Select medicine" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {medicines.map((med) => (
                      <SelectItem key={med.id} value={String(med.id)}>
                        {med.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            {/* Review Text */}
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Your Review</Label>
              <Textarea
                placeholder="Tell us about your experience..."
                value={review}
                onChange={(e) => setReview(e.target.value)}
                rows={4}
                className="resize-none bg-muted/30 border-border/60"
              />
            </div>
            
            {/* Anonymous Toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border">
              <div className="flex items-center gap-2">
                {isAnonymous ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                <span className="text-sm">Post anonymously</span>
              </div>
              <button
                type="button"
                onClick={() => setIsAnonymous(!isAnonymous)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  isAnonymous ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isAnonymous ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
            
            {/* Submit Button */}
            <Button
              type="submit"
              disabled={submitting || rating === 0 || wouldRecommend === null}
              className="w-full gap-2"
            >
              {submitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Submit Feedback
                </>
              )}
            </Button>
          </form>
        </div>
      )}
      
      {/* Feedback History */}
      {!showForm && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-foreground">Your Feedback History</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {history.length} review{history.length !== 1 ? "s" : ""} submitted
                </p>
              </div>
            </div>
          </div>
          
          <div className="divide-y divide-border/50 max-h-[500px] overflow-y-auto">
            {history.length === 0 ? (
              <div className="py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No feedback submitted yet</p>
                <Button
                  variant="link"
                  size="sm"
                  onClick={() => setShowForm(true)}
                  className="mt-2"
                >
                  Write your first review
                </Button>
              </div>
            ) : (
              history.map((f) => (
                <div key={f.id} className="p-4 hover:bg-muted/20 transition-colors">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <div className="flex">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3.5 w-3.5 ${
                                star <= f.rating
                                  ? "fill-yellow-400 text-yellow-400"
                                  : "fill-gray-200 text-gray-200 dark:fill-gray-700 dark:text-gray-700"
                              }`}
                            />
                          ))}
                        </div>
                        <span className="text-xs font-medium">{f.rating}/5</span>
                      </div>
                      {f.would_recommend !== undefined && (
                        <div className="flex items-center gap-1 text-xs">
                          {f.would_recommend ? (
                            <ThumbsUp className="h-3 w-3 text-green-600" />
                          ) : (
                            <ThumbsDown className="h-3 w-3 text-red-600" />
                          )}
                          <span className="text-muted-foreground">
                            {f.would_recommend ? "Recommends" : "Does not recommend"}
                          </span>
                        </div>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(f.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {f.review && (
                    <p className="text-sm text-foreground mb-2">"{f.review}"</p>
                  )}
                  
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {f.doctor_name && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        <Stethoscope className="h-2.5 w-2.5" />
                        {f.doctor_name}
                      </span>
                    )}
                    {f.medicine_name && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        <Pill className="h-2.5 w-2.5" />
                        {f.medicine_name}
                      </span>
                    )}
                    {f.category && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {getCategoryIcon(f.category)}
                        {f.category === "employee_behaviour" && "Employee Behaviour"}
                        {f.category === "medicine_quality" && "Medicine Quality"}
                        {f.category === "service" && "Service"}
                        {f.category === "doctor" && "Doctor"}
                      </span>
                    )}
                    {f.mood && (
                      <span className="inline-flex items-center gap-1 text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        {getMoodIcon(f.mood)}
                        {f.mood}
                      </span>
                    )}
                    {f.is_anonymous && (
                      <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded">
                        Anonymous
                      </span>
                    )}
                  </div>
                  
                  {f.owner_reply && (
                    <div className="mt-2 pl-3 border-l-2 border-primary/30">
                      <p className="text-[11px] font-medium text-muted-foreground mb-0.5">Admin Response:</p>
                      <p className="text-xs text-foreground">{f.owner_reply}</p>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Feedback;