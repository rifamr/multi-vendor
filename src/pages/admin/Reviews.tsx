import { motion } from "framer-motion";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Star, Check, X, Trash2, Eye } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type Review = {
  id: number;
  bookingId: number;
  customerId: number;
  customerName: string;
  serviceId: number;
  serviceTitle: string;
  rating: number;
  comment: string | null;
  moderationStatus: string;
  createdAt: string;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  approved: "bg-green-500/10 text-green-400 border-green-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
};

export default function AdminReviews() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<string>("all");
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionReviewId, setActionReviewId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const url = filter === "all" 
        ? "/api/admin/reviews" 
        : `/api/admin/reviews?status=${filter}`;
      
      const response = await fetch(url, { credentials: "include" });
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
  }, [filter]);

  const handleUpdateStatus = async (reviewId: number, status: string) => {
    try {
      const response = await fetch(`/api/admin/reviews/${reviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Status Updated",
          description: `Review ${status === "approved" ? "approved" : "rejected"} successfully.`,
        });
        fetchReviews();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update review.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while updating the review.",
        variant: "destructive",
      });
    }
  };

  const handleDeleteReview = async () => {
    if (!actionReviewId) return;

    try {
      const response = await fetch(`/api/admin/reviews/${actionReviewId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Review Deleted",
          description: "The review has been permanently deleted.",
        });
        fetchReviews();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete review.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while deleting the review.",
        variant: "destructive",
      });
    } finally {
      setActionReviewId(null);
      setShowDeleteDialog(false);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            size={14}
            className={
              star <= rating
                ? "fill-yellow-400 text-yellow-400"
                : "fill-transparent text-gray-400"
            }
          />
        ))}
      </div>
    );
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground mb-2">
            Review Moderation
          </h1>
          <p className="text-muted-foreground">
            Manage and moderate customer reviews
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["all", "pending", "approved", "rejected"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                filter === f 
                  ? "bg-primary text-primary-foreground" 
                  : "bg-secondary text-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading reviews...</div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Star size={48} className="mx-auto mb-4 opacity-50" />
            <p>No reviews found.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-secondary border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">ID</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Service</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Customer</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Rating</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden lg:table-cell">Date</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reviews.map((review, i) => (
                  <motion.tr
                    key={review.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-foreground font-mono text-xs">#{review.id}</td>
                    <td className="px-5 py-3 text-foreground max-w-xs truncate">
                      {review.serviceTitle}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">
                      {review.customerName}
                    </td>
                    <td className="px-5 py-3">{renderStars(review.rating)}</td>
                    <td className="px-5 py-3 text-muted-foreground text-xs hidden lg:table-cell">
                      {formatDate(review.createdAt)}
                    </td>
                    <td className="px-5 py-3">
                      <span 
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          statusColors[review.moderationStatus] || "bg-gray-500/10 text-gray-400 border-gray-500/20"
                        }`}
                      >
                        {review.moderationStatus}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedReview(review);
                            setShowDetailDialog(true);
                          }}
                          className="text-blue-400 hover:text-blue-300 transition-colors"
                          title="View details"
                        >
                          <Eye size={16} />
                        </button>
                        {review.moderationStatus === "pending" && (
                          <>
                            <button
                              onClick={() => handleUpdateStatus(review.id, "approved")}
                              className="text-green-400 hover:text-green-300 transition-colors"
                              title="Approve"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={() => handleUpdateStatus(review.id, "rejected")}
                              className="text-red-400 hover:text-red-300 transition-colors"
                              title="Reject"
                            >
                              <X size={16} />
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => {
                            setActionReviewId(review.id);
                            setShowDeleteDialog(true);
                          }}
                          className="text-red-400 hover:text-red-300 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Review</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete this review? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setActionReviewId(null)}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleDeleteReview} 
                className="bg-red-500 hover:bg-red-600"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Review Detail Dialog */}
        {selectedReview && (
          <AlertDialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
            <AlertDialogContent className="max-w-lg">
              <AlertDialogHeader>
                <AlertDialogTitle>Review Details</AlertDialogTitle>
              </AlertDialogHeader>
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Service</p>
                  <p className="text-foreground">{selectedReview.serviceTitle}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Customer</p>
                  <p className="text-foreground">{selectedReview.customerName}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Rating</p>
                  {renderStars(selectedReview.rating)}
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Comment</p>
                  <p className="text-foreground">
                    {selectedReview.comment || <em className="text-muted-foreground">No comment provided</em>}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Status</p>
                  <span 
                    className={`inline-block text-xs px-2 py-0.5 rounded-full border ${
                      statusColors[selectedReview.moderationStatus] || 
                      "bg-gray-500/10 text-gray-400 border-gray-500/20"
                    }`}
                  >
                    {selectedReview.moderationStatus}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground mb-1">Submitted</p>
                  <p className="text-foreground text-sm">{formatDate(selectedReview.createdAt)}</p>
                </div>
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setSelectedReview(null)}>
                  Close
                </AlertDialogCancel>
                {selectedReview.moderationStatus === "pending" && (
                  <>
                    <AlertDialogAction
                      onClick={() => {
                        handleUpdateStatus(selectedReview.id, "approved");
                        setShowDetailDialog(false);
                        setSelectedReview(null);
                      }}
                      className="bg-green-500 hover:bg-green-600"
                    >
                      Approve
                    </AlertDialogAction>
                    <AlertDialogAction
                      onClick={() => {
                        handleUpdateStatus(selectedReview.id, "rejected");
                        setShowDetailDialog(false);
                        setSelectedReview(null);
                      }}
                      className="bg-red-500 hover:bg-red-600"
                    >
                      Reject
                    </AlertDialogAction>
                  </>
                )}
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </DashboardLayout>
  );
}
