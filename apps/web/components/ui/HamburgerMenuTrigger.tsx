import * as React from "react";
import * as NavigationMenuPrimitive from "@radix-ui/react-navigation-menu";
import { cn } from "@/lib/utils";
import { Text, X } from "lucide-react";

const HoverHamburgerMenuTrigger = React.forwardRef<
  React.ElementRef<typeof NavigationMenuPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof NavigationMenuPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <NavigationMenuPrimitive.Trigger
    ref={ref}
    className={cn(
      "group inline-flex h-9 w-9 items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  >
    {/* Icon transitions based on `group-data-[state=open]` */}
    <span className="relative flex items-center justify-center w-full h-full">
      <p className="sr-only">Navigation Menu</p>
      {/* Hamburger Icon */}
      <Text
        className="absolute w-5 h-5 transition-transform duration-300 group-data-[state=open]:opacity-0 group-data-[state=open]:rotate-90 group-data-[state=open]:scale-0"
        aria-hidden="true"
      />
      {/* Close Icon */}
      <X
        className="absolute w-5 h-5 opacity-0 transition-transform duration-300 group-data-[state=open]:opacity-100 group-data-[state=open]:rotate-0 group-data-[state=open]:scale-100 group-data-[state=closed]:-rotate-90 group-data-[state=closed]:scale-0"
        aria-hidden="true"
      />
    </span>
    {children}
  </NavigationMenuPrimitive.Trigger>
));
HoverHamburgerMenuTrigger.displayName = "HoverHamburgerMenuTrigger";

export { HoverHamburgerMenuTrigger };
