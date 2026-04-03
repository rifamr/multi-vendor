import { useEffect, useMemo, useState } from "react";
import { Navigation, Loader2, CheckCircle2, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getSocket } from "@/lib/socket";

type IncomingEmergency = {
  requestId: number;
  issue: string;
  latitude: number;
  longitude: number;
  vendorLatitude?: number | null;
  vendorLongitude?: number | null;
  distanceKm: number;
  vendorRating?: number;
  vendorAvailable?: boolean;
  createdAt: string;
};

export default function VendorEmergencyPanel() {
  const { toast } = useToast();
  const [requests, setRequests] = useState<IncomingEmergency[]>([]);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);
  const socket = useMemo(() => getSocket(), []);
  const activeRequest = requests[0] ?? null;

  const upsertRequest = (payload: IncomingEmergency) => {
    setRequests((prev) => {
      const index = prev.findIndex((req) => req.requestId === payload.requestId);
      if (index === -1) return [payload, ...prev].slice(0, 10);
      const next = [...prev];
      next[index] = { ...next[index], ...payload };
      return next;
    });
  };

  const handleUpdateLocation = () => {
    setUpdatingLocation(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const res = await fetch("/api/vendor/location", {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            }),
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data?.error || "Failed to update location");

          toast({
            title: "Location updated",
            description: "You can now receive nearby emergency requests.",
          });
        } catch (error: any) {
          toast({
            title: "Location update failed",
            description: error?.message || "Could not save your location",
            variant: "destructive",
          });
        } finally {
          setUpdatingLocation(false);
        }
      },
      () => {
        setUpdatingLocation(false);
        toast({
          title: "Location permission needed",
          description: "Please allow location access to receive nearby emergencies.",
          variant: "destructive",
        });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
  };

  useEffect(() => {
    const onNewRequest = (payload: IncomingEmergency) => {
      upsertRequest(payload);

      toast({
        title: "Emergency request nearby",
        description: `${payload.distanceKm.toFixed(2)} km away`,
      });
    };

    const onClosed = (payload: { requestId: number }) => {
      setRequests((prev) => prev.filter((req) => req.requestId !== payload.requestId));
    };

    const onSocketDisconnected = () => {
      toast({
        title: "Realtime connection lost",
        description: "Emergency updates paused. Reconnecting...",
        variant: "destructive",
      });
    };

    const onSocketConnected = () => {
      toast({
        title: "Realtime connection restored",
        description: "You will receive emergency alerts now.",
      });
    };

    const onSocketConnectError = () => {
      toast({
        title: "Realtime auth issue",
        description: "Live alerts delayed. Using backup refresh.",
        variant: "destructive",
      });
    };

    socket.on("emergency:new-request", onNewRequest);
    socket.on("emergency:closed", onClosed);
    socket.on("disconnect", onSocketDisconnected);
    socket.on("connect", onSocketConnected);
    socket.on("connect_error", onSocketConnectError);

    return () => {
      socket.off("emergency:new-request", onNewRequest);
      socket.off("emergency:closed", onClosed);
      socket.off("disconnect", onSocketDisconnected);
      socket.off("connect", onSocketConnected);
      socket.off("connect_error", onSocketConnectError);
    };
  }, [socket, toast]);

  useEffect(() => {
    let isMounted = true;

    const pullFeed = async () => {
      try {
        const res = await fetch("/api/vendor/emergency-feed", { credentials: "include" });
        if (!res.ok) return;

        const data = (await res.json()) as {
          ok: boolean;
          requests?: IncomingEmergency[];
        };

        if (!isMounted || !Array.isArray(data.requests)) return;
        for (const req of data.requests) upsertRequest(req);
      } catch {
        // polling fallback should fail silently
      }
    };

    const intervalId = window.setInterval(() => {
      void pullFeed();
    }, 6000);

    void pullFeed();

    return () => {
      isMounted = false;
      window.clearInterval(intervalId);
    };
  }, []);

  const handleAcceptNearest = async () => {
    const target = requests[0];
    if (!target) {
      toast({
        title: "No active request",
        description: "There is no emergency request to accept right now.",
      });
      return;
    }

    setAcceptingId(target.requestId);
    try {
      const res = await fetch("/api/accept-emergency", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: target.requestId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to accept emergency");

      setRequests((prev) => prev.filter((req) => req.requestId !== target.requestId));
      toast({
        title: "Emergency accepted",
        description: "You are now assigned to this emergency request.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to accept",
        description: error?.message || "This emergency may already be assigned.",
        variant: "destructive",
      });
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <div className="rounded-[8px] border border-[#7f1d1d] bg-[#1a0a0a] px-4 py-[10px] min-h-[40px]">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2 text-sm leading-tight">
          <BellRing size={14} className="text-[#dc2626]" aria-hidden="true" />
          <span className="font-semibold text-[#b45353]">Nearby Emergency Requests</span>
          {requests.length > 0 ? (
            <>
              <span
                className="inline-flex h-2.5 w-2.5 animate-pulse rounded-full bg-[#dc2626]"
                aria-label="Active emergency requests"
                title="Active emergency requests"
              />
              <span className="rounded-full border border-[#7f1d1d] bg-[#2a0f0f] px-2 py-0.5 text-[11px] font-medium text-[#fca5a5]">
                {requests.length} new
              </span>
              {activeRequest && (
                <span className="max-w-[320px] truncate text-[#c9a3a3]">
                  {activeRequest.distanceKm.toFixed(2)} km • {activeRequest.issue}
                </span>
              )}
            </>
          ) : (
            <span className="text-[#a78b8b]">No active requests right now</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {requests.length > 0 && (
            <Button
              onClick={handleAcceptNearest}
              disabled={acceptingId != null}
              className="h-auto rounded-[6px] border border-[#7f1d1d] bg-[#dc2626] px-[14px] py-[6px] text-xs font-medium text-white hover:bg-[#b91c1c]"
            >
              {acceptingId != null ? (
                <>
                  <Loader2 size={14} className="mr-2 animate-spin" /> Accepting...
                </>
              ) : (
                <>
                  <CheckCircle2 size={14} className="mr-2" /> Accept Now
                </>
              )}
            </Button>
          )}

          <Button
            onClick={handleUpdateLocation}
            disabled={updatingLocation}
            className="h-auto rounded-[6px] border border-white/20 bg-[#111111] px-[14px] py-[6px] text-xs font-medium text-white hover:bg-[#1b1b1b]"
          >
            {updatingLocation ? (
              <>
                <Loader2 size={14} className="mr-2 animate-spin" /> Updating location...
              </>
            ) : (
              <>
                <Navigation size={14} className="mr-2" /> Update My Location
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
