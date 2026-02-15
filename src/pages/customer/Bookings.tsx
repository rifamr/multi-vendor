import { motion } from "framer-motion";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { XCircle, Calendar, FileText, Star, RefreshCw } from "lucide-react";
import ReviewDialog from "@/components/ReviewDialog";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Booking = {
  id: number;
  customerId: number;
  vendorId: number;
  serviceId: number;
  slotId: number;
  status: string;
  bookingDate: string | null;
  serviceTitle: string;
  servicePrice: number;
  vendorName: string;
  slotDate: string;
  startTime: string;
  endTime: string;
  paymentStatus?: string;
  paymentAmount?: number;
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  accepted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  completed: "bg-green-500/10 text-green-400 border-green-500/20",
  cancelled: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

export default function CustomerBookings() {
  const { toast } = useToast();
  const [filter, setFilter] = useState("all");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  
  // Review dialog state
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewBooking, setReviewBooking] = useState<Booking | null>(null);

  // Reschedule dialog state
  const [rescheduleDialogOpen, setRescheduleDialogOpen] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(null);
  const [rescheduleSlots, setRescheduleSlots] = useState<{ id: number; slotDate: string; startTime: string; endTime: string; isAvailable: boolean }[]>([]);
  const [loadingRescheduleSlots, setLoadingRescheduleSlots] = useState(false);
  const [selectedRescheduleSlot, setSelectedRescheduleSlot] = useState<number | null>(null);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleSelectedDate, setRescheduleSelectedDate] = useState<string>("");

  const fetchBookings = async () => {
    setLoading(true);
    try {
      const url = filter === "all" ? "/api/bookings" : `/api/bookings?status=${filter}`;
      const response = await fetch(url, { credentials: "include" });
      const result = await response.json();

      if (result.ok) {
        setBookings(result.bookings);
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to fetch bookings.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while fetching bookings.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, [filter]);

  const handleCancelBooking = async () => {
    if (!cancellingId) return;

    try {
      const response = await fetch(`/api/bookings/${cancellingId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: "cancelled" }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Booking Cancelled",
          description: "Your booking has been cancelled successfully.",
        });
        fetchBookings();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to cancel booking.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while cancelling the booking.",
        variant: "destructive",
      });
    } finally {
      setCancellingId(null);
      setShowCancelDialog(false);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "Invalid Date";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return "Invalid Date";
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return "Invalid Date";
    }
  };

  const canCancel = (booking: Booking) => {
    return booking.status !== "cancelled" && booking.status !== "completed";
  };

  const canReview = (booking: Booking) => {
    return booking.status === "completed";
  };

  const handleOpenReviewDialog = (booking: Booking) => {
    setReviewBooking(booking);
    setReviewDialogOpen(true);
  };

  const handleReviewSubmitted = () => {
    fetchBookings(); // Refresh bookings list
  };

  const handleDownloadInvoice = async (bookingId: number) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/invoice`, {
        credentials: "include",
      });

      const result = await response.json();

      if (result.ok) {
        // Create a JSON file and trigger download
        const invoiceData = JSON.stringify(result.invoice, null, 2);
        const blob = new Blob([invoiceData], { type: "application/json" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${result.invoice.invoiceNumber}.json`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        toast({
          title: "Invoice Downloaded",
          description: "Your invoice has been downloaded successfully.",
        });
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to download invoice.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while downloading the invoice.",
        variant: "destructive",
      });
    }
  };

  const handleOpenReschedule = async (booking: Booking) => {
    setRescheduleBooking(booking);
    setSelectedRescheduleSlot(null);
    setRescheduleSelectedDate("");
    setRescheduleDialogOpen(true);
    setLoadingRescheduleSlots(true);
    try {
      const res = await fetch(
        `/api/availability?serviceId=${booking.serviceId}&fromDate=${new Date().toISOString().split("T")[0]}&includeBooked=false`,
        { credentials: "include" }
      );
      const data = await res.json();
      if (data.ok) {
        // Exclude the current slot
        const slots = (data.slots || []).filter((s: any) => s.id !== booking.slotId && s.isAvailable);
        setRescheduleSlots(slots);
        // Auto-select first date
        const dates = [...new Set(slots.map((s: any) => s.slotDate))].sort();
        if (dates.length > 0) setRescheduleSelectedDate(dates[0] as string);
      }
    } catch {
      toast({ title: "Error", description: "Failed to load available slots.", variant: "destructive" });
    } finally {
      setLoadingRescheduleSlots(false);
    }
  };

  const handleReschedule = async () => {
    if (!rescheduleBooking || !selectedRescheduleSlot) return;
    setRescheduling(true);
    try {
      const res = await fetch(`/api/bookings/${rescheduleBooking.id}/reschedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ newSlotId: selectedRescheduleSlot }),
      });
      const data = await res.json();
      if (data.ok) {
        toast({ title: "Rescheduled", description: "Your booking has been rescheduled successfully." });
        setRescheduleDialogOpen(false);
        fetchBookings();
      } else {
        toast({ title: "Error", description: data.error || "Failed to reschedule.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Error", description: "An error occurred while rescheduling.", variant: "destructive" });
    } finally {
      setRescheduling(false);
    }
  };

  const canReschedule = (booking: Booking) => {
    return booking.status === "pending" || booking.status === "accepted";
  };

  const formatSlotTime = (time: string) => {
    const [h, m] = time.split(":");
    const hour = parseInt(h);
    const ampm = hour >= 12 ? "PM" : "AM";
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatSlotDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <DashboardLayout role="customer">
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          {["all", "pending", "accepted", "rejected", "completed", "cancelled"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground hover:bg-muted"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading bookings...</div>
        ) : bookings.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Calendar size={48} className="mx-auto mb-4 opacity-50" />
            <p>No bookings found.</p>
          </div>
        ) : (
          <div className="rounded-2xl bg-secondary border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">ID</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Service</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden md:table-cell">Vendor</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Date & Time</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Price</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Status</th>
                  <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {bookings.map((b, i) => (
                  <motion.tr
                    key={b.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-5 py-3 text-foreground font-mono text-xs">#{b.id}</td>
                    <td className="px-5 py-3 text-foreground">{b.serviceTitle}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{b.vendorName}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">
                      {b.slotDate ? `${formatDate(b.slotDate)} ${b.startTime || ''}` : 'No date set'}
                    </td>
                    <td className="px-5 py-3 text-foreground font-medium">₹{b.servicePrice}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[b.status] || "bg-gray-500/10 text-gray-400 border-gray-500/20"}`}>
                        {b.status}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        {canReschedule(b) && (
                          <button
                            onClick={() => handleOpenReschedule(b)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            title="Reschedule booking"
                          >
                            <RefreshCw size={18} />
                          </button>
                        )}
                        {canReview(b) && (
                          <button
                            onClick={() => handleOpenReviewDialog(b)}
                            className="text-yellow-400 hover:text-yellow-300 transition-colors"
                            title="Rate service"
                          >
                            <Star size={18} />
                          </button>
                        )}
                        {canCancel(b) && (
                          <button
                            onClick={() => {
                              setCancellingId(b.id);
                              setShowCancelDialog(true);
                            }}
                            className="text-red-400 hover:text-red-300 transition-colors"
                            title="Cancel booking"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                        {b.paymentStatus === "success" && (
                          <button
                            onClick={() => handleDownloadInvoice(b.id)}
                            className="text-blue-400 hover:text-blue-300 transition-colors"
                            title="Download invoice"
                          >
                            <FileText size={18} />
                          </button>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel Booking</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to cancel this booking? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setCancellingId(null)}>Keep Booking</AlertDialogCancel>
              <AlertDialogAction onClick={handleCancelBooking} className="bg-red-500 hover:bg-red-600">
                Cancel Booking
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Review Dialog */}
        {reviewBooking && (
          <ReviewDialog
            isOpen={reviewDialogOpen}
            onClose={() => {
              setReviewDialogOpen(false);
              setReviewBooking(null);
            }}
            bookingId={reviewBooking.id}
            serviceId={reviewBooking.serviceId}
            serviceTitle={reviewBooking.serviceTitle}
            vendorName={reviewBooking.vendorName}
            onReviewSubmitted={handleReviewSubmitted}
          />
        )}

        {/* Reschedule Dialog */}
        <Dialog open={rescheduleDialogOpen} onOpenChange={(open) => {
          if (!open) {
            setRescheduleDialogOpen(false);
            setRescheduleBooking(null);
            setRescheduleSlots([]);
            setSelectedRescheduleSlot(null);
            setRescheduleSelectedDate('');
          }
        }}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Reschedule Booking</DialogTitle>
              <DialogDescription>
                {rescheduleBooking && (
                  <span>Choose a new slot for <strong>{rescheduleBooking.serviceTitle}</strong></span>
                )}
              </DialogDescription>
            </DialogHeader>

            {loadingRescheduleSlots ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Date buttons */}
                {(() => {
                  const uniqueDates = [...new Set(rescheduleSlots.map(s => s.date))].sort();
                  return uniqueDates.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {uniqueDates.map(d => (
                        <button
                          key={d}
                          onClick={() => setRescheduleSelectedDate(d)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                            rescheduleSelectedDate === d
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
                          }`}
                        >
                          {formatSlotDate(d)}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-4">No available slots found.</p>
                  );
                })()}

                {/* Slot grid */}
                {rescheduleSelectedDate && (
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {rescheduleSlots
                      .filter(s => s.date === rescheduleSelectedDate)
                      .map(slot => (
                        <button
                          key={slot.id}
                          onClick={() => setSelectedRescheduleSlot(slot.id)}
                          className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors ${
                            selectedRescheduleSlot === slot.id
                              ? 'bg-primary text-primary-foreground border-primary'
                              : 'bg-secondary text-muted-foreground border-border hover:border-primary/50'
                          }`}
                        >
                          {formatSlotTime(slot.startTime)} - {formatSlotTime(slot.endTime)}
                        </button>
                      ))}
                  </div>
                )}

                <button
                  onClick={handleReschedule}
                  disabled={!selectedRescheduleSlot || rescheduling}
                  className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
                >
                  {rescheduling ? 'Rescheduling...' : 'Confirm Reschedule'}
                </button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
