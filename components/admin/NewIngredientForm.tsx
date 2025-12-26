"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem
} from "../ui/select";

import { useToast } from "@/hooks/use-toast";
import { Ingredient } from "@/types/recipeDataTypes";
import { useFetchWithAuth } from "@/hooks/auth/useFetchWithAuth";
import { qk } from "@/lib/db/queryKeys";

const CATEGORY_OPTIONS = [
  "sugar",
  "other",
  "water",
  "juice",
  "fruit",
  "vegetable",
  "dried fruit"
].sort((a, b) => a.localeCompare(b));

const initialFormData: Omit<Ingredient, "id"> = {
  name: "",
  sugar_content: "",
  water_content: "",
  category: ""
};

export default function NewIngredientForm() {
  const router = useRouter();
  const { toast } = useToast();
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState(initialFormData);

  const createIngredientMutation = useMutation<
    Ingredient,
    Error,
    typeof initialFormData
  >({
    mutationFn: async (payload) =>
      fetchWithAuth<Ingredient>("/api/ingredients", {
        method: "POST",
        body: JSON.stringify(payload)
      }),
    onSuccess: () => {
      // Invalidate all ingredient lists (no category filter)
      queryClient.invalidateQueries({ queryKey: qk.ingredients() });
      toast({ title: "Success", description: "Ingredient created." });
      router.push("/admin/ingredients");
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to create ingredient.",
        variant: "destructive"
      });
    }
  });

  const isSubmitting = createIngredientMutation.isPending;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createIngredientMutation.mutate(formData);
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <h2 className="text-2xl font-bold mb-2">Add New Ingredient</h2>

      {["name", "sugar_content", "water_content"].map((key) => (
        <div key={key} className="space-y-1">
          <Label htmlFor={key}>
            {key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Label>
          <Input
            id={key}
            name={key}
            value={formData[key as keyof typeof formData]}
            onChange={handleChange}
          />
        </div>
      ))}

      {/* Category Select */}
      <div className="space-y-1">
        <Label htmlFor="category">Category</Label>
        <Select
          value={formData.category}
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Ingredient"}
      </Button>
    </form>
  );
}
