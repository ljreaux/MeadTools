"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type PerPageSelectProps = {
  value: number;
  onChange: (next: number) => void;
  allowedValues?: number[];
  label?: string;
  className?: string;
};

export default function PerPageSelect({
  value,
  onChange,
  allowedValues = [10, 20, 50],
  label = "Per page",
  className
}: PerPageSelectProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 text-xs text-muted-foreground",
        className
      )}
    >
      {label && <span>{label}</span>}

      <Select
        value={String(value)}
        onValueChange={(val) => {
          const num = Number(val);
          if (!Number.isNaN(num)) onChange(num);
        }}
      >
        <SelectTrigger className="h-7 w-[4.5rem] px-2 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {allowedValues.map((size) => (
            <SelectItem key={size} value={String(size)}>
              {size}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
