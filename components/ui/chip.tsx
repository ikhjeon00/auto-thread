import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** 선택 칩: 기본은 흰 바탕+회색 테두리, 선택 시 주황 테두리+연주황 배경+✓ */
function Chip({
  selected = false,
  className,
  children,
  ...props
}: React.ComponentProps<"button"> & { selected?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-slot="chip"
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30 disabled:opacity-50",
        selected
          ? "border-primary bg-primary-soft font-medium text-primary"
          : "border-input bg-card text-foreground hover:bg-accent",
        className,
      )}
      {...props}
    >
      {selected && <Check className="size-3.5" strokeWidth={3} />}
      {children}
    </button>
  );
}

export { Chip };
