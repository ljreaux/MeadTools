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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

export type Ingredient = {
  id: number;
  name: string;
  sugar_content: string | number;
  water_content: string | number;
  category: string | number;
};

interface Props {
  ingredient: Ingredient;
}
const CATEGORY_OPTIONS = [
  "sugar",
  "other",
  "water",
  "juice",
  "fruit",
  "vegetable",
  "dried fruit",
].sort((a, b) => a.localeCompare(b));
export default function IngredientEditForm({ ingredient }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState({ ...ingredient });
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
        variant: "destructive",
      });
      setIsSaving(false);
      return;
    }

    try {
      const res = await fetch(`/api/ingredients/${ingredient.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      toast({ title: "Success", description: "Ingredient updated." });
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to update ingredient.",
        variant: "destructive",
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
        variant: "destructive",
      });
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/ingredients/${ingredient.id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      toast({ title: "Deleted", description: "Ingredient was deleted." });
      router.push("/admin/ingredients");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to delete ingredient.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      {["name", "sugar_content", "water_content"].map((key) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>
            {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Label>
          <Input
            id={key}
            name={key}
            value={formData[key as keyof Ingredient]}
            onChange={handleChange}
          />
        </div>
      ))}

      {/* Category Select */}
      <div className="space-y-1">
        <Label htmlFor="category">Category</Label>
        <Select
          value={String(formData.category)}
          onValueChange={(val) =>
            setFormData((prev) => ({ ...prev, category: val }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORY_OPTIONS.map((option) => (
              <SelectItem key={option} value={option}>
                {option.replace(/\b\w/g, (c) => c.toUpperCase())}
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
                Are you sure you want to delete{" "}
                <strong>{ingredient.name}</strong>? This action cannot be
                undone.
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
