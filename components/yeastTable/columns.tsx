"use client";

const listOrder = ["Low", "Medium", "High", "Very High"];

import Translate from "./Translate";
import { Button } from "@/components/ui/button";
import { ColumnDef } from "@tanstack/react-table";
import {
  ArrowUpAZ,
  ArrowDownAZ,
  ArrowUpDown,
  ArrowUp10,
  ArrowDown10
} from "lucide-react";

export type Yeast = {
  id: number;
  name: string;
  brand: "Lalvin" | "Fermentis" | "Mangrove Jack" | "Red Star" | "Other";
  nitrogen_requirement: string;
  tolerance: string;
  low_temp: string;
  high_temp: string;
};

type SortState = false | "asc" | "desc";

function AlphaSortIcon({ sorted }: { sorted: SortState }) {
  if (sorted === "asc") {
    return <ArrowUpAZ className="ml-2 h-4 w-4" />;
  }
  if (sorted === "desc") {
    return <ArrowDownAZ className="ml-2 h-4 w-4" />;
  }
  return <ArrowUpDown className="ml-2 h-4 w-4 opacity-60" />;
}

function NumericSortIcon({ sorted }: { sorted: SortState }) {
  if (sorted === "asc") {
    return <ArrowUp10 className="ml-2 h-4 w-4" />;
  }
  if (sorted === "desc") {
    return <ArrowDown10 className="ml-2 h-4 w-4" />;
  }
  return <ArrowUpDown className="ml-2 h-4 w-4 opacity-60" />;
}

export const columns: ColumnDef<Yeast>[] = [
  {
    accessorKey: "name",
    header: ({ column }) => {
      const sorted = column.getIsSorted() as SortState;

      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="-ml-2 px-1 font-extrabold"
        >
          <span className="text-[11px] sm:text-xs uppercase tracking-wide">
            <Translate accessor="tableHeadings.name" />
          </span>
          <AlphaSortIcon sorted={sorted} />
        </Button>
      );
    }
  },
  {
    accessorKey: "brand",
    enableSorting: true,
    header: ({ column }) => {
      const sorted = column.getIsSorted() as SortState;

      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="-ml-2 px-1 font-extrabold"
        >
          <span className="text-[11px] sm:text-xs uppercase tracking-wide">
            <Translate accessor="tableHeadings.brand" />
          </span>
          <AlphaSortIcon sorted={sorted} />
        </Button>
      );
    }
  },
  {
    accessorKey: "nitrogen_requirement",
    header: ({ column }) => {
      const sorted = column.getIsSorted() as SortState;

      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="-ml-2 px-1 font-extrabold"
        >
          <span className="text-[11px] sm:text-xs uppercase tracking-wide">
            <Translate accessor="tableHeadings.nitrogen_requirement" />
          </span>
          <AlphaSortIcon sorted={sorted} />
        </Button>
      );
    },
    sortingFn: (rowA, rowB) => {
      return (
        listOrder.indexOf(rowA.original.nitrogen_requirement) -
        listOrder.indexOf(rowB.original.nitrogen_requirement)
      );
    },
    cell: ({ row }) => {
      const keys: Record<string, string> = {
        Low: "low",
        Medium: "medium",
        High: "high",
        "Very High": "veryHigh"
      };

      const nitrogenRequirement = row.getValue(
        "nitrogen_requirement"
      ) as string;

      return (
        <span className="text-[11px] sm:text-xs uppercase tracking-wide">
          <Translate
            accessor={`nitrogenOptions.${keys[nitrogenRequirement]}`}
          />
        </span>
      );
    }
  },
  {
    accessorKey: "tolerance",
    header: ({ column }) => {
      const sorted = column.getIsSorted() as SortState;

      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="-ml-2 px-1 font-extrabold"
        >
          <span className="text-[11px] sm:text-xs uppercase tracking-wide">
            <Translate accessor="tableHeadings.tolerance" />
          </span>
          <NumericSortIcon sorted={sorted} />
        </Button>
      );
    },
    cell: ({ row }) => {
      return <>{`${row.getValue("tolerance")}%`}</>;
    }
  },
  {
    accessorKey: "low_temp",
    header: ({ column }) => {
      const sorted = column.getIsSorted() as SortState;

      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="-ml-2 px-1 font-extrabold"
        >
          <span className="text-[11px] sm:text-xs uppercase tracking-wide">
            <Translate accessor="tableHeadings.low_temp" />
          </span>
          <NumericSortIcon sorted={sorted} />
        </Button>
      );
    },
    cell: ({ row, table }) => {
      const { unit } = table.options.meta as any;
      const value = row.getValue("low_temp") as string;
      const celsius = Math.round((parseInt(value, 10) - 32) * (5 / 9));

      if (unit === "F") return <>{`${value}°F`}</>;
      return <>{`${celsius}°C`}</>;
    }
  },
  {
    accessorKey: "high_temp",
    header: ({ column }) => {
      const sorted = column.getIsSorted() as SortState;

      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(sorted === "asc")}
          className="-ml-2 px-1 font-extrabold"
        >
          <span className="text-[11px] sm:text-xs uppercase tracking-wide">
            <Translate accessor="tableHeadings.high_temp" />
          </span>
          <NumericSortIcon sorted={sorted} />
        </Button>
      );
    },
    cell: ({ row, table }) => {
      const { unit } = table.options.meta as any;
      const value = row.getValue("high_temp") as string;
      const celsius = Math.round((parseInt(value, 10) - 32) * (5 / 9));

      if (unit === "F") return <>{`${value}°F`}</>;
      return <>{`${celsius}°C`}</>;
    }
  }
];
