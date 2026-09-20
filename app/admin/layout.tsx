import { Suspense } from "react";
import { AdminInteractionFeedback } from "@/components/admin-interaction-feedback";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><Suspense fallback={null}><AdminInteractionFeedback /></Suspense>{children}</>;
}
