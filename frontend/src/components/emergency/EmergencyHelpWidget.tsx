import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, LocateFixed, Loader2, Send } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getSocket } from "@/lib/socket";
import EmergencyMap from "./EmergencyMap";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

type Coordinates = { lat: number; lng: number };

type AssignedPayload = {
  requestId: number;
  status: "accepted" | "pending" | "completed";
  vendorId: number;
  vendorBusinessName?: string;
  vendorPhoneNumber?: string | null;
  vendorLatitude?: number | null;
  vendorLongitude?: number | null;
  userLatitude?: number;
  userLongitude?: number;
};

type ReassigningPayload = {
  requestId: number;
  message?: string;
  nextRadiusKm?: number;
};

type StatusResponse = {
  ok: boolean;
  request: {
    id: number;
    status: "pending" | "accepted" | "completed";
    latitude: number;
    longitude: number;
    vendorLatitude: number | null;
    vendorLongitude: number | null;
    vendorBusinessName: string | null;
    vendorPhoneNumber: string | null;
  };
};

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadius = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);

  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;

  return 2 * earthRadius * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export default function EmergencyHelpWidget() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [issue, setIssue] = useState("");
  const [requestId, setRequestId] = useState<number | null>(null);
  const [status, setStatus] = useState<"idle" | "finding" | "reassigning" | "assigned" | "completed">("idle");
  const [nearbyCount, setNearbyCount] = useState(0);
  const [countdownSec, setCountdownSec] = useState(30);
  const [vendorName, setVendorName] = useState<string | null>(null);
  const [vendorPhone, setVendorPhone] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string>("Finding nearby vendors...");
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [vendorLocation, setVendorLocation] = useState<Coordinates | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const trackerRef = useRef<number | null>(null);
  const watchRef = useRef<number | null>(null);
  const lastSentAtRef = useRef<number>(0);
  const lastSentLocationRef = useRef<Coordinates | null>(null);
  const socket = useMemo(() => getSocket(), []);

  useEffect(() => {
    const onAssigned = (payload: AssignedPayload) => {
      if (!requestId || payload.requestId !== requestId) return;
      setStatus("assigned");
      setVendorName(payload.vendorBusinessName || "Assigned vendor");
      setVendorPhone(payload.vendorPhoneNumber ?? null);

      if (typeof payload.userLatitude === "number" && typeof payload.userLongitude === "number") {
        setUserLocation({ lat: payload.userLatitude, lng: payload.userLongitude });
      }

      if (typeof payload.vendorLatitude === "number" && typeof payload.vendorLongitude === "number") {
        setVendorLocation({ lat: payload.vendorLatitude, lng: payload.vendorLongitude });
      }

      toast({
        title: "Vendor assigned",
        description: payload.vendorBusinessName
          ? `${payload.vendorBusinessName} accepted your emergency request.`
          : "A nearby vendor accepted your emergency request.",
      });
    };

    const onReassigning = (payload: ReassigningPayload) => {
      if (!requestId || payload.requestId !== requestId) return;
      setStatus("reassigning");
      setCountdownSec(30);
      setSearchMessage(payload.message || "Reassigning vendors...");
      toast({
        title: "Reassigning vendors",
        description: payload.message || "Expanding search radius to find more vendors.",
      });
    };

    const onNoVendor = (payload: { requestId: number; message?: string }) => {
      if (!requestId || payload.requestId !== requestId) return;
      setSearchMessage(payload.message || "No vendors found currently.");
      toast({
        title: "No vendor found",
        description: payload.message || "Please wait while we keep searching.",
        variant: "destructive",
      });
    };

    const onCompleted = (payload: { requestId: number }) => {
      if (!requestId || payload.requestId !== requestId) return;
      setStatus("completed");
    };

    const onSocketDisconnected = () => {
      toast({
        title: "Realtime connection lost",
        description: "Trying to reconnect emergency updates...",
        variant: "destructive",
      });
    };

    const onSocketConnected = () => {
      if (requestId) {
        toast({
          title: "Realtime connection restored",
          description: "Emergency updates resumed.",
        });
      }
    };

    socket.on("emergency:assigned", onAssigned);
    socket.on("emergency:reassigning", onReassigning);
    socket.on("emergency:no-vendor", onNoVendor);
    socket.on("emergency:completed", onCompleted);
    socket.on("disconnect", onSocketDisconnected);
    socket.on("connect", onSocketConnected);
    return () => {
      socket.off("emergency:assigned", onAssigned);
      socket.off("emergency:reassigning", onReassigning);
      socket.off("emergency:no-vendor", onNoVendor);
      socket.off("emergency:completed", onCompleted);
      socket.off("disconnect", onSocketDisconnected);
      socket.off("connect", onSocketConnected);
    };
  }, [requestId, socket, toast]);

  useEffect(() => {
    if (status !== "finding" && status !== "reassigning") return;

    setCountdownSec(30);
    const countdownId = window.setInterval(() => {
      setCountdownSec((prev) => (prev <= 1 ? 30 : prev - 1));
    }, 1000);

    return () => window.clearInterval(countdownId);
  }, [status]);

  useEffect(() => {
    if (!requestId || (status !== "finding" && status !== "reassigning" && status !== "assigned")) return;

    const poll = async () => {
      try {
        const res = await fetch(`/api/emergency-status/${requestId}`, { credentials: "include" });
        if (!res.ok) return;

        const data = (await res.json()) as StatusResponse;
        const req = data.request;

        setUserLocation({ lat: req.latitude, lng: req.longitude });

        if (req.status === "accepted") {
          setStatus("assigned");
          setVendorName(req.vendorBusinessName || vendorName);
          setVendorPhone(req.vendorPhoneNumber ?? vendorPhone);
          if (typeof req.vendorLatitude === "number" && typeof req.vendorLongitude === "number") {
            setVendorLocation({ lat: req.vendorLatitude, lng: req.vendorLongitude });
          }
        }

        if (req.status === "completed") {
          setStatus("completed");
        }
      } catch {
        // silent polling failure
      }
    };

    const id = window.setInterval(poll, 7000);
    void poll();

    return () => window.clearInterval(id);
  }, [requestId, status, vendorName, vendorPhone]);

  useEffect(() => {
    if (!requestId || (status !== "finding" && status !== "reassigning" && status !== "assigned")) return;

    const pushLocation = async (coords: Coordinates) => {
      const now = Date.now();
      const lastLocation = lastSentLocationRef.current;
      const movedEnough = !lastLocation || distanceMeters(lastLocation, coords) >= 12;
      const waitedEnough = now - lastSentAtRef.current >= 7000;
      if (!movedEnough || !waitedEnough) return;

      lastSentAtRef.current = now;
      lastSentLocationRef.current = coords;

      await fetch("/api/emergency-location", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requestId,
          latitude: coords.lat,
          longitude: coords.lng,
        }),
      });
    };

    watchRef.current = navigator.geolocation.watchPosition(
      (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);
        void pushLocation(coords);
      },
      () => {
        // ignore if location fetch fails after request created
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 3000 }
    );

    trackerRef.current = window.setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(coords);
          void pushLocation(coords);
        },
        () => {
          // backup refresh only
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }, 12000);

    return () => {
      if (trackerRef.current) {
        window.clearInterval(trackerRef.current);
      }
      if (watchRef.current != null) {
        navigator.geolocation.clearWatch(watchRef.current);
      }
    };
  }, [requestId, status]);

  const handleEmergencySubmit = async () => {
    if (!issue.trim()) {
      toast({
        title: "Issue required",
        description: "Please describe the emergency before requesting help.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const coords = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        setUserLocation(coords);

        try {
          const res = await fetch("/api/emergency-request", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: coords.lat,
              longitude: coords.lng,
              issue: issue.trim(),
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Unable to create emergency request");

          setRequestId(data.requestId);
          setStatus("finding");
          setSearchMessage("Finding nearby vendors...");
          setCountdownSec(typeof data.retryInSeconds === "number" ? data.retryInSeconds : 30);
          setNearbyCount(Array.isArray(data.nearbyVendors) ? data.nearbyVendors.length : 0);

          toast({
            title: "Emergency request created",
            description: "Finding nearby vendors...",
          });
        } catch (error: any) {
          toast({
            title: "Emergency failed",
            description: error?.message || "Could not send emergency request",
            variant: "destructive",
          });
        } finally {
          setSubmitting(false);
        }
      },
      () => {
        setSubmitting(false);
        toast({
          title: "Location unavailable",
          description: "Please allow location permission to request emergency help.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const resetEmergency = () => {
    setIssue("");
    setRequestId(null);
    setStatus("idle");
    setCountdownSec(30);
    setNearbyCount(0);
    setVendorName(null);
    setVendorPhone(null);
    setSearchMessage("Finding nearby vendors...");
    setUserLocation(null);
    setVendorLocation(null);
    if (trackerRef.current) {
      window.clearInterval(trackerRef.current);
      trackerRef.current = null;
    }
    if (watchRef.current != null) {
      navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    }
    lastSentAtRef.current = 0;
    lastSentLocationRef.current = null;
  };

  return (
    <div className="rounded-[8px] border border-[#7f1d1d] bg-[#1a0a0a] px-4 py-[10px] min-h-[40px]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-sm leading-tight">
          <AlertTriangle size={14} className="text-[#dc2626]" aria-hidden="true" />
          <span className="font-semibold text-foreground">Emergency Breakdown Assistance</span>
          <span className="text-muted-foreground">Alert vendors within 5 km</span>
        </div>

        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next && status === "idle") resetEmergency();
          }}
        >
          <DialogTrigger asChild>
            <Button
              className="rounded-[6px] bg-[#dc2626] px-[14px] py-[6px] text-xs font-medium text-white hover:bg-[#b91c1c]"
            >
              Emergency Help
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Emergency Help</DialogTitle>
              <DialogDescription>
                We will detect your current GPS location and notify nearest vendors.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">Issue details</label>
                <Textarea
                  value={issue}
                  onChange={(e) => setIssue(e.target.value)}
                  placeholder="Describe your breakdown or emergency issue"
                  rows={3}
                  disabled={status !== "idle"}
                />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  onClick={handleEmergencySubmit}
                  disabled={submitting || status !== "idle"}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  {submitting ? (
                    <>
                      <Loader2 size={16} className="mr-2 animate-spin" /> Sending...
                    </>
                  ) : (
                    <>
                      <Send size={16} className="mr-2" /> Send Emergency Request
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    resetEmergency();
                    setOpen(false);
                  }}
                >
                  Close
                </Button>
              </div>

              {(status === "finding" || status === "reassigning") && (
                <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 px-4 py-3 text-sm text-orange-300">
                  <div className="flex items-center gap-2">
                    <LocateFixed size={16} />
                    <span className="font-medium">
                      {status === "reassigning" ? "Reassigning vendors" : "Finding nearby vendors"}
                    </span>
                    {nearbyCount > 0 && (
                      <span className="text-xs text-orange-200">
                        ({nearbyCount} vendor{nearbyCount > 1 ? "s" : ""} notified)
                      </span>
                    )}
                    <span className="ml-auto text-xs text-orange-200">Retry in {countdownSec}s</span>
                  </div>
                  <p className="mt-1 text-xs text-orange-200">{searchMessage}</p>
                </div>
              )}

              {status === "assigned" && (
                <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
                  <div>Vendor assigned{vendorName ? `: ${vendorName}` : ""}</div>
                  {vendorPhone && <div className="mt-1 text-xs text-green-200">Contact: {vendorPhone}</div>}
                </div>
              )}

              {status === "completed" && (
                <div className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-300">
                  Emergency support completed.
                </div>
              )}

              {userLocation && (
                <EmergencyMap
                  userLocation={userLocation}
                  vendorLocation={vendorLocation}
                  showRoute={status === "assigned"}
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
