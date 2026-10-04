import { Suspense } from "react";
import { AdminInteractionFeedback } from "@/components/admin-interaction-feedback";
import { AdminTablePan } from "@/components/admin-table-pan";

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <><Suspense fallback={null}><AdminInteractionFeedback /></Suspense><AdminTablePan />{children}</>;
}
