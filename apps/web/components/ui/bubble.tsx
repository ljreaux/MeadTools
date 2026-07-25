import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const bubbleVariants = cva(
  "relative flex w-fit max-w-[80%] min-w-0 flex-col gap-1 data-[align=end]:self-end data-[variant=ghost]:max-w-full",
  {
    variants: {
      variant: {
        default: "[&>[data-slot=bubble-content]]:border-primary [&>[data-slot=bubble-content]]:bg-primary [&>[data-slot=bubble-content]]:text-primary-foreground",
        secondary: "[&>[data-slot=bubble-content]]:border-secondary [&>[data-slot=bubble-content]]:bg-secondary [&>[data-slot=bubble-content]]:text-secondary-foreground",
        muted: "[&>[data-slot=bubble-content]]:border-border [&>[data-slot=bubble-content]]:bg-muted",
        tinted: "[&>[data-slot=bubble-content]]:border-primary/20 [&>[data-slot=bubble-content]]:bg-primary/10 dark:[&>[data-slot=bubble-content]]:bg-primary/20",
        outline: "[&>[data-slot=bubble-content]]:border-border [&>[data-slot=bubble-content]]:bg-background",
        ghost: "border-none [&>[data-slot=bubble-content]]:max-w-full [&>[data-slot=bubble-content]]:rounded-none [&>[data-slot=bubble-content]]:border-transparent [&>[data-slot=bubble-content]]:bg-transparent [&>[data-slot=bubble-content]]:p-0",
        destructive: "[&>[data-slot=bubble-content]]:border-destructive/20 [&>[data-slot=bubble-content]]:bg-destructive/10 [&>[data-slot=bubble-content]]:text-destructive dark:[&>[data-slot=bubble-content]]:bg-destructive/20"
      }
    },
    defaultVariants: { variant: "default" }
  }
);

function Bubble({
  variant = "default",
  align = "start",
  className,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof bubbleVariants> & { align?: "start" | "end" }) {
  return <div className={cn(bubbleVariants({ variant }), className)} data-align={align} data-slot="bubble" data-variant={variant} {...props} />;
}

function BubbleContent({
  asChild = false,
  className,
  ...props
}: React.ComponentProps<"div"> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "div";
  return (
    <Comp
      className={cn("w-fit max-w-full min-w-0 overflow-hidden rounded-xl border border-transparent px-3 py-2 text-sm leading-relaxed break-words", className)}
      data-slot="bubble-content"
      {...props}
    />
  );
}

export { Bubble, BubbleContent, bubbleVariants };
