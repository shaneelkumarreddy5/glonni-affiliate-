"use client";

import { X } from "lucide-react";

export function DetailsCloseButton({ label = "Close", iconOnly = false }: { label?: string; iconOnly?: boolean }) {
  function closeEditor(event: React.MouseEvent<HTMLButtonElement>) {
    const button = event.currentTarget;
    button.closest("form")?.reset();
    button.closest("details")?.removeAttribute("open");
  }

  return <button type="button" className={iconOnly ? "details-close icon-only" : "details-close"} aria-label={label} onClick={closeEditor}>{iconOnly ? <X aria-hidden="true" /> : label}</button>;
}
