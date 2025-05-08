"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";

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
  "tbsp",
];

export default function NewAdditiveForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    unit: "",
  });
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
      const res = await fetch("/api/additives", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          ...formData,
          dosage: parseFloat(String(formData.dosage)),
        }),
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      toast({ title: "Success", description: "Additive created." });
      router.push("/admin/additives");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create additive.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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
          value={formData.dosage}
          onChange={handleChange}
          type="number"
          step="any"
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Additive"}
      </Button>
    </form>
  );
}
