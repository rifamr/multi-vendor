import {
  Scissors, Home, Car, Camera, Dumbbell, BookOpen, Paintbrush, Music,
  Wrench, Sparkles, Heart, Briefcase
} from "lucide-react";

export const serviceCategories = [
  { id: 1, name: "Beauty & Spa", icon: Scissors, count: 124 },
  { id: 2, name: "Home Services", icon: Home, count: 89 },
  { id: 3, name: "Auto Care", icon: Car, count: 56 },
  { id: 4, name: "Photography", icon: Camera, count: 43 },
  { id: 5, name: "Fitness", icon: Dumbbell, count: 78 },
  { id: 6, name: "Tutoring", icon: BookOpen, count: 95 },
  { id: 7, name: "Art & Design", icon: Paintbrush, count: 34 },
  { id: 8, name: "Music", icon: Music, count: 27 },
  { id: 9, name: "Repairs", icon: Wrench, count: 67 },
  { id: 10, name: "Wellness", icon: Sparkles, count: 52 },
  { id: 11, name: "Healthcare", icon: Heart, count: 41 },
  { id: 12, name: "Consulting", icon: Briefcase, count: 63 },
];

export const featuredServices = [
  { id: 1, title: "Premium Haircut & Styling", vendor: "StyleHub Studio", price: 45, rating: 4.9, reviews: 128, category: "Beauty & Spa", duration: "45 min", image: "/placeholder.svg" },
  { id: 2, title: "Deep House Cleaning", vendor: "CleanPro Services", price: 120, rating: 4.8, reviews: 95, category: "Home Services", duration: "3 hrs", image: "/placeholder.svg" },
  { id: 3, title: "Full Car Detailing", vendor: "AutoShine Garage", price: 89, rating: 4.7, reviews: 73, category: "Auto Care", duration: "2 hrs", image: "/placeholder.svg" },
  { id: 4, title: "Portrait Photography", vendor: "LensArt Studio", price: 150, rating: 4.9, reviews: 64, category: "Photography", duration: "1 hr", image: "/placeholder.svg" },
  { id: 5, title: "Personal Training Session", vendor: "FitLife Gym", price: 60, rating: 4.6, reviews: 112, category: "Fitness", duration: "1 hr", image: "/placeholder.svg" },
  { id: 6, title: "Math Tutoring", vendor: "BrightMinds Academy", price: 35, rating: 4.8, reviews: 87, category: "Tutoring", duration: "1 hr", image: "/placeholder.svg" },
];

export const testimonials = [
  { id: 1, name: "Sarah M.", role: "Regular Customer", text: "Booking services has never been easier. The platform is intuitive and the vendors are top-notch.", rating: 5 },
  { id: 2, name: "James R.", role: "Vendor Partner", text: "Since joining the platform, my bookings have increased by 40%. The dashboard analytics are incredibly helpful.", rating: 5 },
  { id: 3, name: "Emily L.", role: "Customer", text: "I love how I can compare services, read reviews, and book everything in one place. Highly recommended!", rating: 5 },
];

export const customerBookings = [
  { id: "BK001", service: "Premium Haircut & Styling", vendor: "StyleHub Studio", date: "2026-02-10", time: "10:00 AM", status: "upcoming", price: 45 },
  { id: "BK002", service: "Deep House Cleaning", vendor: "CleanPro Services", date: "2026-02-08", time: "2:00 PM", status: "upcoming", price: 120 },
  { id: "BK003", service: "Portrait Photography", vendor: "LensArt Studio", date: "2026-01-28", time: "11:00 AM", status: "completed", price: 150 },
  { id: "BK004", service: "Personal Training", vendor: "FitLife Gym", date: "2026-01-25", time: "9:00 AM", status: "completed", price: 60 },
  { id: "BK005", service: "Math Tutoring", vendor: "BrightMinds", date: "2026-01-20", time: "4:00 PM", status: "cancelled", price: 35 },
];

export const vendorServices = [
  { id: 1, name: "Premium Haircut & Styling", price: 45, duration: "45 min", bookings: 128, status: "active" },
  { id: 2, name: "Hair Coloring", price: 85, duration: "1.5 hrs", bookings: 76, status: "active" },
  { id: 3, name: "Beard Trim & Shape", price: 25, duration: "20 min", bookings: 204, status: "active" },
  { id: 4, name: "Bridal Package", price: 250, duration: "3 hrs", bookings: 32, status: "paused" },
];

export const vendorBookings = [
  { id: "VB001", customer: "Sarah M.", service: "Premium Haircut", date: "2026-02-10", time: "10:00 AM", status: "pending" },
  { id: "VB002", customer: "John D.", service: "Hair Coloring", date: "2026-02-10", time: "1:00 PM", status: "accepted" },
  { id: "VB003", customer: "Emily L.", service: "Beard Trim", date: "2026-02-11", time: "9:30 AM", status: "pending" },
  { id: "VB004", customer: "Mike T.", service: "Premium Haircut", date: "2026-02-11", time: "3:00 PM", status: "accepted" },
];

export const vendorEarnings = [
  { month: "Sep", earnings: 2400 },
  { month: "Oct", earnings: 3100 },
  { month: "Nov", earnings: 2800 },
  { month: "Dec", earnings: 3600 },
  { month: "Jan", earnings: 4200 },
  { month: "Feb", earnings: 3800 },
];

export const adminStats = {
  totalUsers: 12847,
  totalVendors: 543,
  totalBookings: 34219,
  totalRevenue: 1284500,
};

export const adminPendingVendors = [
  { id: 1, name: "Glamour Salon", owner: "Anna K.", category: "Beauty & Spa", date: "2026-02-04", status: "pending" },
  { id: 2, name: "QuickFix Repairs", owner: "Tom B.", category: "Repairs", date: "2026-02-03", status: "pending" },
  { id: 3, name: "PeakFit Studio", owner: "Lisa M.", category: "Fitness", date: "2026-02-02", status: "pending" },
  { id: 4, name: "SnapShot Pro", owner: "David W.", category: "Photography", date: "2026-02-01", status: "pending" },
];

export const adminUserGrowth = [
  { month: "Sep", users: 8200, vendors: 380 },
  { month: "Oct", users: 9100, vendors: 410 },
  { month: "Nov", users: 10300, vendors: 450 },
  { month: "Dec", users: 11200, vendors: 490 },
  { month: "Jan", users: 12100, vendors: 520 },
  { month: "Feb", users: 12847, vendors: 543 },
];

export const adminBookingTrend = [
  { month: "Sep", bookings: 4200 },
  { month: "Oct", bookings: 5100 },
  { month: "Nov", bookings: 5800 },
  { month: "Dec", bookings: 6400 },
  { month: "Jan", bookings: 6900 },
  { month: "Feb", bookings: 5819 },
];

export const timeSlots = [
  "9:00 AM", "9:30 AM", "10:00 AM", "10:30 AM",
  "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM",
  "3:00 PM", "3:30 PM", "4:00 PM", "4:30 PM",
  "5:00 PM", "5:30 PM",
];

export const adminCategories = [
  { id: 1, name: "Beauty & Spa", services: 124, vendors: 48, status: "active" },
  { id: 2, name: "Home Services", services: 89, vendors: 35, status: "active" },
  { id: 3, name: "Auto Care", services: 56, vendors: 22, status: "active" },
  { id: 4, name: "Photography", services: 43, vendors: 18, status: "active" },
  { id: 5, name: "Fitness", services: 78, vendors: 31, status: "active" },
  { id: 6, name: "Tutoring", services: 95, vendors: 40, status: "active" },
];
