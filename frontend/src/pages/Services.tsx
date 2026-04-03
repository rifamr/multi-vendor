import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, MapPin } from "lucide-react";
import PublicLayout from "@/components/layouts/PublicLayout";
import ServiceCard from "@/components/ServiceCard";
import { useQuery } from "@apollo/client";
import { GET_CATEGORIES, GET_SERVICES } from "@/graphql/serviceQueries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PriceRangeId = "UNDER_50" | "50_100" | "100_200" | "200_PLUS";

function priceRangeToMinMax(id: PriceRangeId): { minPrice?: number; maxPrice?: number } {
  switch (id) {
    case "UNDER_50":
      return { maxPrice: 50 };
    case "50_100":
      return { minPrice: 50, maxPrice: 100 };
    case "100_200":
      return { minPrice: 100, maxPrice: 200 };
    case "200_PLUS":
      return { minPrice: 200 };
  }
}

const LOCATION_KEY = "servicebook_location";

export default function Services() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRangeId | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);

  // Location state
  const [selectedLocation, setSelectedLocation] = useState<string | null>(() => {
    return localStorage.getItem(LOCATION_KEY);
  });
  const [showLocationPicker, setShowLocationPicker] = useState(!localStorage.getItem(LOCATION_KEY));
  const [availableLocations, setAvailableLocations] = useState<string[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(true);

  useEffect(() => {
    fetch("/api/locations", { credentials: "include" })
      .then((res) => res.json())
      .then((data) => {
        if (data.ok) setAvailableLocations(data.locations);
      })
      .catch(() => { })
      .finally(() => setLocationsLoading(false));
  }, []);

  function pickLocation(loc: string) {
    setSelectedLocation(loc);
    localStorage.setItem(LOCATION_KEY, loc);
    setShowLocationPicker(false);
  }

  const { data: categoriesData } = useQuery(GET_CATEGORIES);

  const priceMinMax = selectedPriceRange ? priceRangeToMinMax(selectedPriceRange) : {};

  const { data: servicesData, loading, error, refetch } = useQuery(GET_SERVICES, {
    variables: {
      filter: {
        search: searchQuery.trim().length ? searchQuery.trim() : null,
        categoryId: selectedCategoryId,
        minPrice: typeof priceMinMax.minPrice === "number" ? priceMinMax.minPrice : null,
        maxPrice: typeof priceMinMax.maxPrice === "number" ? priceMinMax.maxPrice : null,
        minRating,
        location: selectedLocation,
      },
      sort: searchQuery.trim().length ? "RELEVANCE" : "RATING_DESC",
    },
    skip: !selectedLocation,
  });

  const categories = (categoriesData?.categories ?? []) as Array<{ id: string; name: string }>;
  const services =
    (servicesData?.services ?? []) as Array<{
      id: string;
      title: string;
      price: number;
      duration: string;
      image?: string | null;
      rating: number;
      reviews: number;
      category: { id: string; name: string };
      vendor: { id: string; displayName: string; shopImageUrl?: string | null };
    }>;

  return (
    <PublicLayout>
      {/* ---- Location Picker Modal ---- */}
      <AnimatePresence>
        {showLocationPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4"
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md rounded-2xl bg-background border border-border p-6 shadow-2xl"
            >
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                  <MapPin size={28} className="text-primary" />
                </div>
                <h2 className="font-display text-xl font-bold text-foreground">Choose Your Location</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Select a city to see nearby service providers
                </p>
              </div>

              {locationsLoading ? (
                <div className="text-center py-8 text-muted-foreground text-sm">Loading locations…</div>
              ) : availableLocations.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">No locations available yet.</div>
              ) : (
                <div className="grid grid-cols-1 gap-2 max-h-64 overflow-y-auto">
                  {availableLocations.map((loc) => (
                    <button
                      key={loc}
                      onClick={() => pickLocation(loc)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-sm font-medium text-left transition-all hover:border-primary hover:bg-primary/5 ${selectedLocation === loc
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border text-foreground"
                        }`}
                    >
                      <MapPin size={16} className="text-primary flex-shrink-0" />
                      {loc}
                    </button>
                  ))}
                </div>
              )}

              {selectedLocation && (
                <button
                  onClick={() => setShowLocationPicker(false)}
                  className="mt-4 w-full py-2.5 rounded-xl bg-secondary border border-border text-sm text-foreground hover:bg-secondary/70 transition-colors"
                >
                  Cancel
                </button>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="font-display text-3xl font-bold text-foreground mb-2">Browse Services</h1>
              <p className="text-muted-foreground">Discover top-rated services from verified vendors</p>
            </div>

            {/* Location badge */}
            {selectedLocation && (
              <button
                onClick={() => setShowLocationPicker(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-2xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors"
              >
                <MapPin size={16} className="text-primary" />
                <span className="text-sm font-medium text-primary">{selectedLocation}</span>
                <span className="text-xs text-primary/60">Change</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Search */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mb-8">
          <div className="relative max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search services..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Filters */}
          <div className="mt-4 flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="w-full lg:w-64">
              <Select
                value={selectedCategoryId ?? "all"}
                onValueChange={(v) => setSelectedCategoryId(v === "all" ? null : v)}
              >
                <SelectTrigger className="bg-secondary border-border rounded-2xl">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-full lg:w-56">
              <Select
                value={selectedPriceRange ?? "any"}
                onValueChange={(v) => setSelectedPriceRange(v === "any" ? null : (v as PriceRangeId))}
              >
                <SelectTrigger className="bg-secondary border-border rounded-2xl">
                  <SelectValue placeholder="Price" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any price</SelectItem>
                  <SelectItem value="UNDER_50">Under ₹50</SelectItem>
                  <SelectItem value="50_100">₹50 - ₹100</SelectItem>
                  <SelectItem value="100_200">₹100 - ₹200</SelectItem>
                  <SelectItem value="200_PLUS">₹200+</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="w-full lg:w-56">
              <Select
                value={minRating ? String(minRating) : "any"}
                onValueChange={(v) => setMinRating(v === "any" ? null : Number(v))}
              >
                <SelectTrigger className="bg-secondary border-border rounded-2xl">
                  <SelectValue placeholder="Rating" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="any">Any rating</SelectItem>
                  <SelectItem value="4">4★ & up</SelectItem>
                  <SelectItem value="3">3★ & up</SelectItem>
                  <SelectItem value="2">2★ & up</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </motion.div>

        {/* Grid */}
        <div className="flex-1">
          {!selectedLocation ? (
            <div className="text-center py-20">
              <MapPin size={48} className="text-primary mx-auto mb-4" />
              <p className="text-foreground font-medium text-lg">Select a location to browse services</p>
              <p className="text-muted-foreground text-sm mt-1">Choose your city to see nearby vendors</p>
              <button
                onClick={() => setShowLocationPicker(true)}
                className="mt-4 px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                Choose Location
              </button>
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <p className="text-muted-foreground">Failed to load services.</p>
              <p className="text-xs text-muted-foreground/80 mt-2 max-w-xl mx-auto break-words">
                {error.message}
              </p>
              <button
                type="button"
                onClick={() => void refetch()}
                className="mt-4 px-4 py-2 rounded-xl bg-secondary border border-border text-sm text-foreground hover:bg-secondary/70 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : loading ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="card-floating overflow-hidden">
                  <div className="h-44 bg-muted" />
                  <div className="p-5 space-y-3">
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-1/2 bg-muted rounded" />
                    <div className="h-6 w-full bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : services.length > 0 ? (
            <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {services.map((service) => (
                <ServiceCard
                  key={service.id}
                  id={Number(service.id)}
                  title={service.title}
                  vendor={service.vendor.displayName}
                  price={service.price}
                  rating={service.rating}
                  reviews={service.reviews}
                  category={service.category.name}
                  duration={service.duration}
                  image={service.image ?? "/placeholder.svg"}
                  vendorImage={service.vendor.shopImageUrl}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-muted-foreground">No services found in {selectedLocation}.</p>
              <button
                onClick={() => setShowLocationPicker(true)}
                className="mt-3 text-primary text-sm font-medium hover:underline"
              >
                Try a different location
              </button>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}
