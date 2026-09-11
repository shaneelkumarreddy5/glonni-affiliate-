import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bot,
  Boxes,
  CheckCircle2,
  ChevronRight,
  Clock3,
  CopyCheck,
  FileClock,
  FileSpreadsheet,
  Filter,
  Image as ImageIcon,
  PackagePlus,
  Search,
  Sparkles,
  Store,
  UploadCloud,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ProductMediaUploader } from "@/components/product-media-uploader";
import { createClient } from "@/lib/supabase/server";
import { addProduct } from "../actions";

export const dynamic = "force-dynamic";
type View =
  | "catalogue"
  | "manual"
  | "ai"
  | "bulk"
  | "feeds"
  | "approval"
  | "history"
  | "duplicates";
type Merchant = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
};
type Offer = {
  id: string;
  current_price: number | string | null;
  cashback_amount: number | string | null;
  cashback_percent: number | string | null;
  status: string;
  merchants: Merchant | null;
  affiliate_providers: { name: string } | null;
};
type Product = {
  id: string;
  title: string;
  slug: string;
  brand: string | null;
  image_url: string | null;
  is_active: boolean;
  updated_at: string;
  category_id: string | null;
  categories: { id: string; name?: string } | null;
  offers: Offer[] | null;
};
const tabs: [View, string, typeof Boxes][] = [
  ["catalogue", "Catalogue", Boxes],
  ["manual", "Manual Entry", PackagePlus],
  ["ai", "AI Discovery", Sparkles],
  ["bulk", "Bulk Uploads", UploadCloud],
  ["feeds", "Scheduled Feeds", Clock3],
  ["approval", "Approval Queue", CopyCheck],
  ["history", "Import History", FileClock],
  ["duplicates", "Duplicate Review", CopyCheck],
];
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const reward = (o: Offer) =>
  Number(o.cashback_amount || 0) ||
  (Number(o.current_price || 0) * Number(o.cashback_percent || 0)) / 100;
function Tabs({ active, badge }: { active: View; badge: number }) {
  return (
    <nav className="product-workflow-tabs" aria-label="Product workflows">
      {tabs.map(([key, label, Icon]) => (
        <Link
          className={active === key ? "current" : ""}
          aria-current={active === key ? "page" : undefined}
          href={
            key === "catalogue"
              ? "/admin/products"
              : `/admin/products?view=${key}`
          }
          key={key}
        >
          <Icon />
          {label}
          {key === "approval" && badge > 0 && <b>{badge}</b>}
        </Link>
      ))}
    </nav>
  );
}
function Logo({ merchant }: { merchant: Merchant }) {
  return (
    <span className="connected-store-logo" title={merchant.name}>
      {merchant.logo_url ? (
        <img src={merchant.logo_url} alt={`${merchant.name} logo`} />
      ) : (
        <i>{merchant.name[0]?.toUpperCase()}</i>
      )}
    </span>
  );
}
function Stores({ offers }: { offers: Offer[] }) {
  const unique = [
    ...new Map(
      offers.filter((o) => o.merchants).map((o) => [o.merchants!.id, o]),
    ).values(),
  ];
  if (!unique.length) return <span className="no-stores">No stores</span>;
  return (
    <div className="connected-stores">
      <div className="store-logo-stack">
        {unique.slice(0, 5).map((o) => (
          <Logo merchant={o.merchants!} key={o.merchants!.id} />
        ))}
        {unique.length > 5 && (
          <details>
            <summary
              aria-label={`Show all ${unique.length} stores`}
              title="Show all connected stores"
            >
              <ChevronRight />
              <span>+{unique.length - 5}</span>
            </summary>
            <div className="all-connected-stores">
              <header>
                <b>All connected stores</b>
                <small>{unique.length} merchant offers</small>
              </header>
              {unique.map((o) => (
                <div key={o.merchants!.id}>
                  <Logo merchant={o.merchants!} />
                  <span>
                    <strong>{o.merchants!.name}</strong>
                    <small>
                      {o.affiliate_providers?.name || "Direct / manual"}
                    </small>
                  </span>
                  <span>
                    <b>
                      {o.current_price
                        ? money(Number(o.current_price))
                        : "Price unavailable"}
                    </b>
                    <small>
                      {reward(o) > 0
                        ? `${money(reward(o))} cashback`
                        : "No cashback"}
                    </small>
                  </span>
                </div>
              ))}
            </div>
          </details>
        )}
      </div>
      <small>
        {unique.length} connected store{unique.length === 1 ? "" : "s"}
      </small>
    </div>
  );
}
type CatalogueFilters = {
  q?: string;
  status?: string;
  missing?: string;
  brand?: string;
  category?: string;
  store?: string;
  minPrice?: string;
  maxPrice?: string;
};
function Catalogue({
  products,
  filters,
  categories,
  merchants,
}: {
  products: Product[];
  filters: CatalogueFilters;
  categories: { id: string; name: string }[];
  merchants: Merchant[];
}) {
  const min = filters.minPrice ? Number(filters.minPrice) : null,
    max = filters.maxPrice ? Number(filters.maxPrice) : null;
  const rows = products.filter(
    (p) =>
      (!filters.q ||
        `${p.title} ${p.brand || ""} ${p.slug}`
          .toLowerCase()
          .includes(filters.q.toLowerCase())) &&
      (!filters.status ||
        (filters.status === "published" ? p.is_active : !p.is_active)) &&
      (!filters.missing || !(p.offers ?? []).length) &&
      (!filters.brand || p.brand === filters.brand) &&
      (!filters.category || p.category_id === filters.category) &&
      (!filters.store ||
        (p.offers ?? []).some((o) => o.merchants?.id === filters.store)) &&
      (min === null ||
        (p.offers ?? []).some((o) => Number(o.current_price) >= min)) &&
      (max === null ||
        (p.offers ?? []).some((o) => Number(o.current_price) <= max)),
  );
  const brands = [
    ...new Set(
      products.map((p) => p.brand).filter((x): x is string => Boolean(x)),
    ),
  ].sort();
  return (
    <>
      <section className="product-route-note">
        <Boxes />
        <span>
          <b>One connected catalogue.</b> Manual, AI and bulk sources arrive
          here after validation as Draft, Needs review or Published.
        </span>
      </section>
      <section className="product-kpis">
        <Link href="/admin/products">
          <Boxes />
          <span>
            Total products<b>{products.length}</b>
            <small>Canonical records</small>
          </span>
        </Link>
        <Link href="?status=published">
          <CheckCircle2 />
          <span>
            Published<b>{products.filter((p) => p.is_active).length}</b>
            <small>Shopper visible</small>
          </span>
        </Link>
        <Link href="?status=draft">
          <FileClock />
          <span>
            Drafts<b>{products.filter((p) => !p.is_active).length}</b>
            <small>Not published</small>
          </span>
        </Link>
        <Link href="?view=approval">
          <AlertTriangle />
          <span>
            Needs review<b>{products.filter((p) => !p.is_active).length}</b>
            <small>Action required</small>
          </span>
        </Link>
        <Link href="?missing=offers">
          <Store />
          <span>
            Missing offers
            <b>{products.filter((p) => !(p.offers ?? []).length).length}</b>
            <small>No store connected</small>
          </span>
        </Link>
      </section>
      <article className="product-catalogue-card">
        <header className="product-list-controls">
          <nav>
            <Link
              className={!filters.status && !filters.missing ? "current" : ""}
              href="/admin/products"
            >
              All products <b>{products.length}</b>
            </Link>
            <Link
              className={filters.status === "published" ? "current" : ""}
              href="?status=published"
            >
              Published
            </Link>
            <Link
              className={filters.status === "draft" ? "current" : ""}
              href="?status=draft"
            >
              Drafts
            </Link>
            <Link
              className={filters.missing === "offers" ? "current" : ""}
              href="?missing=offers"
            >
              Missing offers
            </Link>
          </nav>
          <form>
            <Search />
            <input
              name="q"
              defaultValue={filters.q}
              placeholder="Search product, brand or handle…"
            />
            <button>Search</button>
          </form>
          <a className="filter-button" href="#product-filters">
            <Filter />
            Filters
          </a>
        </header>
        <form id="product-filters" className="product-filter-panel">
          <label>
            Brand
            <select name="brand" defaultValue={filters.brand || ""}>
              <option value="">All brands</option>
              {brands.map((brand) => (
                <option key={brand}>{brand}</option>
              ))}
            </select>
          </label>
          <label>
            Category
            <select name="category" defaultValue={filters.category || ""}>
              <option value="">All categories</option>
              {categories.map((category) => (
                <option value={category.id} key={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Connected store
            <select name="store" defaultValue={filters.store || ""}>
              <option value="">All stores</option>
              {merchants.map((store) => (
                <option value={store.id} key={store.id}>
                  {store.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Minimum price
            <input
              name="minPrice"
              type="number"
              min="0"
              defaultValue={filters.minPrice}
              placeholder="₹0"
            />
          </label>
          <label>
            Maximum price
            <input
              name="maxPrice"
              type="number"
              min="0"
              defaultValue={filters.maxPrice}
              placeholder="Any price"
            />
          </label>
          <label>
            Status
            <select name="status" defaultValue={filters.status || ""}>
              <option value="">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
            </select>
          </label>
          <button>Apply filters</button>
          <Link href="/admin/products">Clear</Link>
        </form>
        <div className="product-table-scroll">
          <table className="product-catalogue-table">
            <thead>
              <tr>
                <th>PRODUCT</th>
                <th>CATEGORY</th>
                <th>CONNECTED STORES</th>
                <th>BEST PRICE</th>
                <th>BEST CASHBACK</th>
                <th>QUALITY</th>
                <th>UPDATED</th>
                <th>STATUS</th>
                <th>ACTION</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const offers = p.offers ?? [],
                  active = offers.filter((o) => o.status === "active"),
                  prices = active
                    .map((o) => Number(o.current_price || 0))
                    .filter(Boolean),
                  rewards = active.map(reward),
                  quality = Math.min(
                    100,
                    55 +
                      (p.image_url ? 15 : 0) +
                      (p.brand ? 10 : 0) +
                      (p.categories ? 10 : 0) +
                      (offers.length ? 10 : 0),
                  );
                return (
                  <tr key={p.id}>
                    <td>
                      <span className="catalogue-product">
                        {p.image_url ? (
                          <img src={p.image_url} alt="" />
                        ) : (
                          <ImageIcon />
                        )}
                        <span>
                          <Link
                            className="catalogue-product-link"
                            href={`/admin/products/${p.id}`}
                          >
                            <strong>{p.title}</strong>
                          </Link>
                          <small>
                            {p.brand || "Brand not assigned"} · PRD-
                            {p.id.replaceAll("-", "").slice(0, 8).toUpperCase()}
                          </small>
                        </span>
                      </span>
                    </td>
                    <td>{p.categories?.name || "Uncategorised"}</td>
                    <td>
                      <Stores offers={offers} />
                    </td>
                    <td>
                      <b>{prices.length ? money(Math.min(...prices)) : "—"}</b>
                      <small>
                        {active.length
                          ? "Across active offers"
                          : "Connect an offer"}
                      </small>
                    </td>
                    <td>
                      <b className="cashback-value">
                        {rewards.length && Math.max(...rewards) > 0
                          ? money(Math.max(...rewards))
                          : "—"}
                      </b>
                      <small>Best eligible reward</small>
                    </td>
                    <td>
                      <span className="quality-score">
                        <b>{quality}%</b>
                        <i>
                          <span style={{ width: `${quality}%` }} />
                        </i>
                      </span>
                    </td>
                    <td>
                      {new Date(p.updated_at).toLocaleDateString("en-IN")}
                    </td>
                    <td>
                      <span
                        className={`product-status ${p.is_active ? "published" : "draft"}`}
                      >
                        {p.is_active ? "Published" : "Draft"}
                      </span>
                    </td>
                    <td>
                      <Link
                        className="product-manage"
                        href={`/admin/products/${p.id}`}
                      >
                        Manage <ArrowRight />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length && (
            <div className="product-empty">
              <Boxes />
              <h3>No matching products</h3>
              <p>
                Change the search or add products through another workflow tab.
              </p>
            </div>
          )}
        </div>
        <footer>
          <span>
            Showing {rows.length} of {products.length} products
          </span>
          <span>Store icons come from each connected merchant record.</span>
        </footer>
      </article>
    </>
  );
}
function Manual({
  categories,
}: {
  categories: { id: string; name: string }[];
}) {
  return (
    <FocusedHeader
      icon={PackagePlus}
      eyebrow="MANUAL ENTRY"
      title="Create one canonical product"
      text="Add product identity here. Connect store-specific prices, cashback and links as offers after creation."
    >
      <form action={addProduct} className="manual-product-form">
        <fieldset>
          <legend>Product identity</legend>
          <label>
            Product name
            <input
              name="title"
              required
              placeholder="e.g. Apple iPhone 16 128GB"
            />
          </label>
          <label>
            Brand
            <input name="brand" placeholder="e.g. Apple" />
          </label>
          <label className="wide">
            Short description
            <textarea name="description" rows={4} />
          </label>
        </fieldset>
        <fieldset>
          <legend>Classification and media</legend>
          <label>
            Category
            <select name="category">
              <option value="">Choose the most specific category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <div className="wide">
            <ProductMediaUploader
              fieldName="image"
              label="Primary product image"
              productKey="new-product"
            />
          </div>
        </fieldset>
        <footer>
          <Link href="/admin/products">Cancel</Link>
          <button>Create product</button>
        </footer>
      </form>
    </FocusedHeader>
  );
}
function FocusedHeader({
  icon: Icon,
  eyebrow,
  title,
  text,
  children,
}: {
  icon: typeof Boxes;
  eyebrow: string;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className="product-focused-page">
      <header>
        <Icon />
        <div>
          <p>{eyebrow}</p>
          <h2>{title}</h2>
          <span>{text}</span>
        </div>
      </header>
      {children}
    </section>
  );
}
function Workflow({
  view,
  batches,
  providers,
}: {
  view: Exclude<View, "catalogue" | "manual">;
  batches: any[];
  providers: any[];
}) {
  const data = {
    ai: [
      "AI DISCOVERY",
      "Discover products with AI",
      "Search connected affiliate sources and send normalized candidates to approval.",
    ],
    bulk: [
      "BULK UPLOADS",
      "Upload product files",
      "Validate CSV or XLSX records before sending accepted products to the catalogue.",
    ],
    feeds: [
      "SCHEDULED FEEDS",
      "Manage scheduled feeds",
      "Control recurring product imports independently.",
    ],
    approval: [
      "APPROVAL QUEUE",
      "Review product candidates",
      "Approve validated manual, AI and imported products before publication.",
    ],
    history: [
      "IMPORT HISTORY",
      "Product import history",
      "Inspect every import result and its rejected rows.",
    ],
    duplicates: [
      "DUPLICATE REVIEW",
      "Resolve duplicate products",
      "Merge seller listings into one canonical product.",
    ],
  }[view];
  const Icon =
    view === "ai"
      ? Bot
      : view === "bulk"
        ? FileSpreadsheet
        : view === "feeds"
          ? Clock3
          : view === "history"
            ? FileClock
            : CopyCheck;
  const setup = ["ai", "bulk", "feeds"].includes(view);
  return (
    <FocusedHeader icon={Icon} eyebrow={data[0]} title={data[1]} text={data[2]}>
      {setup ? (
        <article className="workflow-action-card">
          <div>
            <h3>
              {view === "ai"
                ? "Start discovery"
                : view === "bulk"
                  ? "Upload a file"
                  : "Add a provider feed"}
            </h3>
            <p>
              This workflow creates a reviewable batch. It never publishes
              products directly.
            </p>
          </div>
          <div className="workflow-fields">
            <label>
              Affiliate provider
              <select>
                <option>Choose provider</option>
                {providers.map((p) => (
                  <option key={p.id}>
                    {p.name}
                    {p.is_active ? "" : " (inactive)"}
                  </option>
                ))}
              </select>
            </label>
            {view === "ai" && (
              <label>
                Discovery request
                <textarea
                  rows={4}
                  placeholder="Find the top 50 smartphone deals…"
                />
              </label>
            )}
            {view === "bulk" && (
              <label className="bulk-drop">
                <UploadCloud />
                <b>Choose CSV or XLSX</b>
                <small>Validate before import</small>
                <input type="file" accept=".csv,.xlsx" />
              </label>
            )}
            {view === "feeds" && (
              <>
                <label>
                  Feed URL
                  <input
                    type="url"
                    placeholder="https://provider.example/feed"
                  />
                </label>
                <label>
                  Frequency
                  <select>
                    <option>Every 6 hours</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                  </select>
                </label>
              </>
            )}
            <button type="button">Save as draft</button>
          </div>
        </article>
      ) : (
        <article className="workflow-list-card">
          <header>
            <h3>{data[1]}</h3>
            <Search />
          </header>
          {batches.length ? (
            batches.map((b) => (
              <div key={b.id}>
                <FileSpreadsheet />
                <span>
                  <b>{b.source_label}</b>
                  <small>{b.source_type.replaceAll("_", " ")}</small>
                </span>
                <span>
                  <b>
                    {b.valid_rows}/{b.total_rows} valid
                  </b>
                  <small>{b.invalid_rows} rejected</small>
                </span>
                <em>{b.status.replaceAll("_", " ")}</em>
                <button>
                  Review <ArrowRight />
                </button>
              </div>
            ))
          ) : (
            <div className="workflow-empty">
              <CheckCircle2 />
              <span>
                <b>Nothing requires attention</b>
                <small>
                  New records will appear when this workflow receives data.
                </small>
              </span>
            </div>
          )}
        </article>
      )}
    </FocusedHeader>
  );
}
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<CatalogueFilters & { view?: string }>;
}) {
  const query = await searchParams,
    view = (
      tabs.some(([key]) => key === query.view) ? query.view : "catalogue"
    ) as View,
    s = await createClient();
  const [
    { data: pd },
    { data: categories },
    { data: batches },
    { data: providers },
    { data: merchants },
  ] = await Promise.all([
    s
      .from("products")
      .select(
        "id,title,slug,brand,image_url,category_id,is_active,updated_at,categories(id,name),offers(id,current_price,cashback_amount,cashback_percent,status,merchants(id,name,slug,logo_url),affiliate_providers(name))",
      )
      .order("updated_at", { ascending: false }),
    s
      .from("categories")
      .select("id,name")
      .eq("is_active", true)
      .order("display_order"),
    s
      .from("import_batches")
      .select(
        "id,source_label,source_type,status,total_rows,valid_rows,invalid_rows,created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    s.from("affiliate_providers").select("id,name,is_active").order("name"),
    s.from("merchants").select("id,name,slug,logo_url").order("name"),
  ]);
  const products = (pd ?? []) as unknown as Product[],
    badge =
      (batches ?? []).filter((b) => b.status === "approval_required").length +
      products.filter((p) => !p.is_active).length;
  return (
    <main className="admin-v2">
      <AdminSidebar />
      <section className="admin-main">
        <main className="admin-content products-admin-page">
          <header className="products-page-heading">
            <div>
              <p>CATALOGUE MANAGEMENT</p>
              <h1>Products</h1>
              <span>
                Manage one canonical product and connect every seller offer,
                variant and cashback source.
              </span>
            </div>
            {view !== "manual" && (
              <Link className="product-primary" href="?view=manual">
                <PackagePlus />
                Add product
              </Link>
            )}
          </header>
          <Tabs active={view} badge={badge} />
          {view === "catalogue" ? (
            <Catalogue
              products={products}
              filters={query}
              categories={categories ?? []}
              merchants={merchants ?? []}
            />
          ) : view === "manual" ? (
            <Manual categories={categories ?? []} />
          ) : (
            <Workflow
              view={view}
              batches={batches ?? []}
              providers={providers ?? []}
            />
          )}
        </main>
      </section>
    </main>
  );
}
