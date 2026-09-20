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
import {
  categoryBranchIds,
  categoryOptionLabel,
  orderCategoryTree,
  type OrderedCategory,
} from "@/lib/category-tree";
import { createClient } from "@/lib/supabase/server";
import { ManualEntryWizard, type ManualStep } from "./manual-entry-wizard";
import { AiDiscoveryWorkspace } from "@/components/ai-discovery-workspace";
import {
  createProductFeed,
  importProductSpreadsheet,
  requestFeedRunReview,
  reviewProductCandidate,
  reviewProductFeed,
  reviewProductFeedRun,
  toggleProductFeed,
} from "./actions";

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
  is_active?: boolean;
};
type Offer = {
  id: string;
  current_price: number | string | null;
  destination_url?: string | null;
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
  description?: string | null;
  gallery_images?: string[] | null;
  variants?: unknown[] | null;
  specifications?: unknown[] | null;
  product_information?: Record<string, unknown> | null;
  manual_metadata?: Record<string, unknown> | null;
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
type ProductCategory = OrderedCategory<{
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
}>;
function Catalogue({
  products,
  filters,
  categories,
  merchants,
}: {
  products: Product[];
  filters: CatalogueFilters;
  categories: ProductCategory[];
  merchants: Merchant[];
}) {
  const min = filters.minPrice ? Number(filters.minPrice) : null,
    max = filters.maxPrice ? Number(filters.maxPrice) : null,
    categoryIds = filters.category
      ? categoryBranchIds(categories, filters.category)
      : null,
    categoryPaths = new Map(
      categories.map((category) => [category.id, category.treePath]),
    );
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
      (!categoryIds ||
        (p.category_id ? categoryIds.has(p.category_id) : false)) &&
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
                  {categoryOptionLabel(category)}
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
                    <td>
                      {p.category_id
                        ? categoryPaths.get(p.category_id) ||
                          p.categories?.name ||
                          "Uncategorised"
                        : "Uncategorised"}
                    </td>
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

type ImportBatch = {
  id: string;
  source_label: string;
  source_type: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  created_at: string;
  affiliate_providers: { name: string } | null;
};
type ImportRow = {
  id: string;
  row_number: number;
  status: string;
  raw_data: Record<string, unknown> | null;
  normalized_data: Record<string, unknown> | null;
  validation_errors: string[] | null;
  product_id: string | null;
};
function BulkUploadWorkspace({
  batches,
  providers,
  activeBatchId,
  rows,
  success,
  error,
}: {
  batches: ImportBatch[];
  providers: { id: string; name: string; is_active: boolean }[];
  activeBatchId?: string;
  rows: ImportRow[];
  success?: string;
  error?: string;
}) {
  const activeBatch = batches.find((batch) => batch.id === activeBatchId);
  return (
    <FocusedHeader
      icon={FileSpreadsheet}
      eyebrow="BULK UPLOADS"
      title="Upload and validate product files"
      text="Create reviewable product drafts from CSV or XLSX. Nothing is published automatically."
    >
      {success && <p className="product-queue-message success"><CheckCircle2 />{success}</p>}
      {error && <p className="product-queue-message error"><AlertTriangle />{error}</p>}
      <section className="bulk-upload-layout">
        <article className="bulk-upload-card">
          <header>
            <span><UploadCloud /></span>
            <div><h3>Upload product file</h3><p>Up to 1,000 products in one file · maximum 8 MB</p></div>
          </header>
          <form action={importProductSpreadsheet} className="bulk-upload-form">
            <label>
              Default affiliate provider <small>Optional</small>
              <select name="providerId" defaultValue="">
                <option value="">Direct / manual source</option>
                {providers.filter((provider) => provider.is_active).map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}
              </select>
            </label>
            <label className="bulk-file-drop">
              <FileSpreadsheet />
              <span><b>Choose CSV or XLSX file</b><small>The file is validated before drafts are created.</small></span>
              <input name="file" type="file" accept=".csv,.xlsx" required />
            </label>
            <div className="bulk-upload-submit">
              <Link href="/admin/products/bulk-template">Download CSV template</Link>
              <button type="submit"><UploadCloud />Validate & create drafts</button>
            </div>
          </form>
          <div className="bulk-column-guide">
            <div><b>Required columns</b><span>title</span><span>category</span><span>store</span><span>product_url</span><span>price</span></div>
            <div><b>Optional columns</b><span>brand</span><span>description</span><span>image_url</span><span>list_price</span><span>provider</span></div>
          </div>
        </article>
        <article className="bulk-batch-card">
          <header><div><h3>Upload history</h3><p>Open a batch to inspect every accepted or rejected row.</p></div><b>{batches.length} batches</b></header>
          <div className="bulk-batch-list">
            {batches.length ? batches.map((batch) => (
              <Link className={batch.id === activeBatchId ? "current" : ""} href={`?view=bulk&batch=${batch.id}`} key={batch.id}>
                <FileSpreadsheet />
                <span><strong>{batch.source_label}</strong><small>{batch.affiliate_providers?.name || "Direct / manual"} · {new Date(batch.created_at).toLocaleDateString("en-IN")}</small></span>
                <span><b>{batch.valid_rows}/{batch.total_rows}</b><small>valid rows</small></span>
                <em>{batch.status.replaceAll("_", " ")}</em>
                <ChevronRight />
              </Link>
            )) : <div className="workflow-empty"><FileSpreadsheet /><span><b>No uploads yet</b><small>Your validated batches will appear here.</small></span></div>}
          </div>
        </article>
      </section>
      {activeBatch && (
        <article className="bulk-results-card">
          <header>
            <div><p>VALIDATION RESULTS</p><h3>{activeBatch.source_label}</h3><span>{activeBatch.valid_rows} accepted · {activeBatch.invalid_rows} rejected or duplicate · {activeBatch.total_rows} total</span></div>
            {activeBatch.valid_rows > 0 && <Link href="?view=approval">Open approval queue <ArrowRight /></Link>}
          </header>
          <div className="bulk-results-scroll">
            <table>
              <thead><tr><th>ROW</th><th>PRODUCT</th><th>CATEGORY / STORE</th><th>PRICE</th><th>RESULT</th><th>ACTION</th></tr></thead>
              <tbody>{rows.map((row) => {
                const raw = row.raw_data ?? {}, normalized = row.normalized_data ?? {};
                return <tr key={row.id}>
                  <td>{row.row_number}</td>
                  <td><b>{String(normalized.title || raw.title || "Untitled row")}</b><small>{String(normalized.brand || raw.brand || "Brand not supplied")}</small></td>
                  <td><b>{String(raw.category || "—")}</b><small>{String(raw.store || "—")}</small></td>
                  <td>{normalized.current_price ? money(Number(normalized.current_price)) : "—"}</td>
                  <td><span className={`bulk-row-status ${row.status}`}>{row.status}</span>{Boolean(row.validation_errors?.length) && <small className="bulk-row-errors">{row.validation_errors!.join(" · ")}</small>}</td>
                  <td>{row.product_id ? <Link href={`/admin/products/${row.product_id}`}>Open draft <ArrowRight /></Link> : "—"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
          {!rows.length && <div className="workflow-empty"><AlertTriangle /><span><b>No row evidence available</b><small>This batch may have been created before row-level validation was added.</small></span></div>}
        </article>
      )}
    </FocusedHeader>
  );
}

type ProductFeed = {
  id: string;
  name: string;
  feed_url: string;
  file_format: string;
  frequency: string;
  status: string;
  last_run_at: string | null;
  next_run_at: string | null;
  review_note: string | null;
  affiliate_providers: { name: string } | null;
};
type ProductFeedRun = {
  id: string;
  feed_id: string;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  review_note: string | null;
  started_at: string;
  product_feeds: { name: string } | null;
};
function ScheduledFeedsWorkspace({ feeds, runs, providers, success, error }: { feeds: ProductFeed[]; runs: ProductFeedRun[]; providers: { id: string; name: string; is_active: boolean }[]; success?: string; error?: string }) {
  return <FocusedHeader icon={Clock3} eyebrow="SCHEDULED FEEDS" title="Manage recurring product feeds" text="Approve every feed configuration and review every feed run before catalogue changes are accepted.">
    {success && <p className="product-queue-message success"><CheckCircle2 />{success}</p>}
    {error && <p className="product-queue-message error"><AlertTriangle />{error}</p>}
    <section className="feed-management-grid">
      <article className="feed-create-card">
        <header><Clock3/><div><h3>Add scheduled feed</h3><p>The feed remains inactive until an administrator approves it.</p></div></header>
        <form action={createProductFeed}>
          <label>Feed name<input name="name" required placeholder="e.g. Cuelinks daily catalogue" /></label>
          <label>Affiliate provider<select name="providerId" required defaultValue=""><option value="" disabled>Choose provider</option>{providers.filter((provider) => provider.is_active).map((provider) => <option value={provider.id} key={provider.id}>{provider.name}</option>)}</select></label>
          <label className="feed-url-field">Secure feed URL<input name="feedUrl" type="url" required placeholder="https://provider.example/products.csv" /></label>
          <label>File format<select name="fileFormat" defaultValue="csv"><option value="csv">CSV</option><option value="xlsx">XLSX</option><option value="json">JSON</option><option value="xml">XML</option></select></label>
          <label>Frequency<select name="frequency" defaultValue="daily"><option value="manual">Manual only</option><option value="6_hours">Every 6 hours</option><option value="12_hours">Every 12 hours</option><option value="daily">Daily</option><option value="weekly">Weekly</option></select></label>
          <button type="submit">Submit for approval <ArrowRight /></button>
        </form>
      </article>
      <article className="feed-list-card">
        <header><div><h3>Configured feeds</h3><p>Approval, schedule and feed health are controlled here.</p></div><b>{feeds.length} feeds</b></header>
        <div className="feed-list">
          {feeds.length ? feeds.map((feed) => <section key={feed.id}>
            <div className="feed-list-main"><FileSpreadsheet/><span><strong>{feed.name}</strong><small>{feed.affiliate_providers?.name || "Provider unavailable"} · {feed.file_format.toUpperCase()} · {feed.frequency.replaceAll("_", " ")}</small></span><em className={feed.status}>{feed.status.replaceAll("_", " ")}</em></div>
            <div className="feed-list-meta"><span><b>Last run</b>{feed.last_run_at ? new Date(feed.last_run_at).toLocaleString("en-IN") : "Not run yet"}</span><span><b>Source</b>{new URL(feed.feed_url).hostname}</span></div>
            {feed.review_note && <p className="feed-review-note">Review note: {feed.review_note}</p>}
            <div className="feed-actions">
              {feed.status === "pending_approval" ? <details><summary>Review feed</summary><form action={reviewProductFeed}><input type="hidden" name="feedId" value={feed.id}/><textarea name="note" placeholder="Reason required when rejecting"/><div><button name="decision" value="approve" className="approve">Approve & activate</button><button name="decision" value="reject" className="reject">Reject</button></div></form></details> : feed.status === "active" ? <><form action={requestFeedRunReview}><input type="hidden" name="feedId" value={feed.id}/><button>Run & review now</button></form><form action={toggleProductFeed}><input type="hidden" name="feedId" value={feed.id}/><input type="hidden" name="status" value="paused"/><button>Pause</button></form></> : feed.status === "paused" ? <form action={toggleProductFeed}><input type="hidden" name="feedId" value={feed.id}/><input type="hidden" name="status" value="active"/><button>Resume</button></form> : null}
            </div>
          </section>) : <div className="workflow-empty"><Clock3/><span><b>No scheduled feeds</b><small>Add the first provider feed using the form.</small></span></div>}
        </div>
      </article>
    </section>
    <article className="feed-run-card">
      <header><div><h3>Feed run approval</h3><p>Approve or reject each completed run. Rejected runs never update the catalogue.</p></div><b>{runs.filter((run) => run.status === "pending_review").length} waiting</b></header>
      {runs.length ? <div className="feed-run-table"><table><thead><tr><th>FEED / STARTED</th><th>ROWS</th><th>RESULT</th><th>REVIEW</th></tr></thead><tbody>{runs.map((run) => <tr key={run.id}><td><b>{run.product_feeds?.name || "Deleted feed"}</b><small>{new Date(run.started_at).toLocaleString("en-IN")}</small></td><td><b>{run.valid_rows}/{run.total_rows} valid</b><small>{run.invalid_rows} rejected</small></td><td><span className={`feed-run-status ${run.status}`}>{run.status.replaceAll("_", " ")}</span>{run.review_note && <small>{run.review_note}</small>}</td><td>{run.status === "pending_review" ? <details><summary>Approve or reject</summary><form action={reviewProductFeedRun}><input type="hidden" name="runId" value={run.id}/><textarea name="note" placeholder="Reason required when rejecting"/><div><button name="decision" value="approve" className="approve">Approve run</button><button name="decision" value="reject" className="reject">Reject run</button></div></form></details> : "Reviewed"}</td></tr>)}</tbody></table></div> : <div className="workflow-empty"><CheckCircle2/><span><b>No feed runs yet</b><small>Approved feeds can be run and reviewed here.</small></span></div>}
    </article>
  </FocusedHeader>;
}

function ProductApprovalQueue({ products, success, error }: { products: Product[]; success?: string; error?: string }) {
  return <FocusedHeader icon={CopyCheck} eyebrow="APPROVAL QUEUE" title="Review product candidates" text="Approve validated manual, AI and imported products before publication.">
    {success && <p className="product-queue-message success"><CheckCircle2 />{success}</p>}
    {error && <p className="product-queue-message error"><AlertTriangle />{error}</p>}
    <article className="product-approval-queue">
      <header><div><h3>Products requiring approval</h3><p>The badge and this list now use the same product records.</p></div><b>{products.length} waiting</b></header>
      {products.length ? products.map((product) => {
        const completeOffer = (product.offers ?? []).some((offer: any) => Number(offer.current_price) > 0 && offer.destination_url);
        const checks = [Boolean(product.title), Boolean(product.category_id), Boolean(product.image_url), completeOffer];
        const readiness = Math.round((checks.filter(Boolean).length / checks.length) * 100);
        const missing = [!product.category_id && "category", !product.image_url && "primary image", !completeOffer && "complete store offer"].filter(Boolean);
        const reviewStatus = String(product.manual_metadata?.review_status ?? "pending_review");
        return <section className="product-approval-row" key={product.id}>
          <div className="product-approval-identity">{product.image_url ? <img src={product.image_url} alt="" /> : <ImageIcon />}<span><strong>{product.title}</strong><small>{product.brand || "Brand not set"} · {product.categories?.name || "Category not assigned"}</small></span></div>
          <div className="product-approval-readiness"><span><b>{readiness}% ready</b><small>{missing.length ? `Missing: ${missing.join(", ")}` : "Required publishing information complete"}</small></span><i><em style={{ width: `${readiness}%` }} /></i></div>
          <em className={`product-review-status ${reviewStatus}`}>{reviewStatus.replaceAll("_", " ")}</em>
          <div className="product-approval-actions"><Link href={`/admin/products/${product.id}`}>Review product</Link><details><summary>Decision</summary><form action={reviewProductCandidate}><input type="hidden" name="productId" value={product.id}/><textarea name="note" placeholder="Review note required for changes or rejection"/><div><button className="approve" name="decision" value="approve" disabled={missing.length > 0}>Approve & publish</button><button name="decision" value="changes_requested">Request changes</button><button className="reject" name="decision" value="reject">Reject</button></div></form></details></div>
        </section>;
      }) : <div className="workflow-empty"><CheckCircle2/><span><b>Nothing requires approval</b><small>New inactive product drafts will appear here automatically.</small></span></div>}
    </article>
  </FocusedHeader>;
}
export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<
    CatalogueFilters & {
      view?: string;
      draft?: string;
      step?: string;
      success?: string;
      error?: string;
      job?: string;
      batch?: string;
    }
  >;
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
        "id,title,slug,brand,description,image_url,gallery_images,variants,specifications,product_information,manual_metadata,category_id,is_active,updated_at,categories(id,name),offers(id,current_price,destination_url,cashback_amount,cashback_percent,status,merchants(id,name,slug,logo_url),affiliate_providers(name))",
      )
      .order("updated_at", { ascending: false }),
    s
      .from("categories")
      .select("id,name,parent_id,display_order")
      .eq("is_active", true)
      .is("archived_at", null),
    s
      .from("import_batches")
      .select(
        "id,source_label,source_type,status,total_rows,valid_rows,invalid_rows,created_at,affiliate_providers(name)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    s.from("affiliate_providers").select("id,name,is_active").order("name"),
    s.from("merchants").select("id,name,slug,logo_url,is_active").order("name"),
  ]);
  const draftId = query.draft || "";
  const [{ data: draft }, { data: draftHistory }] = draftId
    ? await Promise.all([
        s
          .from("products")
          .select(
            "id,title,slug,brand,description,image_url,gallery_images,variants,specifications,product_information,manual_metadata,category_id,is_active,offers(id,current_price,list_price,destination_url,status,reward_type,cashback_amount,cashback_percent,customer_rating,stock_status,merchants(id,name,logo_url),affiliate_providers(id,name))",
          )
          .eq("id", draftId)
          .single(),
        s
          .from("product_price_history")
          .select("id,price,recorded_at,source,offers(id,merchants(id,name))")
          .eq("product_id", draftId)
          .order("recorded_at", { ascending: false })
          .limit(100),
      ])
    : [{ data: null }, { data: [] }];
  const [{data:discoveryJobs},{data:discoveryCandidates}]=view==='ai'?await Promise.all([
    s.from('ai_jobs').select('id,status,review_status,input,created_at,completed_at,latest_error').eq('job_type','product_discovery').order('created_at',{ascending:false}).limit(30),
    query.job?s.from('ai_discovery_candidates').select('*').eq('job_id',query.job).order('position'):Promise.resolve({data:[]}),
  ]):[{data:[]},{data:[]}];
  const { data: batchRows } = view === "bulk" && query.batch
    ? await s.from("import_batch_rows").select("id,row_number,status,raw_data,normalized_data,validation_errors,product_id").eq("batch_id", query.batch).order("row_number")
    : { data: [] };
  const [{ data: productFeeds }, { data: productFeedRuns }] = view === "feeds" ? await Promise.all([
    s.from("product_feeds").select("id,name,feed_url,file_format,frequency,status,last_run_at,next_run_at,review_note,affiliate_providers(name)").order("created_at", { ascending: false }),
    s.from("product_feed_runs").select("id,feed_id,status,total_rows,valid_rows,invalid_rows,review_note,started_at,product_feeds(name)").order("started_at", { ascending: false }).limit(50),
  ]) : [{ data: [] }, { data: [] }];
  const products = (pd ?? []) as unknown as Product[],
    categoryTree = orderCategoryTree(categories ?? []),
    brandOptions = [
      ...new Set(
        products
          .map((product) => product.brand)
          .filter((brand): brand is string => Boolean(brand)),
      ),
    ],
    manualSteps: ManualStep[] = [
      "basic",
      "images",
      "variations",
      "specifications",
      "information",
      "offers",
      "history",
      "discovery",
      "review",
    ],
    manualStep = (
      manualSteps.includes(query.step as ManualStep) ? query.step : "basic"
    ) as ManualStep,
    approvalProducts = products.filter((product) => !product.is_active && product.manual_metadata?.review_status !== "rejected"),
    badge = approvalProducts.length;
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
              categories={categoryTree}
              merchants={merchants ?? []}
            />
          ) : view === "manual" ? (
            <ManualEntryWizard
              active={manualStep}
              success={query.success}
              draft={draft}
              categories={categoryTree}
              brands={brandOptions}
              merchants={merchants ?? []}
              providers={providers ?? []}
              products={products.map((product) => ({
                id: product.id,
                title: product.title,
                brand: product.brand,
              }))}
              history={draftHistory ?? []}
            />
          ) : view === "ai" ? (
            <AiDiscoveryWorkspace merchants={(merchants??[]).filter(merchant=>merchant.is_active)} categories={categoryTree} jobs={discoveryJobs??[]} candidates={discoveryCandidates??[]} activeJobId={query.job} success={query.success} error={query.error}/>
          ) : view === "bulk" ? (
            <BulkUploadWorkspace batches={(batches ?? []) as unknown as ImportBatch[]} providers={providers ?? []} activeBatchId={query.batch} rows={(batchRows ?? []) as ImportRow[]} success={query.success} error={query.error}/>
          ) : view === "feeds" ? (
            <ScheduledFeedsWorkspace feeds={(productFeeds ?? []) as unknown as ProductFeed[]} runs={(productFeedRuns ?? []) as unknown as ProductFeedRun[]} providers={providers ?? []} success={query.success} error={query.error}/>
          ) : view === "approval" ? (
            <ProductApprovalQueue products={approvalProducts} success={query.success} error={query.error}/>
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
