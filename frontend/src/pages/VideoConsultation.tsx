import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2, PhoneOff } from "lucide-react";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";

type VideoTokenResponse = {
  ok: boolean;
  appId: number;
  token: string;
  roomId: string;
  userId: string;
  userName: string;
  error?: string;
};

export default function VideoConsultation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const zegoRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bookingId = searchParams.get("bookingId") ?? "";
  const role = searchParams.get("role") === "vendor" ? "vendor" : "customer";

  const returnPath = useMemo(
    () => (role === "vendor" ? "/vendor/bookings" : "/customer/bookings"),
    [role]
  );

  const leaveRoom = () => {
    try {
      zegoRef.current?.destroy?.();
    } catch {
      // no-op
    }
    navigate(returnPath);
  };

  useEffect(() => {
    let isCancelled = false;

    const initRoom = async () => {
      if (!bookingId) {
        setError("Missing bookingId in query params");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/bookings/${bookingId}/video-token`, {
          credentials: "include",
        });
        const data = (await res.json()) as VideoTokenResponse;

        if (!res.ok || !data.ok || !data.token) {
          throw new Error(data.error || "Unable to initialize video consultation");
        }

        if (isCancelled || !containerRef.current) return;

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForProduction(
          data.appId,
          data.token,
          data.roomId,
          data.userId,
          data.userName
        );

        const zp = ZegoUIKitPrebuilt.create(kitToken);
        zegoRef.current = zp;

        zp.joinRoom({
          container: containerRef.current,
          scenario: { mode: ZegoUIKitPrebuilt.OneONoneCall },
          showScreenSharingButton: false,
          showUserList: false,
          showRoomTimer: true,
          onLeaveRoom: () => {
            navigate(returnPath);
          },
        });
      } catch (err: any) {
        if (!isCancelled) {
          setError(err?.message || "Failed to load video consultation");
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    initRoom();

    return () => {
      isCancelled = true;
      try {
        zegoRef.current?.destroy?.();
      } catch {
        // no-op
      }
    };
  }, [bookingId, navigate, returnPath]);

  return (
    <div className="min-h-screen bg-background text-foreground p-4 md:p-6">
      <div className="mx-auto w-full max-w-7xl space-y-4">
        <div className="rounded-2xl bg-secondary border border-border p-4 md:p-5 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-foreground">Video Consultation</h1>
            <p className="text-sm text-muted-foreground">Booking #{bookingId || "-"}</p>
          </div>
          <button
            type="button"
            onClick={leaveRoom}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            <PhoneOff size={16} />
            Leave Call
          </button>
        </div>

        <div className="rounded-2xl bg-secondary border border-border overflow-hidden">
          {loading && (
            <div className="h-[calc(100vh-210px)] flex items-center justify-center text-muted-foreground">
              <div className="inline-flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading video consultation...
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="h-[calc(100vh-210px)] flex items-center justify-center p-6 text-center">
              <div className="max-w-md">
                <p className="text-red-400 font-medium">Unable to start video consultation</p>
                <p className="text-sm text-muted-foreground mt-1">{error}</p>
                <button
                  type="button"
                  onClick={() => navigate(returnPath)}
                  className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  Back to Bookings
                </button>
              </div>
            </div>
          )}

          <div
            ref={containerRef}
            className={`${loading || error ? "hidden" : "block"} h-[calc(100vh-210px)] w-full bg-muted/20`}
          />
        </div>
      </div>
    </div>
  );
}
