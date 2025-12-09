"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";

import { Additive } from "@/types/recipeDataTypes";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";

const UNIT_OPTIONS = [
  "g",
  "ml",
  "tsp",
  "oz",
  "units",
  "mg",
  "kg",
  "lbs",
  "liters",
  "fl oz",
  "quarts",
  "gal",
  "tbsp"
];

interface Props {
  additive: Additive;
}

export default function AdditiveEditForm({ additive }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fetchWithAuth = useFetchWithAuth();

  const [formData, setFormData] = useState({
    ...additive,
    // normalize fl_oz -> "fl oz" for the UI
    unit: additive.unit === "fl_oz" ? "fl oz" : additive.unit
  });

  const updateMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      // normalize back if needed
      const payload = {
        ...data,
        unit: data.unit === "fl oz" ? "fl_oz" : data.unit,
        dosage: parseFloat(String(data.dosage))
      };

      return await fetchWithAuth<Additive>(`/api/additives/${additive.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Additive updated." });
      // keep list views in sync
      queryClient.invalidateQueries({ queryKey: qk.additives });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to update additive.",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      await fetchWithAuth<unknown>(`/api/additives/${additive.id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      toast({ title: "Deleted", description: "Additive was deleted." });
      queryClient.invalidateQueries({ queryKey: qk.additives });
      router.push("/admin/additives");
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to delete additive.",
        variant: "destructive"
      });
    }
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync(formData);
  };

  const isSaving = updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Name */}
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
        />
      </div>

      {/* Dosage */}
      <div className="space-y-1">
        <Label htmlFor="dosage">Dosage</Label>
        <Input
          id="dosage"
          name="dosage"
          type="number"
          step="any"
          value={formData.dosage}
          onChange={handleChange}
        />
      </div>

      {/* Unit Select */}
      <div className="space-y-1">
        <Label htmlFor="unit">Unit</Label>
        <Select
          value={formData.unit}
          onValueChange={(val) =>
            setFormData((prev) => ({ ...prev, unit: val }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a unit" />
          </SelectTrigger>
          <SelectContent>
            {UNIT_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={isSaving}>
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button type="button" variant="destructive" disabled={isDeleting}>
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm deletion</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete <strong>{additive.name}</strong>
                ? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>
                Cancel
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteMutation.mutate()}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isDeleting}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </form>
  );
}
