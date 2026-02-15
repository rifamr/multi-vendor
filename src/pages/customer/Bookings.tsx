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
        const inv = result.invoice;
        const formatDate = (d: string) => {
          if (!d) return "N/A";
          return new Date(d).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
        };
        const formatTime = (t: string) => {
          if (!t) return "";
          const [h, m] = t.split(":");
          const hr = parseInt(h);
          const ampm = hr >= 12 ? "PM" : "AM";
          return `${hr % 12 || 12}:${m} ${ampm}`;
        };

        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>Invoice ${inv.invoiceNumber}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; }
    .invoice-container { max-width: 800px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #f97316; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 32px; color: #f97316; font-weight: 700; }
    .header .invoice-meta { text-align: right; font-size: 14px; color: #555; }
    .header .invoice-meta strong { color: #1a1a1a; display: block; font-size: 16px; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 13px; text-transform: uppercase; letter-spacing: 1px; color: #f97316; font-weight: 600; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    .info-box { background: #fafafa; border: 1px solid #eee; border-radius: 8px; padding: 16px; }
    .info-box h3 { font-size: 15px; font-weight: 600; margin-bottom: 4px; }
    .info-box p { font-size: 13px; color: #666; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th { background: #f97316; color: #fff; text-align: left; padding: 10px 14px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px; }
    th:first-child { border-radius: 6px 0 0 0; }
    th:last-child { border-radius: 0 6px 0 0; text-align: right; }
    td { padding: 12px 14px; border-bottom: 1px solid #eee; font-size: 14px; }
    td:last-child { text-align: right; font-weight: 600; }
    .total-row { background: #fff7ed; }
    .total-row td { font-size: 16px; font-weight: 700; color: #f97316; border-bottom: none; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-paid { background: #dcfce7; color: #166534; }
    .badge-pending { background: #fef3c7; color: #92400e; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; font-size: 12px; color: #999; }
    @media print { body { padding: 20px; } .invoice-container { max-width: 100%; } }
  </style>
</head>
<body>
  <div class="invoice-container">
    <div class="header">
      <div>
        <h1>INVOICE</h1>
        <p style="color:#888; font-size:14px; margin-top:4px;">GigConnect Forge</p>
      </div>
      <div class="invoice-meta">
        <strong>${inv.invoiceNumber}</strong>
        <span>Date: ${formatDate(inv.invoiceDate)}</span>
      </div>
    </div>

    <div class="section">
      <div class="info-grid">
        <div class="info-box">
          <div class="section-title">Billed To</div>
          <h3>${inv.customer?.name || "Customer"}</h3>
          <p>${inv.customer?.email || ""}</p>
        </div>
        <div class="info-box">
          <div class="section-title">Service Provider</div>
          <h3>${inv.vendor?.businessName || inv.vendor?.name || "Vendor"}</h3>
          <p>${inv.vendor?.email || ""}</p>
          <p>${inv.vendor?.serviceArea || ""}</p>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Appointment Details</div>
      <div class="info-box">
        <p><strong>Date:</strong> ${formatDate(inv.appointment?.date)}</p>
        <p><strong>Time:</strong> ${formatTime(inv.appointment?.startTime)} – ${formatTime(inv.appointment?.endTime)}</p>
        <p><strong>Status:</strong> <span class="badge ${inv.bookingStatus === "completed" ? "badge-paid" : "badge-pending"}">${(inv.bookingStatus || "").toUpperCase()}</span></p>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Service Breakdown</div>
      <table>
        <thead>
          <tr>
            <th>Description</th>
            <th>Category</th>
            <th>Duration</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${inv.service?.title || "Service"}</td>
            <td>${inv.service?.category || ""}</td>
            <td>${inv.service?.duration || 0} min</td>
            <td>₹${Number(inv.service?.price || 0).toFixed(2)}</td>
          </tr>
          <tr class="total-row">
            <td colspan="3">Total</td>
            <td>₹${Number(inv.payment?.amount || inv.service?.price || 0).toFixed(2)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="section-title">Payment Information</div>
      <div class="info-box">
        <p><strong>Payment Status:</strong> <span class="badge ${inv.payment?.status === "paid" ? "badge-paid" : "badge-pending"}">${(inv.payment?.status || "pending").toUpperCase()}</span></p>
        ${inv.payment?.date ? `<p><strong>Payment Date:</strong> ${formatDate(inv.payment.date)}</p>` : ""}
        ${inv.payment?.id ? `<p><strong>Payment ID:</strong> #${inv.payment.id}</p>` : ""}
      </div>
    </div>

    <div class="footer">
      <p>Thank you for choosing GigConnect Forge!</p>
      <p>This is a computer-generated invoice and does not require a signature.</p>
    </div>
  </div>
</body>
</html>`;

        // Open a print window to allow PDF save
        const printWindow = window.open("", "_blank");
        if (printWindow) {
          printWindow.document.write(html);
          printWindow.document.close();
          printWindow.onload = () => {
            printWindow.print();
          };
        }

        toast({
          title: "Invoice Generated",
          description: "Use 'Save as PDF' in the print dialog to download.",
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
