"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "../ui/select";
import { useToast } from "@/hooks/use-toast";
import { Ingredient } from "@/types/admin";

const CATEGORY_OPTIONS = [
  "sugar",
  "other",
  "water",
  "juice",
  "fruit",
  "vegetable",
  "dried fruit",
].sort((a, b) => a.localeCompare(b));

const initialFormData: Omit<Ingredient, "id"> = {
  name: "",
  sugar_content: "",
  water_content: "",
  category: "",
};

export default function NewIngredientForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const token = localStorage.getItem("accessToken");
    if (!token) {
      toast({
        title: "Error",
        description: "No token found in localStorage.",
        variant: "destructive",
      });
      setIsSubmitting(false);
      return;
    }

    try {
      const res = await fetch("/api/ingredients", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      toast({ title: "Success", description: "Ingredient created." });
      router.push("/admin/ingredients");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create ingredient.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
