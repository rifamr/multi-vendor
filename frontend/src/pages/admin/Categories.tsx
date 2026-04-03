import { useState } from "react";
import { useMutation, useQuery } from "@apollo/client";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2 } from "lucide-react";
import DashboardLayout from "@/components/layouts/DashboardLayout";
import { CREATE_CATEGORY, GET_CATEGORIES } from "@/graphql/serviceQueries";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

type AdminCategory = {
  id: string;
  name: string;
  services: number;
  vendors: number;
  status: string;
};

export default function AdminCategories() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const { data, loading } = useQuery(GET_CATEGORIES);
  const [createCategory, { loading: creatingCategory }] = useMutation(CREATE_CATEGORY);

  const categories: AdminCategory[] =
    data?.categories?.map((category: { id: string; name: string; servicesCount?: number; vendorsCount?: number }) => ({
      id: category.id,
      name: category.name,
      services: category.servicesCount ?? 0,
      vendors: category.vendorsCount ?? 0,
      status: "active",
    })) ?? [];

  const handleAddCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedName = newCategoryName.trim();

    if (!normalizedName) {
      toast.error("Category name is required");
      return;
    }

    const alreadyExists = categories.some(
      (category) => category.name.toLowerCase() === normalizedName.toLowerCase()
    );
    if (alreadyExists) {
      toast.error("Category already exists");
      return;
    }

    try {
      await createCategory({
        variables: { name: normalizedName },
        refetchQueries: [{ query: GET_CATEGORIES }],
        awaitRefetchQueries: true,
      });

      setNewCategoryName("");
      setIsAddOpen(false);
      toast.success("Category added");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to add category";
      toast.error(message);
    }
  };

  return (
    <DashboardLayout role="admin">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-semibold text-foreground">Service Categories</h3>
          <button
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Add Category
          </button>
        </div>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Service Category</DialogTitle>
              <DialogDescription>Create a new category for vendor services.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleAddCategory} className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="category-name" className="text-sm font-medium text-foreground">
                  Category name
                </label>
                <Input
                  id="category-name"
                  value={newCategoryName}
                  onChange={(event) => setNewCategoryName(event.target.value)}
                  placeholder="e.g. Pet Grooming"
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setNewCategoryName("");
                  }}
                  className="px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCategory}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm hover:bg-primary/90 transition-colors"
                >
                  {creatingCategory ? "Adding..." : "Add Category"}
                </button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <div className="rounded-2xl bg-secondary border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Category</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Services</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs hidden sm:table-cell">Vendors</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Status</th>
                <th className="text-left px-5 py-3 font-medium text-muted-foreground text-xs">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-6 text-center text-muted-foreground">
                    Loading categories...
                  </td>
                </tr>
              )}
              {categories.map((c, i) => (
                <motion.tr
                  key={c.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-5 py-3 text-foreground font-medium">{c.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{c.services}</td>
                  <td className="px-5 py-3 text-muted-foreground hidden sm:table-cell">{c.vendors}</td>
                  <td className="px-5 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full border bg-green-500/10 text-green-400 border-green-500/20">{c.status}</span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex gap-1">
                      <button className="p-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"><Pencil size={14} /></button>
                      <button className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}
