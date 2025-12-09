import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@/components/ui/table";
import { Skeleton } from "../ui/skeleton";
export function PrimingSugarSkeleton() {
  return (
    <div className="mt-6 w-full overflow-x-auto rounded-md border border-border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            {/* Sugar name */}
            <TableHead className="min-w-[140px] sticky left-0 z-10 bg-card border-r">
              <Skeleton className="h-4 w-24" />
            </TableHead>

            {/* Per batch */}
            <TableHead className="text-right whitespace-nowrap">
              <div className="flex flex-col items-end gap-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-6" />
              </div>
            </TableHead>

            {/* Per bottle columns (5-ish) */}
            {Array.from({ length: 5 }).map((_, idx) => (
              <TableHead key={idx} className="text-right whitespace-nowrap">
                <div className="flex flex-col items-end gap-1">
                  <Skeleton className="h-3 w-16" />
                  <Skeleton className="h-3 w-10" />
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {Array.from({ length: 4 }).map((_, rowIdx) => (
            <TableRow key={rowIdx}>
              {/* Sugar label cell */}
              <TableCell className="sticky left-0 z-10 bg-card border-r">
                <Skeleton className="h-4 w-28" />
              </TableCell>

              {/* Per batch cell */}
              <TableCell className="text-right">
                <div className="flex justify-end">
                  <Skeleton className="h-4 w-16" />
                </div>
              </TableCell>

              {/* Per bottle cells */}
              {Array.from({ length: 5 }).map((_, colIdx) => (
                <TableCell key={colIdx} className="text-right">
                  <div className="flex justify-end">
                    <Skeleton className="h-4 w-16" />
                  </div>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
