"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "../ui/select";

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

type NewAdditivePayload = {
  name: string;
  dosage: number;
  unit: string;
};

export default function NewAdditiveForm() {
  const router = useRouter();
  const { toast } = useToast();
  const fetchWithAuth = useFetchWithAuth();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    name: "",
    dosage: "",
    unit: ""
  });

  const createAdditive = useMutation({
    mutationFn: async (payload: NewAdditivePayload) => {
      // If your API expects fl_oz instead of "fl oz", normalize here:
      const normalizedUnit = payload.unit === "fl oz" ? "fl_oz" : payload.unit;

      return await fetchWithAuth("/api/additives", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          unit: normalizedUnit
        })
      });
    },
    onSuccess: () => {
      // Make sure the admin additives list refetches
      queryClient.invalidateQueries({ queryKey: qk.additives });
      toast({ title: "Success", description: "Additive created." });
      router.push("/admin/additives");
    },
    onError: (err: any) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to create additive.",
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

    const dosageNum = parseFloat(String(formData.dosage));
    if (Number.isNaN(dosageNum)) {
      toast({
        title: "Error",
        description: "Dosage must be a valid number.",
        variant: "destructive"
      });
      return;
    }

    await createAdditive.mutateAsync({
      name: formData.name,
      dosage: dosageNum,
      unit: formData.unit
    });
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
          disabled={createAdditive.isPending}
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
          disabled={createAdditive.isPending}
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
          disabled={createAdditive.isPending}
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

      <Button type="submit" disabled={createAdditive.isPending}>
        {createAdditive.isPending ? "Creating..." : "Create Additive"}
      </Button>
    </form>
  );
}
