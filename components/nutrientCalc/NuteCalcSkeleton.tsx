import { CardWrapper } from "../CardWrapper";
import { Skeleton } from "../ui/skeleton";
import { Separator } from "../ui/separator";

function NuteCalcSkeleton() {
  return (
    <div className="w-full flex flex-col justify-center items-center py-[6rem] relative">
      <CardWrapper>
        {/* Card heading skeleton (matches <Heading /> area) */}
        <h1 className="text-3xl text-center mb-6">
          <Skeleton className="h-8 w-48 mx-auto" />
        </h1>

        {/* --- Batch Details (VolumeInputs layout) --- */}
        <div className="joyride-nutrientInputs flex flex-col gap-4">
          {/* Section title */}
          <h3 className="text-base font-semibold">
            <Skeleton className="h-5 w-32" />
          </h3>

          {/* Volume */}
          <div className="space-y-2">
            {/* Label */}
            <Skeleton className="h-4 w-24" />

            {/* InputGroup shape */}
            <Skeleton className="h-12 w-full rounded-md" />
          </div>

          {/* SG + Offset on one line (stack on small) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* SG column */}
            <div className="col-span-1 grid gap-1 relative">
              {/* Label row (SG + tooltip) */}
              <Skeleton className="h-4 w-32" />

              {/* InputGroup shape */}
              <Skeleton className="h-12 w-full rounded-md" />

              {/* Sugar break line, tight under SG */}
              <span className="absolute top-full left-0 mt-0.5">
                <Skeleton className="h-3 w-32" />
              </span>
            </div>

            {/* Offset column */}
            <div className="joyride-offset col-span-1 grid gap-1">
              {/* Label */}
              <Skeleton className="h-4 w-20" />

              {/* Plain input shape */}
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          </div>

          <Separator className="my-4" />
        </div>

        {/* --- Yeast Details (YeastDetails layout) --- */}
        <div className="joyride-yeastDetails flex flex-col gap-4 mt-4">
          {/* Section title */}
          <h3 className="text-base font-semibold">
            <Skeleton className="h-5 w-32" />
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Yeast brand */}
            <div className="grid gap-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>

            {/* Yeast strain (searchable) */}
            <div className="grid gap-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>

            {/* Nitrogen requirement – full width */}
            <div className="grid gap-1 col-span-full">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-12 w-full rounded-md" />
            </div>
          </div>
        </div>
      </CardWrapper>

      {/* Bottom navigation buttons skeletons */}
      <div className="flex py-12 gap-4 w-11/12 max-w-[1200px] items-center justify-center">
        <Skeleton className="w-full h-10 rounded-md" />
        <Skeleton className="w-full h-10 rounded-md" />
      </div>
    </div>
  );
}

export default NuteCalcSkeleton;
