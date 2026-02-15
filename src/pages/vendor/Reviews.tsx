import { motion } from "framer-motion";
import { Star, MessageSquare } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Review = {
  id: number;
  booking_id: number;
  customer_id: number;
  customer_name: string;
  service_id: number;
  service_title: string;
  rating: number;
  comment: string;
  moderation_status: string;
  created_at: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function VendorReviews() {
  const { toast } = useToast();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/vendor/reviews", {
        credentials: "include",
      });
      const result = await response.json();

      if (result.ok) {
        setReviews(result.reviews);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to fetch reviews.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while fetching reviews.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-US", { 
        month: "short", 
        day: "numeric", 
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return "Invalid Date";
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={16}
            className={star <= rating ? "fill-primary text-primary" : "text-muted"}
          />
        ))}
      </div>
    );
  };

  const avgRating = reviews.length > 0
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : "0.0";

  const approvedCount = reviews.filter(r => r.moderation_status === "approved").length;

  return (
    <DashboardLayout role="vendor">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Customer Reviews</h1>
          <p className="text-muted-foreground text-sm">See what customers are saying about your services</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-floating p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Star className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{avgRating}</p>
                <p className="text-xs text-muted-foreground">Average Rating</p>
              </div>
            </div>
          </div>

          <div className="card-floating p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <MessageSquare className="text-primary" size={20} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{reviews.length}</p>
                <p className="text-xs text-muted-foreground">Total Reviews</p>
              </div>
            </div>
          </div>

          <div className="card-floating p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Star className="text-green-400" size={20} />
              </div>
              <div>
                <p className="text-2xl font-display font-bold text-foreground">{approvedCount}</p>
                <p className="text-xs text-muted-foreground">Approved Reviews</p>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews List */}
        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <MessageSquare size={48} className="mx-auto mb-4 opacity-50" />
            <p>No reviews yet</p>
            <p className="text-sm mt-2">Reviews will appear here after customers rate your services</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="card-floating p-5 hover:shadow-lg transition-all cursor-pointer"
                onClick={() => {
                  setSelectedReview(review);
                  setShowDetailDialog(true);
                }}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-foreground">{review.service_title}</h3>
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[review.moderation_status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {review.moderation_status}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>{review.customer_name}</span>
                      <span>•</span>
                      <span>{formatDate(review.created_at)}</span>
                    </div>
                  </div>
                  <div>
                    {renderStars(review.rating)}
                  </div>
                </div>

                {review.comment && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {review.comment}
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        )}

        {/* Detail Dialog */}
        <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Review Details</DialogTitle>
              <DialogDescription>Full review information</DialogDescription>
            </DialogHeader>
            {selectedReview && (
              <div className="space-y-4">
                <div className="border-b border-border pb-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg">{selectedReview.service_title}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[selectedReview.moderation_status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                      {selectedReview.moderation_status}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="font-medium">{selectedReview.customer_name}</span>
                    <span>•</span>
                    <span>{formatDate(selectedReview.created_at)}</span>
                  </div>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground mb-2">Rating</p>
                  <div className="flex items-center gap-2">
                    {renderStars(selectedReview.rating)}
                    <span className="text-lg font-semibold text-foreground">{selectedReview.rating}.0</span>
                  </div>
                </div>

                {selectedReview.comment && (
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Comment</p>
                    <p className="text-foreground">{selectedReview.comment}</p>
                  </div>
                )}

                <div className="flex gap-2 text-xs text-muted-foreground">
                  <span>Booking ID: #{selectedReview.booking_id}</span>
                  <span>•</span>
                  <span>Review ID: #{selectedReview.id}</span>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
