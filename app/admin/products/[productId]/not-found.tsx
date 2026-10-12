import Link from "next/link";
import { ArrowLeft, PackageSearch } from "lucide-react";
import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminProductNotFound() {
  return (
    <div className="admin-v2">
      <AdminSidebar />
      <section className="admin-main">
        <main className="admin-content">
          <Link className="product-back" href="/admin/products">
            <ArrowLeft />
            Back to products
          </Link>
          <section className="admin-title">
            <PackageSearch aria-hidden="true" />
            <div>
              <p>PRODUCT RECORD</p>
              <h1>Product not found</h1>
              <span>This product is no longer in the live catalogue or the link is outdated.</span>
            </div>
          </section>
          <Link className="manage-store" href="/admin/products">
            Return to products
          </Link>
        </main>
      </section>
    </div>
  );
}
