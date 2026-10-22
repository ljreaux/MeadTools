import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  // ✅ New shadcn base behavior (icons, gap, ring-1, etc.)
  "mt-button inline-flex min-w-0 max-w-full items-center justify-center gap-2 whitespace-normal [overflow-wrap:anywhere] text-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // ✅ Keep YOUR colors, but apply the new shadcn structure (and optional shadow)
        default:
          "mt-button--default bg-slate-900 text-slate-50 shadow hover:bg-slate-900/90 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-slate-50/90",
        destructive:
          "mt-button--destructive bg-red-500 text-slate-50 shadow-sm hover:bg-red-500/90 dark:bg-red-900 dark:text-slate-50 dark:hover:bg-red-900/90",
        outline:
          "mt-button--outline border border-input bg-background shadow-sm hover:bg-accent hover:text-accent-foreground",
        secondary:
          "mt-button--secondary border bg-background text-foreground shadow-sm hover:bg-foreground hover:border-background hover:text-background",
        ghost: "mt-button--ghost hover:bg-accent hover:text-accent-foreground",
        link: "mt-button--link text-slate-900 underline-offset-4 hover:underline dark:text-slate-50",

        // ✅ Preserve your custom variant
        emphasis:
          "mt-button--emphasis bg-green-600 text-slate-50 shadow hover:bg-green-600/90 dark:bg-green-600 dark:text-slate-50 dark:hover:bg-green-600/90"
      },
      size: {
        // ✅ New shadcn sizing (h-9 default, icon sizing, smaller sm text)
        default: "mt-button-size--default h-auto px-4 py-2",
        sm: "mt-button-size--sm h-auto rounded-md px-3 py-2 text-xs",
        lg: "mt-button-size--lg h-auto rounded-md px-8 py-2.5",
        icon: "mt-button-size--icon h-9 w-9 shrink-0 whitespace-nowrap",

        // ✅ Optional: if you’re using InputGroupButton size="icon-xs" elsewhere
        "icon-xs": "mt-button-size--icon-xs h-8 w-8 shrink-0 whitespace-nowrap"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
