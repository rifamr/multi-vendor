import { motion } from "framer-motion";
import { Plus, Calendar, Clock, Trash2, Edit, DollarSign } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@apollo/client";
import { GET_CATEGORIES } from "@/graphql/serviceQueries";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

type Service = {
  id: number;
  title: string;
  description: string;
  price: number;
  duration_minutes: number;
  is_active: boolean;
  category_id: number;
  category_name: string;
};

type AvailabilitySlot = {
  id: number;
  vendorId: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export default function VendorServices() {
  const { toast } = useToast();
  
  // Vendor profile state
  const [vendorCategoryId, setVendorCategoryId] = useState<number | null>(null);
  const [vendorCategoryName, setVendorCategoryName] = useState<string | null>(null);
  
  // Services state
  const [services, setServices] = useState<Service[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [showAddServiceDialog, setShowAddServiceDialog] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);
  
  // Service form state
  const [serviceTitle, setServiceTitle] = useState("");
  const [serviceDescription, setServiceDescription] = useState("");
  const [servicePrice, setServicePrice] = useState("");
  const [serviceDuration, setServiceDuration] = useState("");
  
  // Availability slots state
  const [slots, setSlots] = useState<AvailabilitySlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [showAddSlotDialog, setShowAddSlotDialog] = useState(false);
  const [slotDate, setSlotDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: categoriesData } = useQuery(GET_CATEGORIES);
  const categories = (categoriesData?.categories ?? []) as Array<{ id: string; name: string }>;

  useEffect(() => {
    fetchVendorProfile();
    fetchServices();
    fetchSlots();
  }, []);

  const fetchVendorProfile = async () => {
    try {
      const response = await fetch("/api/profile", {
        credentials: "include",
      });
      const result = await response.json();

      if (result.ok && result.profile.vendor) {
        setVendorCategoryId(result.profile.vendor.serviceCategoryId);
        // Find category name
        const category = categories.find(c => c.id === result.profile.vendor.serviceCategoryId?.toString());
        setVendorCategoryName(category?.name || null);
      }
    } catch (err) {
      console.error("Failed to fetch vendor profile:", err);
    }
  };

  // Update category name when categories load
  useEffect(() => {
    if (vendorCategoryId && categories.length > 0) {
      const category = categories.find(c => c.id === vendorCategoryId.toString());
      setVendorCategoryName(category?.name || null);
    }
  }, [vendorCategoryId, categories]);

  const fetchServices = async () => {
    setLoadingServices(true);
    try {
      const response = await fetch("/api/vendor/services", {
        credentials: "include",
      });
      const result = await response.json();

      if (result.ok) {
        setServices(result.services);
      }
    } catch (err) {
      console.error("Failed to fetch services:", err);
    } finally {
      setLoadingServices(false);
    }
  };

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceTitle) {
      toast({
        title: "Missing Fields",
        description: "Please provide a service title.",
        variant: "destructive",
      });
      return;
    }

    if (!vendorCategoryId) {
      toast({
        title: "Category Not Set",
        description: "Please set your service category in your profile first.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/vendor/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: serviceTitle,
          description: serviceDescription,
          price: servicePrice ? parseFloat(servicePrice) : null,
          durationMinutes: serviceDuration ? parseInt(serviceDuration) : null,
          categoryId: vendorCategoryId,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Success",
          description: "Service created successfully!",
        });
        setShowAddServiceDialog(false);
        resetServiceForm();
        fetchServices();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create service.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to create service.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/vendor/services/${editingService.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: serviceTitle,
          description: serviceDescription,
          price: servicePrice ? parseFloat(servicePrice) : null,
          durationMinutes: serviceDuration ? parseInt(serviceDuration) : null,
          categoryId: vendorCategoryId,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Success",
          description: "Service updated successfully!",
        });
        setEditingService(null);
        resetServiceForm();
        fetchServices();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update service.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update service.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteService = async (serviceId: number) => {
    if (!confirm("Are you sure you want to delete this service?")) return;

    try {
      const response = await fetch(`/api/vendor/services/${serviceId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Success",
          description: "Service deleted successfully!",
        });
        fetchServices();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete service.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to delete service.",
        variant: "destructive",
      });
    }
  };

  const handleToggleServiceActive = async (service: Service) => {
    try {
      const response = await fetch(`/api/vendor/services/${service.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isActive: !service.is_active,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Success",
          description: `Service ${!service.is_active ? "activated" : "deactivated"} successfully!`,
        });
        fetchServices();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to update service.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to update service.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (service: Service) => {
    setEditingService(service);
    setServiceTitle(service.title);
    setServiceDescription(service.description || "");
    setServicePrice(service.price?.toString() || "");
    setServiceDuration(service.duration_minutes?.toString() || "");
  };

  const resetServiceForm = () => {
    setServiceTitle("");
    setServiceDescription("");
    setServicePrice("");
    setServiceDuration("");
  };

  const fetchSlots = async () => {
    setLoadingSlots(true);
    try {
      const response = await fetch("/api/availability", {
        credentials: "include",
      });
      const result = await response.json();

      if (result.ok) {
        setSlots(result.slots);
      }
    } catch (err) {
      console.error("Failed to fetch slots:", err);
    } finally {
      setLoadingSlots(false);
    }
  };

  const handleAddSlot = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!slotDate || !startTime || !endTime) {
      toast({
        title: "Missing Fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          slotDate,
          startTime,
          endTime,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Success",
          description: "Availability slot created successfully.",
        });
        setShowAddSlotDialog(false);
        setSlotDate("");
        setStartTime("");
        setEndTime("");
        fetchSlots();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create slot.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while creating the slot.",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSlot = async (slotId: number) => {
    try {
      const response = await fetch(`/api/availability/${slotId}`, {
        method: "DELETE",
        credentials: "include",
      });

      const result = await response.json();

      if (result.ok) {
        toast({
          title: "Success",
          description: "Availability slot deleted successfully.",
        });
        fetchSlots();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to delete slot.",
          variant: "destructive",
        });
      }
    } catch (err) {
      toast({
        title: "Error",
        description: "An error occurred while deleting the slot.",
        variant: "destructive",
      });
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <DashboardLayout role="vendor">
      <div className="space-y-6">
        <div>
          <h3 className="font-display font-semibold text-foreground">My Services</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your service offerings and availability schedule
          </p>
        </div>

        <Tabs defaultValue="services" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="services">Service Catalog</TabsTrigger>
            <TabsTrigger value="availability">Availability Slots</TabsTrigger>
          </TabsList>

          <TabsContent value="services" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Create and manage the services you offer to customers
              </p>
              <Dialog open={showAddServiceDialog} onOpenChange={setShowAddServiceDialog}>
                <DialogTrigger asChild>
                  <Button className="inline-flex items-center gap-2">
                    <Plus size={16} /> Add Service
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Add New Service</DialogTitle>
                    <DialogDescription>
                      Create a new service offering for customers to book
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddService} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="title">Service Title *</Label>
                      <Input
                        id="title"
                        placeholder="e.g., Professional Haircut"
                        value={serviceTitle}
                        onChange={(e) => setServiceTitle(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted">
                        <Badge variant="secondary">{vendorCategoryName || "Not Set"}</Badge>
                        <span className="text-xs text-muted-foreground">
                          All your services will be in this category
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        placeholder="Describe your service..."
                        value={serviceDescription}
                        onChange={(e) => setServiceDescription(e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="price">Price ($)</Label>
                        <Input
                          id="price"
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          value={servicePrice}
                          onChange={(e) => setServicePrice(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="duration">Duration (min)</Label>
                        <Input
                          id="duration"
                          type="number"
                          placeholder="60"
                          value={serviceDuration}
                          onChange={(e) => setServiceDuration(e.target.value)}
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setShowAddServiceDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? "Creating..." : "Create Service"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {loadingServices ? (
              <div className="text-center py-12 text-muted-foreground">Loading services...</div>
            ) : services.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <DollarSign size={48} className="mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-muted-foreground">No services created yet.</p>
                  <p className="text-xs text-muted-foreground mt-2">Click "Add Service" to create your first offering.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {services.map((service, i) => (
                  <motion.div
                    key={service.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                  >
                    <Card>
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <CardTitle className="text-lg">{service.title}</CardTitle>
                              <Badge variant={service.is_active ? "default" : "secondary"}>
                                {service.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <CardDescription className="mt-1">{service.category_name}</CardDescription>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => openEditDialog(service)}
                            >
                              <Edit size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleDeleteService(service.id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {service.description && (
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                        )}
                        <div className="flex items-center gap-6 text-sm">
                          {service.price && (
                            <div className="flex items-center gap-1">
                              <DollarSign size={14} className="text-muted-foreground" />
                              <span className="font-medium">${service.price}</span>
                            </div>
                          )}
                          {service.duration_minutes && (
                            <div className="flex items-center gap-1">
                              <Clock size={14} className="text-muted-foreground" />
                              <span>{service.duration_minutes} min</span>
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 pt-2">
                          <Switch
                            checked={service.is_active}
                            onCheckedChange={() => handleToggleServiceActive(service)}
                          />
                          <span className="text-sm text-muted-foreground">
                            {service.is_active ? "Visible to customers" : "Hidden from customers"}
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Edit Service Dialog */}
            <Dialog open={!!editingService} onOpenChange={(open) => !open && setEditingService(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit Service</DialogTitle>
                  <DialogDescription>
                    Update your service details
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleUpdateService} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-title">Service Title *</Label>
                    <Input
                      id="edit-title"
                      value={serviceTitle}
                      onChange={(e) => setServiceTitle(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <div className="flex items-center gap-2 px-3 py-2 rounded-md border bg-muted">
                      <Badge variant="secondary">{vendorCategoryName || "Not Set"}</Badge>
                      <span className="text-xs text-muted-foreground">
                        Category is fixed to your specialization
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-description">Description</Label>
                    <Textarea
                      id="edit-description"
                      value={serviceDescription}
                      onChange={(e) => setServiceDescription(e.target.value)}
                      rows={3}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-price">Price ($)</Label>
                      <Input
                        id="edit-price"
                        type="number"
                        step="0.01"
                        value={servicePrice}
                        onChange={(e) => setServicePrice(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-duration">Duration (min)</Label>
                      <Input
                        id="edit-duration"
                        type="number"
                        value={serviceDuration}
                        onChange={(e) => setServiceDuration(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button type="button" variant="outline" onClick={() => setEditingService(null)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={submitting}>
                      {submitting ? "Updating..." : "Update Service"}
                    </Button>
                  </div>
                </form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="availability" className="space-y-4 mt-6">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Set your available time slots for customer bookings
              </p>
              <Dialog open={showAddSlotDialog} onOpenChange={setShowAddSlotDialog}>
                <DialogTrigger asChild>
                  <Button className="inline-flex items-center gap-2">
                    <Plus size={16} /> Add Time Slot
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Availability Slot</DialogTitle>
                    <DialogDescription>
                      Create a new time slot for your availability
                    </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleAddSlot} className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input
                        id="date"
                        type="date"
                        value={slotDate}
                        onChange={(e) => setSlotDate(e.target.value)}
                        min={new Date().toISOString().split("T")[0]}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="startTime">Start Time</Label>
                        <Input
                          id="startTime"
                          type="time"
                          value={startTime}
                          onChange={(e) => setStartTime(e.target.value)}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="endTime">End Time</Label>
                        <Input
                          id="endTime"
                          type="time"
                          value={endTime}
                          onChange={(e) => setEndTime(e.target.value)}
                          required
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button type="button" variant="outline" onClick={() => setShowAddSlotDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={submitting}>
                        {submitting ? "Creating..." : "Create Slot"}
                      </Button>
                    </div>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {loadingSlots ? (
              <div className="text-center py-12 text-muted-foreground">Loading slots...</div>
            ) : slots.length === 0 ? (
              <Card>
                <CardContent className="text-center py-12">
                  <Calendar size={48} className="mx-auto mb-4 opacity-50 text-muted-foreground" />
                  <p className="text-muted-foreground">No availability slots created yet.</p>
                  <p className="text-xs text-muted-foreground mt-2">Click "Add Time Slot" to create one.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {slots.map((slot, i) => (
                  <motion.div
                    key={slot.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className={`rounded-xl border p-4 ${
                      slot.isAvailable
                        ? "bg-green-500/5 border-green-500/20"
                        : "bg-gray-500/5 border-gray-500/20"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Calendar size={16} className="text-primary" />
                        <span className="text-sm font-medium text-foreground">{formatDate(slot.slotDate)}</span>
                      </div>
                      <button
                        onClick={() => handleDeleteSlot(slot.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                        title="Delete slot"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock size={14} />
                      <span>
                        {slot.startTime} - {slot.endTime}
                      </span>
                    </div>
                    <div className="mt-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${
                          slot.isAvailable
                            ? "bg-green-500/10 text-green-400 border-green-500/20"
                            : "bg-gray-500/10 text-gray-400 border-gray-500/20"
                        }`}
                      >
                        {slot.isAvailable ? "Available" : "Booked"}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
