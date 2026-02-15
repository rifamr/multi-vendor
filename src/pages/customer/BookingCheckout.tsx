import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { CreditCard, Lock, Check, ArrowLeft, Calendar, Clock, DollarSign } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useAuth } from "@/auth/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function BookingCheckout() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();

  const serviceId = searchParams.get('serviceId');
  const slotId = searchParams.get('slotId');
  const serviceTitle = searchParams.get('serviceTitle');
  const vendorName = searchParams.get('vendorName');
  const price = searchParams.get('price');
  const slotDate = searchParams.get('slotDate');
  const slotTime = searchParams.get('slotTime');

  const [processing, setProcessing] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);

  // Payment form state (simulated for now)
  const [cardNumber, setCardNumber] = useState('');
  const [cardExpiry, setCardExpiry] = useState('');
  const [cardCvv, setCardCvv] = useState('');
  const [cardName, setCardName] = useState('');

  useEffect(() => {
    if (!serviceId || !slotId) {
      toast({
        title: "Invalid Booking",
        description: "Missing booking details. Please try again.",
        variant: "destructive",
      });
      navigate('/customer/services');
    }
  }, [serviceId, slotId, navigate, toast]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!serviceId || !slotId) return;

    setProcessing(true);

    try {
      // Step 1: Create booking with payment initiated
      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          serviceId: Number(serviceId),
          slotId: Number(slotId),
          paymentStatus: 'initiated',
          paymentMethod: 'card',
        }),
      });

      const bookingResult = await bookingResponse.json();

      if (!bookingResult.ok) {
        throw new Error(bookingResult.error || 'Booking creation failed');
      }

      const bookingId = bookingResult.booking.id;

      // Step 2: Simulate payment processing (replace with Stripe later)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Simulate payment outcome (90% success rate for demo)
      const paymentSuccessful = Math.random() > 0.1;
      const paymentStatus = paymentSuccessful ? 'success' : 'failed';

      // Step 4: Update payment status
      const paymentResponse = await fetch(`/api/bookings/${bookingId}/payment`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ paymentStatus }),
      });

      const paymentResult = await paymentResponse.json();

      if (paymentSuccessful && paymentResult.ok) {
        setPaymentComplete(true);
        toast({
          title: "Booking Confirmed!",
          description: "Your booking has been successfully confirmed.",
        });

        // Redirect to bookings page after 2 seconds
        setTimeout(() => {
          navigate('/customer/bookings');
        }, 2000);
      } else {
        throw new Error('Payment processing failed. Please try again.');
      }
    } catch (err) {
      toast({
        title: "Payment Failed",
        description: err instanceof Error ? err.message : "Failed to process payment",
        variant: "destructive",
      });
    } finally {
      setProcessing(false);
    }
  };

  if (paymentComplete) {
    return (
      <DashboardLayout role="customer">
        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center py-16"
          >
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <Check size={40} className="text-white" />
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-3">
              Booking Confirmed!
            </h1>
            <p className="text-muted-foreground mb-6">
              Your booking has been successfully confirmed. You'll receive a confirmation email shortly.
            </p>
            <Button onClick={() => navigate('/customer/bookings')}>
              View My Bookings
            </Button>
          </motion.div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="customer">
      <div className="max-w-4xl mx-auto">
        <button
          onClick={() => navigate(-1)}
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary mb-6 transition-colors"
        >
          <ArrowLeft size={16} /> Back
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-1">
            Complete Your Booking
          </h1>
          <p className="text-muted-foreground">Review your booking details and complete payment</p>
        </motion.div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Booking Summary */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="lg:col-span-1"
          >
            <div className="card-floating p-6 sticky top-24">
              <h2 className="font-display font-semibold text-lg mb-4">Booking Summary</h2>
              
              <div className="space-y-4 mb-6">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Service</div>
                  <div className="font-medium">{serviceTitle}</div>
                </div>

                <div>
                  <div className="text-sm text-muted-foreground mb-1">Vendor</div>
                  <div className="font-medium">{vendorName}</div>
                </div>

                <div className="flex items-start gap-2">
                  <Calendar size={16} className="text-primary mt-1" />
                  <div>
                    <div className="text-sm text-muted-foreground">Date & Time</div>
                    <div className="font-medium">{slotDate}</div>
                    <div className="text-sm">{slotTime}</div>
                  </div>
                </div>

                <div className="pt-4 border-t border-border">
                  <div className="flex items-center justify-between text-lg font-bold">
                    <span>Total Amount</span>
                    <span className="text-primary">₹{price}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Lock size={12} />
                <span>Secure payment processing</span>
              </div>
            </div>
          </motion.div>

          {/* Payment Form */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="lg:col-span-2"
          >
            <div className="card-floating p-6">
              <div className="flex items-center gap-2 mb-6">
                <CreditCard className="text-primary" />
                <h2 className="font-display font-semibold text-lg">Payment Information</h2>
              </div>

              <div className="bg-primary/10 border border-primary/30 rounded-xl p-4 mb-6">
                <p className="text-sm text-primary font-medium">💳 Test Mode</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Use any test card number (e.g., 4242 4242 4242 4242) for testing
                </p>
              </div>

              <form onSubmit={handlePayment} className="space-y-4">
                <div>
                  <Label htmlFor="cardName">Cardholder Name</Label>
                  <Input
                    id="cardName"
                    placeholder="John Doe"
                    value={cardName}
                    onChange={(e) => setCardName(e.target.value)}
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="cardNumber">Card Number</Label>
                  <Input
                    id="cardNumber"
                    placeholder="4242 4242 4242 4242"
                    value={cardNumber}
                    onChange={(e) => setCardNumber(e.target.value.replace(/\s/g, '').replace(/(.{4})/g, '$1 ').trim())}
                    maxLength={19}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cardExpiry">Expiry Date</Label>
                    <Input
                      id="cardExpiry"
                      placeholder="MM/YY"
                      value={cardExpiry}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, '');
                        if (value.length >= 2) {
                          value = value.slice(0, 2) + '/' + value.slice(2, 4);
                        }
                        setCardExpiry(value);
                      }}
                      maxLength={5}
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="cardCvv">CVV</Label>
                    <Input
                      id="cardCvv"
                      placeholder="123"
                      type="password"
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                      maxLength={4}
                      required
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span>
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <Lock size={16} className="mr-2" />
                        Pay ₹{price}
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-xs text-center text-muted-foreground">
                  By confirming payment, you agree to the booking terms and conditions
                </p>
              </form>
            </div>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
