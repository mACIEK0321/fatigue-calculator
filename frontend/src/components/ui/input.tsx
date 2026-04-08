"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-[#cbd5e1] bg-white px-3 py-2 text-[14px] text-[#0f172a] placeholder:text-[#94a3b8] shadow-sm outline-none transition focus:border-[#2563eb] focus:ring-4 focus:ring-[#dbeafe] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#94a3b8]",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
