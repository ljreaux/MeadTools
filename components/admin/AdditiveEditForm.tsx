"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
  const [formData, setFormData] = useState({
    ...additive,
    unit: additive.unit === "fl_oz" ? "fl oz" : additive.unit
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    const token = localStorage.getItem("accessToken");
    if (!token) {
      toast({
        title: "Error",
        description: "No token found in localStorage.",
        variant: "destructive"
      });
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/additives/${additive.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...formData,
          dosage: parseFloat(String(formData.dosage))
        })
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      toast({ title: "Success", description: "Additive updated." });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update additive.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      toast({
        title: "Error",
        description: "No token found in localStorage.",
        variant: "destructive"
      });
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/additives/${additive.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      toast({ title: "Deleted", description: "Additive was deleted." });
      router.push("/admin/additives");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete additive.",
        variant: "destructive"
      });
    } finally {
      setIsDeleting(false);
    }
  };

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
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
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
