"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Yeast } from "@/types/admin";

const initialFormData: Omit<Yeast, "id"> = {
  brand: "",
  name: "",
  nitrogen_requirement: "",
  tolerance: "",
  low_temp: "",
  high_temp: "",
};

const BRAND_OPTIONS = [
  "Lalvin",
  "Red Star",
  "Mangrove Jack",
  "Fermentis",
  "Other",
];
const NITROGEN_OPTIONS = ["Low", "Medium", "High", "Very High"];

export default function NewYeastForm() {
  const { toast } = useToast();
  const router = useRouter();
  const [formData, setFormData] = useState(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: keyof typeof formData, value: string) => {
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
      const res = await fetch("/api/yeasts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(formData),
      });

      if (!res.ok) throw new Error(`Error ${res.status}: ${res.statusText}`);

      toast({ title: "Success", description: "Yeast created successfully!" });
      setFormData(initialFormData);
      router.push("/admin/yeasts");
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "Failed to create yeast.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold mb-2">Add New Yeast</h2>
        <Link href={"/admin/yeasts"}>Back to All Yeasts</Link>
      </div>
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

      {/* Nitrogen Requirement Select */}
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

      {/* Other fields */}
      {["tolerance", "low_temp", "high_temp"].map((key) => (
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

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Yeast"}
      </Button>
    </form>
  );
}
