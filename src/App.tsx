import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ApolloProvider } from "@apollo/client";

import { apolloClient } from "@/lib/apollo";
import { AuthProvider } from "@/auth/AuthContext";
import RequireAuth from "@/components/auth/RequireAuth";

import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import Services from "./pages/Services";
import ServiceDetails from "./pages/ServiceDetails";
import Login from "./pages/Login";
import SelectRole from "./pages/SelectRole";

import CustomerDashboard from "./pages/customer/Dashboard";
import CustomerServices from "./pages/customer/Services";
import CustomerServiceDetails from "./pages/customer/ServiceDetails";
import CustomerBookings from "./pages/customer/Bookings";
import CustomerBookingCheckout from "./pages/customer/BookingCheckout";
import CustomerProfile from "./pages/customer/Profile";
import CustomerNotifications from "./pages/customer/Notifications";

import VendorDashboard from "./pages/vendor/Dashboard";
import VendorServices from "./pages/vendor/Services";
import VendorBookings from "./pages/vendor/Bookings";
import VendorReviews from "./pages/vendor/Reviews";
import VendorEarnings from "./pages/vendor/Earnings";
import VendorProfile from "./pages/vendor/Profile";
import VendorNotifications from "./pages/vendor/Notifications";

import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminVendors from "./pages/admin/Vendors";
import AdminCategories from "./pages/admin/Categories";
import AdminUsers from "./pages/admin/Users";
import AdminNotifications from "./pages/admin/Notifications";
import AdminReviews from "./pages/admin/Reviews";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ApolloProvider client={apolloClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/services" element={<Services />} />
              <Route path="/service/:id" element={<ServiceDetails />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/select-role" element={<SelectRole />} />

              <Route element={<RequireAuth allowedRoles={["customer"]} />}>
                <Route path="/customer/dashboard" element={<CustomerDashboard />} />
                <Route path="/customer/services" element={<CustomerServices />} />
                <Route path="/customer/service/:id" element={<CustomerServiceDetails />} />
                <Route path="/customer/checkout" element={<CustomerBookingCheckout />} />
                <Route path="/customer/bookings" element={<CustomerBookings />} />
                <Route path="/customer/profile" element={<CustomerProfile />} />
                <Route path="/customer/notifications" element={<CustomerNotifications />} />
              </Route>

              <Route element={<RequireAuth allowedRoles={["vendor"]} />}>
                <Route path="/vendor/dashboard" element={<VendorDashboard />} />
                <Route path="/vendor/services" element={<VendorServices />} />
                <Route path="/vendor/bookings" element={<VendorBookings />} />
                <Route path="/vendor/reviews" element={<VendorReviews />} />
                <Route path="/vendor/earnings" element={<VendorEarnings />} />
                <Route path="/vendor/profile" element={<VendorProfile />} />
                <Route path="/vendor/notifications" element={<VendorNotifications />} />
              </Route>

              <Route element={<RequireAuth allowedRoles={["admin"]} />}>
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/vendors" element={<AdminVendors />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/reviews" element={<AdminReviews />} />
                <Route path="/admin/notifications" element={<AdminNotifications />} />
              </Route>

              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </ApolloProvider>
  </QueryClientProvider>
);

export default App;
