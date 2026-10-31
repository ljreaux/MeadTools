"use client";

import type * as React from "react";
import { InputGroup, InputGroupAddon, InputGroupInput, InputGroupText } from "./input-group";
import { Separator } from "./separator";

export function AmountUnitField({
  id,
  amount,
  unit,
  onAmountChange,
  unitControl,
  disabled
}: {
  id?: string;
  amount: string;
  unit: string;
  onAmountChange: (value: string) => void;
  unitControl?: React.ReactNode;
  disabled?: boolean;
}) {
  if (!unitControl) {
    return (
      <InputGroup className="h-12">
        <InputGroupInput
          id={id}
          inputMode="decimal"
          value={amount}
          onChange={(event) => onAmountChange(event.target.value)}
          onFocus={(event) => event.target.select()}
          disabled={disabled}
          className="h-full text-lg"
        />
        <InputGroupAddon align="inline-end">
          <InputGroupText>{unit}</InputGroupText>
        </InputGroupAddon>
      </InputGroup>
    );
  }

  return (
    <InputGroup className="h-12">
      <InputGroupInput
        id={id}
        inputMode="decimal"
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
        onFocus={(event) => event.target.select()}
        disabled={disabled}
        className="h-full text-lg"
      />
      <InputGroupAddon align="inline-end" className="px-1 text-xs sm:text-sm whitespace-nowrap mr-1">
        <Separator orientation="vertical" className="h-12" />
        {unitControl}
      </InputGroupAddon>
    </InputGroup>
  );
}
