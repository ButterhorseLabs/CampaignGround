"use client";

import { useApp, type Module } from "@/lib/store";

/**
 * A real link to a module (`/dashboard?view=…`), so it can be opened in a new
 * tab or copied; a plain click switches modules in place.
 */
export function ModuleLink({ module, onNavigate, ...props }: Omit<React.ComponentProps<"a">, "href"> & {
  module: Module;
  onNavigate?: () => void;
}) {
  const setModule = useApp((s) => s.set);
  return (
    <a
      {...props}
      href={module === "dashboard" ? "/dashboard" : `/dashboard?view=${module}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        setModule(module);
        onNavigate?.();
      }}
    />
  );
}
