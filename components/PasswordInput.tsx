"use client";

import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupInput,
  InputGroupAddon,
  InputGroupButton
} from "@/components/ui/input-group";

interface PasswordInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  revealable?: boolean;
  /** Extra class for the underlying input element */
  inputClassName?: string;
}

export const PasswordInput = React.forwardRef<
  HTMLInputElement,
  PasswordInputProps
>(({ revealable = true, className, inputClassName, ...props }, ref) => {
  const [isRevealed, setIsRevealed] = React.useState(false);

  if (!revealable) {
    return (
      <InputGroup className={cn("w-full", className)}>
        <InputGroupInput
          ref={ref}
          type="password"
          className={cn(inputClassName)}
          {...props}
        />
      </InputGroup>
    );
  }

  return (
    <InputGroup className={cn("w-full", className)}>
      <InputGroupInput
        ref={ref}
        type={isRevealed ? "text" : "password"}
        className={cn(inputClassName)}
        {...props}
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          type="button"
          size="icon-xs"
          variant="ghost"
          onClick={() => setIsRevealed((prev) => !prev)}
          aria-label={isRevealed ? "Hide password" : "Show password"}
        >
          {isRevealed ? <Eye /> : <EyeOff />}
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
  );
});

PasswordInput.displayName = "PasswordInput";
