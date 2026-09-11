import Link from "next/link";
import {
  BadgeIndianRupee,
  Check,
  CheckCircle2,
  Circle,
  FileSearch,
  FileText,
  GalleryHorizontal,
  History,
  Images,
  ListChecks,
  PackagePlus,
  Search,
  Settings2,
  Store,
} from "lucide-react";
import { ProductMediaUploader } from "@/components/product-media-uploader";
import { categoryOptionLabel, type OrderedCategory } from "@/lib/category-tree";
import {
  addManualOffer,
  addManualPriceHistory,
  createManualProductDraft,
  publishManualProduct,
  saveManualBasic,
  saveManualDiscovery,
  saveManualImages,
  saveManualInformation,
  saveManualSpecifications,
  saveManualVariations,
} from "./actions";

type Category = OrderedCategory<{
  id: string;
  name: string;
  parent_id: string | null;
  display_order: number;
}>;
type Merchant = { id: string; name: string; logo_url?: string | null };
type Provider = { id: string; name: string; is_active: boolean };
type ProductSummary = { id: string; title: string; brand: string | null };
type Draft = any;
type Step =
  | "basic"
  | "images"
  | "variations"
  | "specifications"
  | "information"
  | "offers"
  | "history"
  | "discovery"
  | "review";

const steps: [Step, string, typeof PackagePlus][] = [
  ["basic", "Basic information", PackagePlus],
  ["images", "Images", Images],
  ["variations", "Variations", Settings2],
  ["specifications", "Specifications", ListChecks],
  ["information", "Product information", FileText],
  ["offers", "Store offers", Store],
  ["history", "Price history", History],
  ["discovery", "Search & discovery", Search],
  ["review", "Review & publish", CheckCircle2],
];
const getObject = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
const getArray = (value: unknown) => (Array.isArray(value) ? value : []);
const relation = <T,>(value: T | T[] | null | undefined) =>
  (Array.isArray(value) ? value[0] : value) as T | null | undefined;
const href = (draftId: string, step: Step) =>
  `/admin/products?view=manual&draft=${draftId}&step=${step}`;
const money = (value: number | string | null) =>
  value === null ? "—" : `₹${Number(value).toLocaleString("en-IN")}`;

function WizardTabs({ active, draftId }: { active: Step; draftId?: string }) {
  return (
    <nav className="manual-wizard-tabs" aria-label="Manual product steps">
      {steps.map(([key, label, Icon], index) => {
        const current = active === key;
        const body = (
          <>
            <span>{index + 1}</span>
            <Icon />
            <b>{label}</b>
          </>
        );
        return draftId ? (
          <Link
            className={current ? "current" : ""}
            href={href(draftId, key)}
            key={key}
          >
            {body}
          </Link>
        ) : (
          <span
            className={`${current ? "current" : ""} ${index ? "locked" : ""}`}
            key={key}
          >
            {body}
          </span>
        );
      })}
    </nav>
  );
}

function Header({ step, draft }: { step: Step; draft?: Draft | null }) {
  const item = steps.find(([key]) => key === step) ?? steps[0];
  const Icon = item[2];
  return (
    <header className="manual-step-heading">
      <Icon />
      <div>
        <p>
          MANUAL ENTRY · STEP {steps.findIndex(([key]) => key === step) + 1} OF
          9
        </p>
        <h2>{item[1]}</h2>
        <span>
          {draft
            ? `${draft.title} · Draft saves independently at every step.`
            : "Start with the product identity. The remaining steps unlock after the draft is created."}
        </span>
      </div>
      {draft && (
        <em>Draft · PRD-{String(draft.id).slice(0, 8).toUpperCase()}</em>
      )}
    </header>
  );
}

function NavButtons({
  draftId,
  step,
  submit = "Save & continue",
  disabled = false,
}: {
  draftId: string;
  step: Step;
  submit?: string;
  disabled?: boolean;
}) {
  const index = steps.findIndex(([key]) => key === step);
  return (
    <footer className="manual-step-actions">
      {index > 0 ? (
        <Link href={href(draftId, steps[index - 1][0])}>← Previous</Link>
      ) : (
        <span />
      )}
      <button disabled={disabled}>{submit}</button>
    </footer>
  );
}

export function ManualEntryWizard({
  active,
  success,
  draft,
  categories,
  brands,
  merchants,
  providers,
  products,
  history,
}: {
  active: Step;
  success?: string;
  draft?: Draft | null;
  categories: Category[];
  brands: string[];
  merchants: Merchant[];
  providers: Provider[];
  products: ProductSummary[];
  history: any[];
}) {
  const metadata = getObject(draft?.manual_metadata);
  const variants = getArray(draft?.variants);
  const specs = getArray(draft?.specifications);
  const info = getObject(draft?.product_information);
  const offers = getArray(draft?.offers);
  const brandOptions = [...new Set(brands.filter(Boolean))].sort();
  return (
    <section className="manual-wizard-shell">
      <WizardTabs active={active} draftId={draft?.id} />
      <Header step={active} draft={draft} />
      {success && (
        <p className="manual-save-message">
          <CheckCircle2 />
          {success}
        </p>
      )}

      {active === "basic" && (
        <form
          action={draft ? saveManualBasic : createManualProductDraft}
          className="manual-step-card"
        >
          {draft && <input type="hidden" name="productId" value={draft.id} />}
          <section className="manual-field-grid">
            <label>
              Product name <strong>Required</strong>
              <input
                name="title"
                required
                defaultValue={draft?.title ?? ""}
                placeholder="e.g. Apple iPhone 16 128GB"
              />
            </label>
            <label>
              Brand <strong>Required</strong>
              <input
                name="brand"
                required
                list="manual-brand-options"
                defaultValue={draft?.brand ?? ""}
                placeholder="Select or enter brand"
              />
              <datalist id="manual-brand-options">
                {brandOptions.map((brand) => (
                  <option value={brand} key={brand} />
                ))}
              </datalist>
            </label>
            <label>
              Category <strong>Required</strong>
              <select
                name="categoryId"
                required
                defaultValue={draft?.category_id ?? ""}
              >
                <option value="" disabled>
                  Choose through catalogue hierarchy
                </option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {categoryOptionLabel(category)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Model or product code
              <input
                name="modelCode"
                defaultValue={metadata.model_code ?? ""}
                placeholder="e.g. MYE73HN/A"
              />
            </label>
            <label className="wide">
              Short customer description
              <textarea
                name="description"
                rows={4}
                defaultValue={draft?.description ?? ""}
                placeholder="A concise description shown near the product title."
              />
            </label>
          </section>
          <footer className="manual-step-actions">
            <Link href="/admin/products">Cancel</Link>
            <button>
              {draft ? "Save & continue" : "Create draft & continue"}
            </button>
          </footer>
        </form>
      )}

      {draft && active === "images" && (
        <form action={saveManualImages} className="manual-step-card">
          <input type="hidden" name="productId" value={draft.id} />
          <div className="manual-media-stack">
            <ProductMediaUploader
              fieldName="imageUrl"
              label="Primary product image"
              productKey={draft.id}
              initialUrls={draft.image_url ? [draft.image_url] : []}
            />
            <ProductMediaUploader
              fieldName="galleryImages"
              label="Product gallery"
              productKey={draft.id}
              initialUrls={getArray(draft.gallery_images)}
              multiple
            />
          </div>
          <NavButtons draftId={draft.id} step="images" />
        </form>
      )}

      {draft && active === "variations" && (
        <form action={saveManualVariations} className="manual-step-card">
          <input type="hidden" name="productId" value={draft.id} />
          <p className="manual-guidance">
            Choose a variation type and enter its available values separated by
            commas. Leave unused rows empty.
          </p>
          <datalist id="variation-labels">
            {[
              "Colour",
              "Size",
              "Storage",
              "RAM",
              "Style",
              "Pack size",
              "Shade",
              "Weight",
              "Volume",
              "Material",
            ].map((x) => (
              <option value={x} key={x} />
            ))}
          </datalist>
          <div className="manual-repeat-list">
            {Array.from(
              { length: Math.max(6, variants.length) },
              (_, index) => (
                <div key={index}>
                  <span>{index + 1}</span>
                  <label>
                    Variation type
                    <input
                      name="variationLabel"
                      list="variation-labels"
                      defaultValue={variants[index]?.label ?? ""}
                      placeholder="Select type"
                    />
                  </label>
                  <label>
                    Available values
                    <input
                      name="variationValue"
                      defaultValue={getArray(variants[index]?.values).join(
                        ", ",
                      )}
                      placeholder="Black, Blue, White"
                    />
                  </label>
                </div>
              ),
            )}
          </div>
          <NavButtons draftId={draft.id} step="variations" />
        </form>
      )}

      {draft && active === "specifications" && (
        <form action={saveManualSpecifications} className="manual-step-card">
          <input type="hidden" name="productId" value={draft.id} />
          <p className="manual-guidance">
            The first 10 completed rows appear as top specifications. Their
            matching icons are selected automatically on the customer page.
          </p>
          <datalist id="spec-labels">
            {[
              "Display",
              "Processor",
              "Camera",
              "Battery",
              "Operating system",
              "Material",
              "Fit",
              "Dimensions",
              "Weight",
              "Colour",
              "Ingredients",
              "Skin type",
              "Warranty",
              "Connectivity",
            ].map((x) => (
              <option value={x} key={x} />
            ))}
          </datalist>
          <div className="manual-repeat-list specifications">
            {Array.from({ length: Math.max(12, specs.length) }, (_, index) => (
              <div key={index}>
                <span>{index + 1}</span>
                <label>
                  Specification
                  <input
                    name="specificationLabel"
                    list="spec-labels"
                    defaultValue={specs[index]?.label ?? ""}
                    placeholder="Select or enter specification"
                  />
                </label>
                <label>
                  Value
                  <input
                    name="specificationValue"
                    defaultValue={specs[index]?.value ?? ""}
                    placeholder="Enter exact value"
                  />
                </label>
                {index < 10 && <em>Top 10</em>}
              </div>
            ))}
          </div>
          <NavButtons draftId={draft.id} step="specifications" />
        </form>
      )}

      {draft && active === "information" && (
        <form action={saveManualInformation} className="manual-step-card">
          <input type="hidden" name="productId" value={draft.id} />
          <div className="manual-info-grid">
            {[
              ["highlights", "Product highlights"],
              ["features", "Features"],
              ["materials", "Materials or ingredients"],
              ["usage", "Usage or care instructions"],
              ["package_contents", "Package contents"],
              ["warranty", "Warranty"],
              ["manufacturer", "Manufacturer information"],
              ["additional_details", "Additional details"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <textarea name={key} rows={4} defaultValue={info[key] ?? ""} />
              </label>
            ))}
          </div>
          <NavButtons draftId={draft.id} step="information" />
        </form>
      )}

      {draft && active === "offers" && (
        <form action={addManualOffer} className="manual-step-card">
          <input type="hidden" name="productId" value={draft.id} />
          {offers.length > 0 && (
            <div className="manual-existing-offers">
              {offers.map((offer: any) => {
                const merchant = relation<any>(offer.merchants);
                return (
                  <article key={offer.id}>
                    <Store />
                    <span>
                      <b>{merchant?.name ?? "Connected store"}</b>
                      <small>
                        {money(offer.current_price)} · {offer.status}
                      </small>
                    </span>
                    <Check />
                  </article>
                );
              })}
            </div>
          )}
          <section className="manual-field-grid offer-fields">
            <label>
              Connected store <strong>Required</strong>
              <select name="merchantId" required defaultValue="">
                <option value="" disabled>
                  Choose store
                </option>
                {merchants.map((merchant) => (
                  <option value={merchant.id} key={merchant.id}>
                    {merchant.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Affiliate provider
              <select name="providerId" defaultValue="">
                <option value="">Direct merchant relationship</option>
                {providers.map((provider) => (
                  <option value={provider.id} key={provider.id}>
                    {provider.name}
                    {provider.is_active ? "" : " — inactive"}
                  </option>
                ))}
              </select>
            </label>
            <label className="wide">
              Affiliate product URL <strong>Required</strong>
              <input
                name="destinationUrl"
                type="url"
                required
                placeholder="https://merchant.example/product?affiliate=…"
              />
            </label>
            <label>
              Store product ID / SKU
              <input name="externalOfferId" />
            </label>
            <label>
              Variation covered
              <input
                name="variantLabel"
                list="offer-variants"
                placeholder="e.g. 128 GB · Black"
              />
              <datalist id="offer-variants">
                {variants.flatMap((v: any) =>
                  getArray(v.values).map((value) => (
                    <option
                      value={`${v.label}: ${value}`}
                      key={`${v.label}-${value}`}
                    />
                  )),
                )}
              </datalist>
            </label>
            <label>
              Selling price <strong>Required</strong>
              <input
                name="currentPrice"
                type="number"
                min="0"
                step="0.01"
                required
              />
            </label>
            <label>
              List price / MRP
              <input name="listPrice" type="number" min="0" step="0.01" />
            </label>
            <label>
              Reward type
              <select name="rewardType" defaultValue="none">
                <option value="none">No cashback</option>
                <option value="fixed_cashback">Fixed cashback</option>
                <option value="percentage_cashback">Percentage cashback</option>
                <option value="coupon">Coupon</option>
                <option value="merchant_promotion">Merchant promotion</option>
              </select>
            </label>
            <label>
              Cashback amount
              <input name="cashbackAmount" type="number" min="0" step="0.01" />
            </label>
            <label>
              Cashback percentage
              <input
                name="cashbackPercent"
                type="number"
                min="0"
                max="100"
                step="0.01"
              />
            </label>
            <label>
              Commission rate %
              <input
                name="commissionRate"
                type="number"
                min="0"
                max="100"
                step="0.001"
              />
            </label>
            <label>
              Commission amount
              <input
                name="commissionAmount"
                type="number"
                min="0"
                step="0.01"
              />
            </label>
            <label>
              Customer rating
              <select name="customerRating" defaultValue="">
                <option value="">Not available</option>
                {[5, 4.9, 4.8, 4.7, 4.6, 4.5, 4.4, 4.3, 4.2, 4.1, 4].map(
                  (rating) => (
                    <option key={rating}>{rating}</option>
                  ),
                )}
              </select>
            </label>
            <label>
              Rating count
              <input name="ratingCount" type="number" min="0" />
            </label>
            <label>
              Stock status
              <select name="stockStatus" defaultValue="in_stock">
                <option value="in_stock">In stock</option>
                <option value="low_stock">Low stock</option>
                <option value="out_of_stock">Out of stock</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label>
              Cashback confirmation
              <select name="cashbackDays" defaultValue="45">
                <option value="15">Within 15 days</option>
                <option value="30">Within 30 days</option>
                <option value="45">Within 45 days</option>
                <option value="60">Within 60 days</option>
                <option value="90">Within 90 days</option>
              </select>
            </label>
            <label>
              Coupon code
              <input name="couponCode" />
            </label>
            <label>
              Bank offer
              <input name="bankOffer" />
            </label>
            <label className="wide">
              Offer and cashback terms
              <textarea name="rewardTerms" rows={3} />
            </label>
          </section>
          <footer className="manual-step-actions">
            <Link href={href(draft.id, "information")}>← Previous</Link>
            <span className="manual-step-actions-right">
              {offers.length > 0 && (
                <Link href={href(draft.id, "history")}>
                  Continue without another offer →
                </Link>
              )}
              <button>Add store offer & continue</button>
            </span>
          </footer>
        </form>
      )}

      {draft && active === "history" && (
        <form action={addManualPriceHistory} className="manual-step-card">
          <input type="hidden" name="productId" value={draft.id} />
          <div className="manual-history-list">
            {history.length ? (
              history.map((row) => (
                <article key={row.id}>
                  <History />
                  <span>
                    <b>
                      {relation<any>(relation<any>(row.offers)?.merchants)
                        ?.name ?? "Store"}
                    </b>
                    <small>
                      {new Date(row.recorded_at).toLocaleString("en-IN")} ·{" "}
                      {row.source}
                    </small>
                  </span>
                  <strong>{money(row.price)}</strong>
                </article>
              ))
            ) : (
              <p>
                No price history yet. Adding a store offer creates the first
                point automatically.
              </p>
            )}
          </div>
          <section className="manual-field-grid compact">
            <label>
              Store offer
              <select name="offerId" required defaultValue="">
                <option value="" disabled>
                  Choose connected offer
                </option>
                {offers.map((offer: any) => (
                  <option value={offer.id} key={offer.id}>
                    {relation<any>(offer.merchants)?.name ?? "Store"} ·{" "}
                    {money(offer.current_price)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Historical price
              <input name="price" type="number" min="0" step="0.01" required />
            </label>
            <label>
              Recorded date and time
              <input name="recordedAt" type="datetime-local" />
            </label>
          </section>
          <NavButtons
            draftId={draft.id}
            step="history"
            disabled={!offers.length}
            submit={
              offers.length ? "Save history & continue" : "Add an offer first"
            }
          />
        </form>
      )}

      {draft && active === "discovery" && (
        <form action={saveManualDiscovery} className="manual-step-card">
          <input type="hidden" name="productId" value={draft.id} />
          <section className="manual-field-grid">
            <label>
              Homepage placement
              <select
                name="placement"
                defaultValue={metadata.placement ?? "none"}
              >
                <option value="none">Do not feature</option>
                <option value="hero">Hero</option>
                <option value="top_deals">Top deals</option>
                <option value="trending">Trending</option>
                <option value="price_drops">Price drops</option>
                <option value="cashback_picks">Cashback picks</option>
                <option value="collection">Collection</option>
              </select>
            </label>
            <label className="manual-check">
              <input
                name="featured"
                type="checkbox"
                defaultChecked={Boolean(metadata.featured)}
              />
              <span>
                <b>Featured product</b>
                <small>Prioritise in eligible catalogue placements.</small>
              </span>
            </label>
            <label>
              Search keywords
              <input
                name="searchKeywords"
                defaultValue={getArray(metadata.search_keywords).join(", ")}
                placeholder="iphone, smartphone, apple"
              />
            </label>
            <label>
              Tags
              <input
                name="tags"
                defaultValue={getArray(metadata.tags).join(", ")}
                placeholder="bestseller, premium"
              />
            </label>
            <label>
              SEO title
              <input
                name="seoTitle"
                maxLength={70}
                defaultValue={metadata.seo_title ?? draft.title}
              />
            </label>
            <label>
              SEO description
              <textarea
                name="seoDescription"
                rows={3}
                maxLength={180}
                defaultValue={
                  metadata.seo_description ?? draft.description ?? ""
                }
              />
            </label>
            <label className="wide">
              Related products
              <select
                name="relatedProductIds"
                multiple
                size={7}
                defaultValue={getArray(metadata.related_product_ids)}
              >
                {products
                  .filter((product) => product.id !== draft.id)
                  .map((product) => (
                    <option value={product.id} key={product.id}>
                      {product.brand ? `${product.brand} · ` : ""}
                      {product.title}
                    </option>
                  ))}
              </select>
              <small>Hold Ctrl or Command to select multiple products.</small>
            </label>
          </section>
          <NavButtons draftId={draft.id} step="discovery" />
        </form>
      )}

      {draft &&
        active === "review" &&
        (() => {
          const checks = [
            ["Product name", Boolean(draft.title)],
            ["Brand", Boolean(draft.brand)],
            ["Category", Boolean(draft.category_id)],
            ["Primary image", Boolean(draft.image_url)],
            ["Gallery", getArray(draft.gallery_images).length > 0],
            ["Variations", variants.length > 0],
            ["Top specifications", specs.length >= 10],
            ["Product information", Object.keys(info).length > 0],
            [
              "Store price & affiliate URL",
              offers.some(
                (offer: any) => offer.current_price && offer.destination_url,
              ),
            ],
          ] as const;
          const ready = checks.every(([, ok]) => ok);
          return (
            <section className="manual-review-grid">
              <article className="manual-step-card">
                <header className="review-summary">
                  <FileSearch />
                  <div>
                    <h3>Publishing readiness</h3>
                    <p>
                      {checks.filter(([, ok]) => ok).length} of {checks.length}{" "}
                      sections complete
                    </p>
                  </div>
                </header>
                <div className="review-checks">
                  {checks.map(([label, ok]) => (
                    <p className={ok ? "complete" : "missing"} key={label}>
                      {ok ? <CheckCircle2 /> : <Circle />}
                      <span>
                        <b>{label}</b>
                        <small>{ok ? "Complete" : "Needs information"}</small>
                      </span>
                    </p>
                  ))}
                </div>
                <form action={publishManualProduct}>
                  <input type="hidden" name="productId" value={draft.id} />
                  <footer className="manual-step-actions">
                    <Link href={href(draft.id, "discovery")}>← Previous</Link>
                    <button disabled={!ready}>
                      {ready ? "Publish product" : "Complete required sections"}
                    </button>
                  </footer>
                </form>
              </article>
              <aside className="manual-preview-card">
                <GalleryHorizontal />
                <h3>Customer-page preview</h3>
                <p>
                  Review the exact information currently assigned without
                  leaving the admin panel.
                </p>
                <Link href={`/admin/products/${draft.id}?section=preview`}>
                  Open full admin preview →
                </Link>
              </aside>
            </section>
          );
        })()}
    </section>
  );
}

export type ManualStep = Step;
