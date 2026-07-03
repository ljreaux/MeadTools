"use client";

import { columns, Yeast } from "./columns";
import { DataTable } from "../ui/data-table";

export default function YeastTable({ data }: { data: Yeast[] }) {
  return <DataTable columns={columns} data={data} />;
}
