import { useState } from "react";
import { Star, Send, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface ReviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  bookingId: number;
  serviceId: number;
  serviceTitle: string;
  vendorName: string;
  onReviewSubmitted?: () => void;
}

export default function ReviewDialog({
  isOpen,
  onClose,
  bookingId,
  serviceId,
  serviceTitle,
  vendorName,
  onReviewSubmitted,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (rating === 0) {
      toast({
        title: "Rating Required",
        description: "Please select a star rating before submitting.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          bookingId,
          serviceId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Review Submitted!",
          description: "Thank you for your feedback. Your review is pending moderation.",
        });
        onReviewSubmitted?.();
        onClose();
        
        // Reset form
        setRating(0);
        setComment("");
      } else {
        throw new Error(result.error || "Failed to submit review");
      }
    } catch (err) {
      toast({
        title: "Submission Failed",
        description: err instanceof Error ? err.message : "Failed to submit review",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="bg-background border border-border rounded-2xl shadow-2xl w-full max-w-lg mx-4"
        >
          <div className="p-6 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold text-foreground">
                Rate Your Experience
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {serviceTitle} • {vendorName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={24} />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Star Rating */}
            <div className="text-center">
              <p className="text-sm font-medium text-foreground mb-3">
                How would you rate this service?
              </p>
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setRating(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="transition-transform hover:scale-110 focus:outline-none"
                  >
                    <Star
                      size={40}
                      className={`transition-colors ${
                        star <= (hoverRating || rating)
                          ? "fill-yellow-400 text-yellow-400"
                          : "fill-transparent text-gray-400"
                      }`}
                    />
                  </button>
                ))}
              </div>
              {rating > 0 && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm text-muted-foreground mt-2"
                >
                  {rating === 1 && "Poor"}
                  {rating === 2 && "Fair"}
                  {rating === 3 && "Good"}
                  {rating === 4 && "Very Good"}
                  {rating === 5 && "Excellent"}
                </motion.p>
              )}
            </div>

            {/* Comment */}
            <div>
              <label className="text-sm font-medium text-foreground block mb-2">
                Share your experience (optional)
              </label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Tell us about your experience with this service..."
                rows={4}
                maxLength={500}
                className="resize-none"
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">
                {comment.length}/500
              </p>
            </div>
          </div>

          <div className="p-6 border-t border-border flex gap-3">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1"
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 gap-2"
              disabled={submitting || rating === 0}
            >
              {submitting ? (
                "Submitting..."
              ) : (
                <>
                  <Send size={16} />
                  Submit Review
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
