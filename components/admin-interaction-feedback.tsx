"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const clickableSelector = 'a[href],button:not([disabled]),summary,[role="button"],input[type="submit"],input[type="button"]';

export function AdminInteractionFeedback() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setPending(false);
    document.querySelectorAll(".admin-click-pending").forEach((element) => element.classList.remove("admin-click-pending"));
    if (timer.current) clearTimeout(timer.current);
  }, [pathname, searchParams]);

  useEffect(() => {
    const start = (control?: Element | null) => {
      setPending(true);
      control?.classList.add("admin-click-pending");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setPending(false);
        control?.classList.remove("admin-click-pending");
      }, 15000);
    };
    const onClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest(clickableSelector) : null;
      if (!target || !target.closest(".admin-v2")) return;
      target.classList.add("admin-click-confirmed");
      setTimeout(() => target.classList.remove("admin-click-confirmed"), 180);
      if (target instanceof HTMLAnchorElement && target.href && target.target !== "_blank") {
        const destination = new URL(target.href, window.location.href);
        if (destination.origin === window.location.origin && destination.href !== window.location.href) start(target);
      }
    };
    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form?.closest(".admin-v2")) return;
      start(event.submitter instanceof Element ? event.submitter : form);
    };
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  return <div className={`admin-global-progress${pending ? " visible" : ""}`} role="status" aria-live="polite" aria-label={pending ? "Loading" : undefined}><i/><span>Working…</span></div>;
}
