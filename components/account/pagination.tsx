import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
  PaginationEllipsis
} from "@/components/ui/pagination";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput
} from "@/components/ui/input-group";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function getPageWindow(page: number, total: number, windowSize = 3) {
  // returns an array like [page-1, page, page+1] clamped
  const half = Math.floor(windowSize / 2);
  let start = Math.max(1, page - half);
  const end = Math.min(total, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);

  const nums: number[] = [];
  for (let p = start; p <= end; p++) nums.push(p);
  return nums;
}

export function AccountPagination({
  page,
  totalPages,
  canPrev,
  canNext,
  onPrev,
  onNext,
  onGoTo
}: {
  page: number;
  totalPages: number;
  canPrev: boolean;
  canNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (p: number) => void;
}) {
  const windowPages = getPageWindow(page, totalPages, 3);
  const [value, setValue] = useState(String(page));

  useEffect(() => setValue(String(page)), [page]);

  return (
    <div
      className={cn("space-y-1", {
        hidden: totalPages <= 1
      })}
    >
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (canPrev) onPrev();
              }}
              aria-disabled={!canPrev}
              className={!canPrev ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>

          {/* Mobile: compact page input */}
          <PaginationItem className="sm:hidden w-full">
            <form
              className="flex items-center justify-center w-full"
              onSubmit={(e) => {
                e.preventDefault();
                const next = Math.max(
                  1,
                  Math.min(totalPages, Number(value || "1"))
                );
                onGoTo(next);
              }}
              autoComplete="off"
            >
              <InputGroup className="h-7 max-w-[160px]">
                <InputGroupInput
                  type="number"
                  min={1}
                  max={totalPages}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="h-7 px-1 text-center text-xs"
                />
                <InputGroupAddon
                  className="px-1 text-[11px] text-muted-foreground select-none"
                  align="inline-end"
                >
                  / {totalPages}
                </InputGroupAddon>
              </InputGroup>
            </form>
          </PaginationItem>

          {/* Desktop: numbered */}
          <PaginationItem className="hidden sm:list-item">
            <PaginationLink
              href="#"
              onClick={(e) => {
                e.preventDefault();
                onGoTo(1);
              }}
              isActive={page === 1}
              aria-current={page === 1 ? "page" : undefined}
            >
              1
            </PaginationLink>
          </PaginationItem>

          {totalPages > 4 && windowPages[0] > 2 && (
            <PaginationItem className="hidden sm:list-item">
              <PaginationEllipsis />
            </PaginationItem>
          )}

          {windowPages.map((p) => {
            if (p === 1 || p === totalPages) return null;
            return (
              <PaginationItem key={p} className="hidden sm:list-item">
                <PaginationLink
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onGoTo(p);
                  }}
                  isActive={p === page}
                  aria-current={p === page ? "page" : undefined}
                >
                  {p}
                </PaginationLink>
              </PaginationItem>
            );
          })}

          {totalPages > 4 &&
            windowPages[windowPages.length - 1] < totalPages - 1 && (
              <PaginationItem className="hidden sm:list-item">
                <PaginationEllipsis />
              </PaginationItem>
            )}

          {totalPages > 1 && (
            <PaginationItem className="hidden sm:list-item">
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onGoTo(totalPages);
                }}
                isActive={page === totalPages}
                aria-current={page === totalPages ? "page" : undefined}
              >
                {totalPages}
              </PaginationLink>
            </PaginationItem>
          )}

          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (canNext) onNext();
              }}
              aria-disabled={!canNext}
              className={!canNext ? "pointer-events-none opacity-50" : ""}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>

      <p className="mt-1 text-[11px] text-muted-foreground text-center hidden sm:block">
        Page {page} of {totalPages}
      </p>
    </div>
  );
}
