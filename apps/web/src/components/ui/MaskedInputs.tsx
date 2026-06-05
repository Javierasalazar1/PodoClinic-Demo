import * as React from "react";
import { cn } from "@/lib/utils";
import { formatRut, formatPhone, onlyLetters, onlyDigits, onlyRutChars, onlyPhoneChars } from "@/lib/inputFormatters";

// ---------------------------------------------------------------------------
// Base interface reutilizable
// ---------------------------------------------------------------------------
interface BaseInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  label?: string;
  error?: string;
  onChange?: (value: string) => void;
}

function FieldWrapper({
  label,
  id,
  required,
  error,
  children,
}: {
  label?: string;
  id?: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 w-full">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-foreground">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function baseInputClass(error?: string, className?: string) {
  return cn(
    "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
    error && "border-destructive focus-visible:ring-destructive",
    className
  );
}

// ---------------------------------------------------------------------------
// RutInput — formatea automáticamente como 12.345.678-9
// ---------------------------------------------------------------------------
export interface RutInputProps extends BaseInputProps {
  /** Callback con el valor formateado */
  onChange?: (formatted: string) => void;
}

export const RutInput = React.forwardRef<HTMLInputElement, RutInputProps>(
  ({ label, error, id, className, onChange, value, ...props }, ref) => {
    const inputId = id ?? React.useId();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatRut(e.target.value);
      onChange?.(formatted);
    };

    return (
      <FieldWrapper label={label} id={inputId} required={props.required} error={error}>
        <input
          id={inputId}
          ref={ref}
          type="text"
          inputMode="numeric"
          placeholder="12.345.678-9"
          onKeyDown={onlyRutChars}
          onChange={handleChange}
          value={value}
          maxLength={12}
          className={baseInputClass(error, className)}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
RutInput.displayName = "RutInput";

// ---------------------------------------------------------------------------
// PhoneInput — formatea como +56 9 1234 5678
// ---------------------------------------------------------------------------
export interface PhoneInputProps extends BaseInputProps {
  onChange?: (formatted: string) => void;
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ label, error, id, className, onChange, value, ...props }, ref) => {
    const inputId = id ?? React.useId();

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatPhone(e.target.value);
      onChange?.(formatted);
    };

    return (
      <FieldWrapper label={label} id={inputId} required={props.required} error={error}>
        <input
          id={inputId}
          ref={ref}
          type="tel"
          inputMode="tel"
          placeholder="+56 9 1234 5678"
          onKeyDown={onlyPhoneChars}
          onChange={handleChange}
          value={value}
          maxLength={17}
          className={baseInputClass(error, className)}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
PhoneInput.displayName = "PhoneInput";

// ---------------------------------------------------------------------------
// LettersInput — solo letras, acentos y espacios
// ---------------------------------------------------------------------------
export interface LettersInputProps extends BaseInputProps {
  onChange?: (value: string) => void;
}

export const LettersInput = React.forwardRef<HTMLInputElement, LettersInputProps>(
  ({ label, error, id, className, onChange, ...props }, ref) => {
    const inputId = id ?? React.useId();

    return (
      <FieldWrapper label={label} id={inputId} required={props.required} error={error}>
        <input
          id={inputId}
          ref={ref}
          type="text"
          onKeyDown={onlyLetters}
          onChange={(e) => onChange?.(e.target.value)}
          className={baseInputClass(error, className)}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
LettersInput.displayName = "LettersInput";

// ---------------------------------------------------------------------------
// NumberInput — solo dígitos
// ---------------------------------------------------------------------------
export interface NumberInputProps extends BaseInputProps {
  onChange?: (value: string) => void;
}

export const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ label, error, id, className, onChange, ...props }, ref) => {
    const inputId = id ?? React.useId();

    return (
      <FieldWrapper label={label} id={inputId} required={props.required} error={error}>
        <input
          id={inputId}
          ref={ref}
          type="text"
          inputMode="numeric"
          onKeyDown={onlyDigits}
          onChange={(e) => onChange?.(e.target.value)}
          className={baseInputClass(error, className)}
          {...props}
        />
      </FieldWrapper>
    );
  }
);
NumberInput.displayName = "NumberInput";
