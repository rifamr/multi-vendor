import { useParams, Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Clock, ArrowLeft, User, MapPin, Calendar, MessageSquare } from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";
import { useState, useEffect } from "react";
import { useQuery } from "@apollo/client";
import { GET_SERVICE_BY_ID } from "@/graphql/serviceQueries";
import { useAuth } from "@/auth/AuthContext";
import { useToast } from "@/hooks/use-toast";

type AvailabilitySlot = {
  id: number;
  vendorId: number;
  serviceId: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

type Review = {
  id: number;
  rating: number;
  comment: string | null;
  customerName: string | null;
  createdAt: string;
};

export default function ServiceDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedSlot, setSelectedSlot] = useState<number | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [booking, setBooking] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [showReviews, setShowReviews] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

  const serviceId = id ?? "1";

  const { data, loading, error } = useQuery(GET_SERVICE_BY_ID, {
    variables: { id: serviceId },
  });

  const service = data?.service as
    | {
        id: string;
        title: string;
        description: string;
        price: number;
        duration: string;
        image?: string | null;
        rating: number;
        reviews: number;
        category: { id: string; name: string };
        vendor: { id: string; displayName: string; city: string; region: string };
      }
    | undefined;

  // Fetch available slots for this service
  useEffect(() => {
    if (!serviceId) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      try {
        const url = `/api/availability?serviceId=${serviceId}&fromDate=${new Date().toISOString().split("T")[0]}&includeBooked=true`;
        console.log("[Customer ServiceDetails] Fetching slots from:", url);
        const response = await fetch(url, { credentials: "include" });
        const result = await response.json();
        console.log("[Customer ServiceDetails] Slots received:", result.slots);
        if (result.ok) {
          setAvailableSlots(result.slots);
        }
      } catch (err) {
        console.error("Failed to fetch slots:", err);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [serviceId]);

  // Fetch reviews
  useEffect(() => {
    if (!serviceId) return;
    fetch(`/api/services/${serviceId}/reviews`, { credentials: "include" })
      .then(res => res.json())
      .then(result => {
        if (result.ok) setReviews(result.reviews ?? []);
      })
      .catch(() => {});
  }, [serviceId]);

  const handleBookNow = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to book this service.",
        variant: "destructive",
      });
      navigate("/login");
      return;
    }

    if (user.role !== "customer") {
      toast({
        title: "Access Denied",
        description: "Only customers can book services.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedSlot) {
      toast({
        title: "No Slot Selected",
        description: "Please select a time slot first.",
        variant: "destructive",
      });
      return;
    }

    setBooking(true);
    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          serviceId: Number(serviceId),
          slotId: selectedSlot,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Booking Successful!",
          description: "Your booking has been created and is pending vendor approval.",
        });
        navigate("/customer/bookings");
      } else {
        toast({
          title: "Booking Failed",
          description: result.error || "Failed to create booking.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while creating the booking.",
        variant: "destructive",
      });
    } finally {
      setBooking(false);
    }
  };

  const formatSlotTime = (slot: AvailabilitySlot) => {
    const [h, m] = (slot.startTime || '').split(':');
    const hour = parseInt(h);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${m} ${ampm}`;
  };

  const formatSlotDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Get unique sorted dates from available slots
  const availableDates = [...new Set(availableSlots.map(s => s.slotDate))].sort(
    (a, b) => new Date(a).getTime() - new Date(b).getTime()
  );

  // Auto-select first available date when slots load
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(availableDates[0]);
    }
  }, [availableSlots]);

  // Filter slots by selected date
  const filteredSlots = selectedDate
    ? availableSlots.filter(s => s.slotDate === selectedDate)
    : availableSlots;

  const selectedSlotDetails = selectedSlot
    ? availableSlots.find((s) => s.id === selectedSlot)
    : null;

  if (error) {
    return (
      <PublicLayout>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Link to="/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
            <ArrowLeft size={16} /> Back to Services
          </Link>
          <div className="text-center py-20">
            <p className="text-muted-foreground">Failed to load service details.</p>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link to="/services" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors">
          <ArrowLeft size={16} /> Back to Services
        </Link>

        {loading || !service ? (
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="rounded-3xl bg-muted h-64 md:h-80" />
              <div className="space-y-3">
                <div className="h-7 w-2/3 bg-muted rounded" />
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="h-20 w-full bg-muted rounded" />
              </div>
            </div>
            <div className="space-y-6">
              <div className="card-floating p-6">
                <div className="h-10 w-1/2 bg-muted rounded" />
                <div className="mt-4 h-10 w-full bg-muted rounded" />
              </div>
              <div className="card-floating p-6">
                <div className="h-4 w-1/2 bg-muted rounded" />
                <div className="mt-4 h-10 w-2/3 bg-muted rounded" />
              </div>
            </div>
          </div>
        ) : (

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-3xl bg-muted h-64 md:h-80 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              <span className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">{service.category.name}</span>
            </motion.div>

            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
              <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-2">{service.title}</h1>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-1">
                  <Star size={16} className="fill-primary text-primary" />
                  <span className="font-medium text-foreground">{service.rating}</span>
                  <span className="text-sm text-muted-foreground">({service.reviews} reviews)</span>
                </div>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock size={14} /> {service.duration}
                </div>
              </div>
              <p className="text-muted-foreground leading-relaxed">{service.description}</p>
            </motion.div>

            {/* Time Slots */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
              <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                <Calendar size={18} className="text-primary" /> Available Time Slots
              </h3>

              {/* Date Picker */}
              {loadingSlots ? (
                <div className="text-sm text-muted-foreground">Loading available slots...</div>
              ) : availableDates.length === 0 ? (
                <div className="text-sm text-muted-foreground">No available slots at the moment. Please check back later.</div>
              ) : (
                <>
                  <div className="mb-4">
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Date</label>
                    <div className="flex flex-wrap gap-2">
                      {availableDates.map((date) => (
                        <button
                          key={date}
                          onClick={() => { setSelectedDate(date); setSelectedSlot(null); }}
                          className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                            selectedDate === date
                              ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                              : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                          }`}
                        >
                          {formatSlotDate(date)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {filteredSlots.length === 0 ? (
                    <div className="text-sm text-muted-foreground">No available slots for this date. Try another date.</div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                      {filteredSlots
                        .sort((a, b) => a.startTime.localeCompare(b.startTime))
                        .map((slot) => (
                          <button
                            key={slot.id}
                            onClick={() => slot.isAvailable && setSelectedSlot(slot.id)}
                            disabled={!slot.isAvailable}
                            className={`px-3 py-2 rounded-xl text-xs font-medium transition-all ${
                              !slot.isAvailable
                                ? "bg-red-500/10 text-red-400 border border-red-500/20 cursor-not-allowed opacity-60 line-through"
                                : selectedSlot === slot.id
                                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                                : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                            }`}
                            title={!slot.isAvailable ? "This slot is already booked" : "Click to select this slot"}
                          >
                            {formatSlotTime(slot)}
                            {!slot.isAvailable && <span className="block text-[10px] no-underline" style={{ textDecoration: 'none' }}>Booked</span>}
                          </button>
                        ))}
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6 lg:sticky lg:top-24 lg:self-start">
            {/* Pricing Card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="card-floating p-6 bg-gradient-to-b from-primary/20 to-primary/10 border border-primary/30 shadow-xl shadow-primary/15"
            >
              <div className="mb-4">
                <span className="text-3xl font-display font-bold text-foreground">₹{service.price}</span>
                <span className="text-sm text-muted-foreground ml-1">/ session</span>
              </div>
              <div className="space-y-3 mb-6 text-sm">
                <div className="flex justify-between text-foreground">
                  <span>Duration</span><span className="font-medium">{service.duration}</span>
                </div>
                <div className="flex justify-between text-foreground">
                  <span>Category</span><span className="font-medium">{service.category.name}</span>
                </div>
                {selectedSlotDetails && (
                  <div className="flex justify-between text-foreground">
                    <span>Selected</span><span className="font-medium text-primary">{formatSlotDate(selectedSlotDetails.slotDate)} {formatSlotTime(selectedSlotDetails)}</span>
                  </div>
                )}
              </div>
              <button
                onClick={handleBookNow}
                disabled={booking || !selectedSlot}
                className="w-full py-3 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {booking ? "Booking..." : "Book Now"}
              </button>
            </motion.div>

            {/* Vendor Card */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="card-floating p-6">
              <h3 className="font-display font-semibold text-card-foreground mb-4 text-sm">About the Vendor</h3>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <User size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium text-sm text-card-foreground">{service.vendor.displayName}</p>
                  <div className="flex items-center gap-1">
                    <Star size={12} className="fill-primary text-primary" />
                    <span className="text-xs text-muted-foreground">{service.rating} rating</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin size={12} /> {service.vendor.city}, {service.vendor.region}
              </div>
              <button
                onClick={() => setShowReviews(!showReviews)}
                className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
              >
                <MessageSquare size={14} />
                {reviews.length > 0 ? `Reviews (${reviews.length})` : "No Reviews Yet"}
              </button>
              {showReviews && reviews.length > 0 && (
                <div className="mt-3 space-y-3 max-h-60 overflow-y-auto">
                  {reviews.map((r) => (
                    <div key={r.id} className="p-3 rounded-xl bg-muted/50 border border-border">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium text-foreground">{r.customerName || "Customer"}</span>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} size={10} className={i < r.rating ? "fill-primary text-primary" : "text-muted-foreground/30"} />
                          ))}
                        </div>
                      </div>
                      {r.comment && <p className="text-xs text-muted-foreground">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          </div>
        </div>

        )}
      </div>
    </PublicLayout>
  );
}
