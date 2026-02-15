import { useQuery } from "@apollo/client";
import { motion } from "framer-motion";
import { Search, Star, ChevronDown } from "lucide-react";
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";

import DashboardLayout from "@/components/layouts/DashboardLayout";
import { GET_CATEGORIES, GET_SERVICES } from "@/graphql/serviceQueries";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type PriceRangeId = "UNDER_50" | "50_100" | "100_200" | "200_PLUS";

type ServiceType = {
  id: string;
  title: string;
  price: number;
  duration: string;
  image?: string | null;
  rating: number;
  reviews: number;
  category: { id: string; name: string };
  vendor: { id: string; displayName: string };
};

interface VendorServiceCardProps {
  vendorName: string;
  services: ServiceType[];
  avgRating: number;
  totalReviews: number;
  category: string;
}

function VendorServiceCard({ vendorName, services, avgRating, totalReviews, category }: VendorServiceCardProps) {
  const navigate = useNavigate();
  const [selectedServiceId, setSelectedServiceId] = useState(services[0].id);

  const selectedService = services.find(s => s.id === selectedServiceId) || services[0];

  const handleViewService = () => {
    navigate(`/customer/service/${selectedServiceId}`);
  };

  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="card-floating overflow-hidden group"
    >
      <div className="h-44 bg-muted relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <span className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-xs font-medium">
          {category}
        </span>
        <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg bg-black/60 text-white text-xs font-medium">
          {services.length} {services.length === 1 ? 'Service' : 'Services'}
        </span>
      </div>
      <div className="p-5 bg-[#14100c]/90 border-t border-orange-500/15">
        <h3 className="font-display font-semibold text-white text-base mb-1">
          {vendorName}
        </h3>
        <div className="flex items-center gap-1 mb-3">
          <Star size={14} className="fill-primary text-primary" />
          <span className="text-sm font-medium text-white">{avgRating.toFixed(1)}</span>
          <span className="text-xs text-white/60">({totalReviews} reviews)</span>
        </div>

        {/* Service Selector */}
        <div className="mb-3">
          <label className="text-xs text-white/70 mb-1.5 block">Available Services</label>
          <Select value={selectedServiceId} onValueChange={setSelectedServiceId}>
            <SelectTrigger className="bg-secondary/50 border-orange-500/20 text-white text-sm rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {services.map((service) => (
                <SelectItem key={service.id} value={service.id}>
                  {service.title} - ₹{service.price}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <div className="text-left">
            <span className="text-lg font-bold text-white">₹{selectedService.price}</span>
            <span className="text-xs text-white/60 ml-1">/ {selectedService.duration}</span>
          </div>
          <button
            onClick={handleViewService}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>
    </motion.div>
  );
}

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

export default function CustomerServices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedPriceRange, setSelectedPriceRange] = useState<PriceRangeId | null>(null);
  const [minRating, setMinRating] = useState<number | null>(null);

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
      },
      sort: searchQuery.trim().length ? "RELEVANCE" : "RATING_DESC",
    },
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
      vendor: { id: string; displayName: string };
    }>;

  // Group services by vendor
  const vendorGroups = useMemo(() => {
    const groups = new Map<string, typeof services>();
    services.forEach(service => {
      const vendorId = service.vendor.id;
      if (!groups.has(vendorId)) {
        groups.set(vendorId, []);
      }
      groups.get(vendorId)!.push(service);
    });
    return Array.from(groups.entries()).map(([vendorId, vendorServices]) => ({
      vendorId,
      vendorName: vendorServices[0].vendor.displayName,
      services: vendorServices,
      // Use first service for display defaults
      avgRating: vendorServices.reduce((sum, s) => sum + s.rating, 0) / vendorServices.length,
      totalReviews: vendorServices.reduce((sum, s) => sum + s.reviews, 0),
      category: vendorServices[0].category.name,
    }));
  }, [services]);

  return (
    <DashboardLayout role="customer">
      <div className="max-w-7xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <h1 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-1">Browse Services</h1>
          <p className="text-muted-foreground">Search and book services from verified vendors</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mb-6">
          <div className="relative max-w-xl">
            <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search services, vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-2xl bg-secondary border border-border text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
          </div>

          {/* Horizontal Filters */}
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

        <div className="flex-1">
            {error ? (
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
            ) : vendorGroups.length > 0 ? (
              <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {vendorGroups.map((vendor) => (
                  <VendorServiceCard
                    key={vendor.vendorId}
                    vendorName={vendor.vendorName}
                    services={vendor.services}
                    avgRating={vendor.avgRating}
                    totalReviews={vendor.totalReviews}
                    category={vendor.category}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-muted-foreground">No services found matching your criteria.</p>
              </div>
            )}
        </div>
      </div>
    </DashboardLayout>
  );
}
