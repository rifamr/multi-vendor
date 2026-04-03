import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

type Coordinates = { lat: number; lng: number };

type EmergencyMapProps = {
  userLocation: Coordinates;
  vendorLocation?: Coordinates | null;
  showRoute?: boolean;
  className?: string;
};

const userIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

const vendorIcon = new L.Icon({
  iconUrl: "https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-icon-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

export default function EmergencyMap({
  userLocation,
  vendorLocation,
  showRoute = false,
  className,
}: EmergencyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const userMarkerRef = useRef<L.Marker | null>(null);
  const vendorMarkerRef = useRef<L.Marker | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      userMarkerRef.current = null;
      vendorMarkerRef.current = null;
      polylineRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.remove();
      userMarkerRef.current = null;
    }
    if (vendorMarkerRef.current) {
      vendorMarkerRef.current.remove();
      vendorMarkerRef.current = null;
    }
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }

    userMarkerRef.current = L.marker([userLocation.lat, userLocation.lng], {
      icon: userIcon,
    }).addTo(map);

    if (vendorLocation) {
      vendorMarkerRef.current = L.marker([vendorLocation.lat, vendorLocation.lng], {
        icon: vendorIcon,
      }).addTo(map);

      if (showRoute) {
        polylineRef.current = L.polyline(
          [
            [userLocation.lat, userLocation.lng],
            [vendorLocation.lat, vendorLocation.lng],
          ],
          { color: "#ef4444", weight: 5, opacity: 0.7 }
        ).addTo(map);
      }

      const bounds = L.latLngBounds([
        [userLocation.lat, userLocation.lng],
        [vendorLocation.lat, vendorLocation.lng],
      ]);
      map.fitBounds(bounds, { padding: [32, 32] });
      return;
    }

    map.setView([userLocation.lat, userLocation.lng], 14);
  }, [showRoute, userLocation, vendorLocation]);

  return (
    <div
      ref={containerRef}
      className={className ?? "rounded-xl overflow-hidden border border-border h-72"}
    />
  );
}