import { ChangeEvent } from "react";
import { cn } from "@/lib/utils";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from "@/components/ui/input-group";

type InputWithUnitsProps = {
  value: number | string;
  text: string;
  disabled?: boolean;
  handleChange?: (e: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
};

const InputWithUnits = ({
  value,
  text,
  disabled,
  handleChange,
  className
}: InputWithUnitsProps) => {
  return (
    <InputGroup className={cn("h-12", className)}>
      <InputGroupInput
        disabled={disabled}
        value={value}
        readOnly={disabled}
        onChange={handleChange}
        inputMode="decimal"
        onFocus={(e) => e.target.select()}
        className="h-full text-lg relative"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupText>{text}</InputGroupText>
      </InputGroupAddon>
    </InputGroup>
  );
};

export default InputWithUnits;
