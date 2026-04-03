import { motion } from "framer-motion";
import { ArrowRight, Star, ChevronRight, Zap, Shield, Clock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import PublicLayout from "@/components/layouts/PublicLayout";
import ServiceCard from "@/components/ServiceCard";
import { serviceCategories, featuredServices, testimonials } from "@/data/mockData";
import { useAuth } from "@/auth/AuthContext";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.6 },
};

export default function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Redirect logged-in users to their dashboard
    if (!loading && user) {
      switch (user.role) {
        case "customer":
          navigate("/customer/dashboard");
          break;
        case "vendor":
          navigate("/vendor/dashboard");
          break;
        case "admin":
          navigate("/admin/dashboard");
          break;
      }
    }
  }, [user, loading, navigate]);

  // Show nothing while checking auth or redirecting
  if (loading || user) {
    return null;
  }

  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative overflow-hidden gradient-dark-radial">
        <div className="gradient-glow absolute inset-0" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 md:py-36 relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-3xl mx-auto"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
              <Zap size={14} /> The #1 Service Marketplace
            </span>
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold text-foreground leading-tight mb-6">
              Book Premium Services,{" "}
              <span className="text-gradient-orange">Effortlessly</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Discover and book top-rated local services from verified vendors. From beauty to home care — all in one place.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/services"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
              >
                Explore Services <ArrowRight size={16} />
              </Link>
              <Link
                to="/select-role"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl border border-border text-foreground font-semibold text-sm hover:bg-secondary transition-colors"
              >
                Get Started <ChevronRight size={16} />
              </Link>
            </div>
          </motion.div>

          {/* Floating stat cards */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 grid grid-cols-3 gap-4 max-w-lg mx-auto"
          >
            {[
              { label: "Services", value: "500+" },
              { label: "Vendors", value: "200+" },
              { label: "Bookings", value: "34K+" },
            ].map((stat) => (
              <div key={stat.label} className="text-center p-4 rounded-2xl bg-secondary/60 border border-border backdrop-blur-sm">
                <p className="text-xl font-display font-bold text-foreground">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{stat.label}</p>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-foreground mb-3">Browse Categories</h2>
            <p className="text-muted-foreground">Find the perfect service from our curated categories</p>
          </motion.div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {serviceCategories.map((cat, i) => (
              <motion.div
                key={cat.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4 }}
                className="card-floating-sm p-5 text-center cursor-pointer group"
              >
                <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                  <cat.icon size={22} className="text-primary" />
                </div>
                <p className="font-medium text-sm text-card-foreground">{cat.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{cat.count} services</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Services */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="flex items-center justify-between mb-10">
            <div>
              <h2 className="font-display text-3xl font-bold text-foreground mb-2">Featured Services</h2>
              <p className="text-muted-foreground">Top-rated services hand-picked for you</p>
            </div>
            <Link to="/services" className="hidden sm:flex items-center gap-1 text-sm text-primary font-medium hover:underline">
              View All <ArrowRight size={14} />
            </Link>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featuredServices.map((service) => (
              <ServiceCard key={service.id} {...service} />
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { icon: Shield, title: "Verified Vendors", desc: "Every vendor is verified and reviewed by our team to ensure quality service." },
              { icon: Clock, title: "Instant Booking", desc: "Book services in seconds with real-time availability and instant confirmation." },
              { icon: Star, title: "Rated & Reviewed", desc: "Read genuine reviews from real customers to make informed decisions." },
            ].map((item, i) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-8"
              >
                <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <item.icon size={26} className="text-primary" />
                </div>
                <h3 className="font-display font-bold text-foreground text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 bg-secondary/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-12">
            <h2 className="font-display text-3xl font-bold text-foreground mb-3">What Our Users Say</h2>
            <p className="text-muted-foreground">Real feedback from real customers and vendors</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="card-floating p-6"
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={14} className="fill-primary text-primary" />
                  ))}
                </div>
                <p className="text-sm text-card-foreground mb-4 leading-relaxed">"{t.text}"</p>
                <div>
                  <p className="font-medium text-sm text-card-foreground">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center p-12 rounded-3xl gradient-dark-radial relative overflow-hidden">
            <div className="gradient-glow absolute inset-0" />
            <div className="relative">
              <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground mb-4">
                Ready to Get Started?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                Join thousands of customers and vendors on the most trusted service marketplace.
              </p>
              <Link
                to="/select-role"
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors shadow-lg shadow-primary/25"
              >
                Create Account <ArrowRight size={16} />
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </PublicLayout>
  );
}
