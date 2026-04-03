export type Category = {
  id: string;
  name: string;
};

export type Vendor = {
  id: string;
  displayName: string;
  city: string;
  region: string;
};

export type Service = {
  id: string;
  title: string;
  description: string;
  priceCents: number;
  durationMinutes: number;
  categoryId: string;
  vendorId: string;
  imageUrl?: string | null;
  active: boolean;
};

export type Review = {
  id: string;
  serviceId: string;
  rating: number; // 1..5
  comment?: string | null;
  createdAt: string;
};

export const categories: Category[] = [
  { id: "1", name: "Beauty & Spa" },
  { id: "2", name: "Home Services" },
  { id: "3", name: "Auto Care" },
  { id: "4", name: "Photography" },
  { id: "5", name: "Fitness" },
  { id: "6", name: "Tutoring" },
  { id: "7", name: "Repairs" },
];

export const vendors: Vendor[] = [
  { id: "ven_stylehub", displayName: "StyleHub Studio", city: "New York", region: "NY" },
  { id: "ven_cleanpro", displayName: "CleanPro Services", city: "New York", region: "NY" },
  { id: "ven_autoshine", displayName: "AutoShine Garage", city: "Brooklyn", region: "NY" },
  { id: "ven_lensart", displayName: "LensArt Studio", city: "Queens", region: "NY" },
  { id: "ven_fitlife", displayName: "FitLife Gym", city: "New York", region: "NY" },
  { id: "ven_brightminds", displayName: "BrightMinds Academy", city: "Jersey City", region: "NJ" },
];

export const services: Service[] = [
  {
    id: "1",
    title: "Premium Haircut & Styling",
    description: "Professional haircut and styling tailored to your look.",
    priceCents: 4500,
    durationMinutes: 45,
    categoryId: "1",
    vendorId: "ven_stylehub",
    imageUrl: "/placeholder.svg",
    active: true,
  },
  {
    id: "2",
    title: "Deep House Cleaning",
    description: "Whole-home deep cleaning by vetted professionals.",
    priceCents: 12000,
    durationMinutes: 180,
    categoryId: "2",
    vendorId: "ven_cleanpro",
    imageUrl: "/placeholder.svg",
    active: true,
  },
  {
    id: "3",
    title: "Full Car Detailing",
    description: "Interior and exterior detailing for a showroom finish.",
    priceCents: 8900,
    durationMinutes: 120,
    categoryId: "3",
    vendorId: "ven_autoshine",
    imageUrl: "/placeholder.svg",
    active: true,
  },
  {
    id: "4",
    title: "Portrait Photography",
    description: "Studio-quality portraits with retouching included.",
    priceCents: 15000,
    durationMinutes: 60,
    categoryId: "4",
    vendorId: "ven_lensart",
    imageUrl: "/placeholder.svg",
    active: true,
  },
  {
    id: "5",
    title: "Personal Training Session",
    description: "1:1 training session personalized to your goals.",
    priceCents: 6000,
    durationMinutes: 60,
    categoryId: "5",
    vendorId: "ven_fitlife",
    imageUrl: "/placeholder.svg",
    active: true,
  },
  {
    id: "6",
    title: "Math Tutoring",
    description: "Private math tutoring from middle school to college.",
    priceCents: 3500,
    durationMinutes: 60,
    categoryId: "6",
    vendorId: "ven_brightminds",
    imageUrl: "/placeholder.svg",
    active: true,
  },
];

export const reviews: Review[] = [
  { id: "rev_1", serviceId: "1", rating: 5, comment: "Loved it.", createdAt: "2026-02-01T10:00:00.000Z" },
  { id: "rev_2", serviceId: "1", rating: 5, comment: "Great stylist.", createdAt: "2026-01-18T12:00:00.000Z" },
  { id: "rev_3", serviceId: "1", rating: 4, comment: "Solid experience.", createdAt: "2026-01-12T09:00:00.000Z" },

  { id: "rev_4", serviceId: "2", rating: 5, comment: "House spotless.", createdAt: "2026-01-20T15:00:00.000Z" },
  { id: "rev_5", serviceId: "2", rating: 4, comment: "Very good.", createdAt: "2026-01-05T15:00:00.000Z" },

  { id: "rev_6", serviceId: "3", rating: 5, comment: "Car looks new.", createdAt: "2026-01-28T15:00:00.000Z" },
  { id: "rev_7", serviceId: "3", rating: 4, comment: "Nice work.", createdAt: "2026-01-10T15:00:00.000Z" },

  { id: "rev_8", serviceId: "4", rating: 5, comment: "Amazing shots.", createdAt: "2026-01-17T15:00:00.000Z" },
  { id: "rev_9", serviceId: "4", rating: 5, comment: "Highly recommend.", createdAt: "2026-01-08T15:00:00.000Z" },

  { id: "rev_10", serviceId: "5", rating: 4, comment: "Tough but worth it.", createdAt: "2026-01-24T15:00:00.000Z" },
  { id: "rev_11", serviceId: "6", rating: 5, comment: "Clear explanations.", createdAt: "2026-01-03T15:00:00.000Z" },
];
