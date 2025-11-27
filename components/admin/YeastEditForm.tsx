"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";
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
import { useToast } from "@/hooks/use-toast";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";
import { Yeast } from "@/types/nutrientTypes";

interface Props {
  yeast: Yeast;
}

const BRAND_OPTIONS = [
  "Lalvin",
  "Red Star",
  "Mangrove Jack",
  "Fermentis",
  "Other"
];
const NITROGEN_OPTIONS = ["Low", "Medium", "High", "Very High"];

export default function YeastEditForm({ yeast }: Props) {
  const { toast } = useToast();
  const router = useRouter();
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({ ...yeast });

  const updateMutation = useMutation({
    mutationFn: async (payload: Yeast) => {
      return await fetchWithAuth<Yeast>(`/api/yeasts/${yeast.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload)
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.yeasts });
      toast({
        title: "Success",
        description: "Yeast updated successfully!"
      });
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update yeast.",
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      // assume API returns some JSON, but we don't care about the shape
      await fetchWithAuth<unknown>(`/api/yeasts/${yeast.id}`, {
        method: "DELETE"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.yeasts });
      toast({ title: "Deleted", description: "Yeast was deleted." });
      router.push("/admin/yeasts");
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err.message || "Failed to delete yeast.",
        variant: "destructive"
      });
    }
  });

  const isSaving = updateMutation.isPending;
  const isDeleting = deleteMutation.isPending;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof Yeast, value: string) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateMutation.mutateAsync(formData);
  };

  const handleDelete = async () => {
    await deleteMutation.mutateAsync();
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {/* Brand select */}
      <div className="space-y-1">
        <Label htmlFor="brand">Brand</Label>
        <Select
          value={formData.brand}
          onValueChange={(val) => handleSelectChange("brand", val)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a brand" />
          </SelectTrigger>
          <SelectContent>
            {BRAND_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Name input */}
      <div className="space-y-1">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
        />
      </div>

      {/* Nitrogen requirement select */}
      <div className="space-y-1">
        <Label htmlFor="nitrogen_requirement">Nitrogen Requirement</Label>
        <Select
          value={formData.nitrogen_requirement}
          onValueChange={(val) =>
            handleSelectChange("nitrogen_requirement", val)
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select nitrogen level" />
          </SelectTrigger>
          <SelectContent>
            {NITROGEN_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Other inputs */}
      {["tolerance", "low_temp", "high_temp"].map((key) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>
            {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Label>
          <Input
            id={key}
            name={key}
            value={formData[key as keyof Yeast]}
            onChange={handleChange}
          />
        </div>
      ))}

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
                Are you sure you want to delete <strong>{yeast.name}</strong>?
                This action cannot be undone.
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
