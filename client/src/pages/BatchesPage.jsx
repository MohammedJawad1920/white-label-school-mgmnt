import React, { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { batchesAPI } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useToast } from "@/components/ui/use-toast";
import { Plus, Pencil, Trash2, Calendar } from "lucide-react";

export default function BatchesPage() {
  const { isAdmin } = useAuth();
  const { toast } = useToast();

  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    startYear: new Date().getFullYear(),
    endYear: new Date().getFullYear() + 1,
    status: "Active",
  });

  useEffect(() => {
    fetchBatches();
  }, []);

  const fetchBatches = async () => {
    try {
      setLoading(true);
      const response = await batchesAPI.list();
      setBatches(response.data.batches || []);
    } catch (error) {
      console.error("Error fetching batches:", error);
      toast({
        title: "Error",
        description: "Failed to load batches",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setEditingBatch(null);
    setFormData({
      name: "",
      startYear: new Date().getFullYear(),
      endYear: new Date().getFullYear() + 1,
      status: "Active",
    });
    setDialogOpen(true);
  };

  const handleEdit = (batch) => {
    setEditingBatch(batch);
    setFormData({
      name: batch.name,
      startYear: batch.start_year,
      endYear: batch.end_year,
      status: batch.status,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    try {
      setSubmitting(true);

      if (editingBatch) {
        await batchesAPI.update(editingBatch.id, formData);
        toast({
          title: "Success",
          description: "Batch updated successfully",
        });
      } else {
        await batchesAPI.create(formData);
        toast({
          title: "Success",
          description: "Batch created successfully",
        });
      }

      setDialogOpen(false);
      fetchBatches();
    } catch (error) {
      console.error("Error saving batch:", error);
      const message =
        error.response?.data?.error?.message || "Failed to save batch";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (batch) => {
    if (
      !window.confirm(`Are you sure you want to delete batch "${batch.name}"?`)
    ) {
      return;
    }

    try {
      await batchesAPI.delete(batch.id);
      toast({
        title: "Success",
        description: "Batch deleted successfully",
      });
      fetchBatches();
    } catch (error) {
      console.error("Error deleting batch:", error);
      const message =
        error.response?.data?.error?.message || "Failed to delete batch";
      toast({
        title: "Error",
        description: message,
        variant: "destructive",
      });
    }
  };

  if (!isAdmin()) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">
          Only administrators can access this page.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Batches</h1>
          <p className="text-muted-foreground">Manage academic year batches</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={handleCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Create Batch
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {editingBatch ? "Edit Batch" : "Create Batch"}
              </DialogTitle>
              <DialogDescription>
                {editingBatch
                  ? "Update batch information"
                  : "Add a new academic year batch"}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  placeholder="e.g., 2025-2026"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="startYear">Start Year *</Label>
                  <Input
                    id="startYear"
                    type="number"
                    value={formData.startYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        startYear: parseInt(e.target.value),
                      })
                    }
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="endYear">End Year *</Label>
                  <Input
                    id="endYear"
                    type="number"
                    value={formData.endYear}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        endYear: parseInt(e.target.value),
                      })
                    }
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : editingBatch ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Batches Table */}
      <Card>
        <CardHeader>
          <CardTitle>Academic Year Batches</CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `${batches.length} batch(es) found`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading batches...
            </div>
          ) : batches.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No batches found</p>
              <p className="text-sm">
                Create your first academic year batch to get started
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Start Year</TableHead>
                  <TableHead>End Year</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell className="font-medium">{batch.name}</TableCell>
                    <TableCell>{batch.start_year}</TableCell>
                    <TableCell>{batch.end_year}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          batch.status === "Active"
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {batch.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(batch)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(batch)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
