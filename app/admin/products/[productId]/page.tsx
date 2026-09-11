import Link from "next/link";
import { notFound } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  BadgeIndianRupee,
  Boxes,
  CheckCircle2,
  Eye,
  FileText,
  GalleryHorizontal,
  History,
  Image as ImageIcon,
  Pencil,
  Save,
  Settings2,
  Star,
  Store,
} from "lucide-react";
import { AdminSidebar } from "@/components/admin-sidebar";
import { ProductMediaUploader } from "@/components/product-media-uploader";
import { categoryOptionLabel, orderCategoryTree } from "@/lib/category-tree";
import { createClient } from "@/lib/supabase/server";
import {
  updateProductContent,
  updateProductIdentity,
  updateProductOffer,
} from "../actions";

export const dynamic = "force-dynamic";
type Section = "overview" | "content" | "offers" | "history" | "preview";
const sections: [Section, string, typeof Boxes][] = [
  ["overview", "Overview", Boxes],
  ["content", "Images, variants & specifications", GalleryHorizontal],
  ["offers", "Store pricing & cashback", Store],
  ["history", "Price history", History],
  ["preview", "Customer-page preview", Eye],
];
const money = (value: number | string | null) =>
  value === null
    ? "—"
    : `₹${Math.round(Number(value)).toLocaleString("en-IN")}`;
const values = (data: unknown) => (Array.isArray(data) ? data : []);
const object = (data: unknown) =>
  data && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, string>)
    : {};

export default async function AdminProductDetail({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ section?: string; success?: string }>;
}) {
  const { productId } = await params,
    query = await searchParams,
    active = (
      sections.some(([key]) => key === query.section)
        ? query.section
        : "overview"
    ) as Section,
    s = await createClient();
  const [{ data: product }, { data: categories }, { data: history }] =
    await Promise.all([
      s
        .from("products")
        .select(
          "id,title,slug,brand,description,image_url,gallery_images,variants,specifications,product_information,category_id,is_active,updated_at,categories(id,name,slug),offers(id,current_price,list_price,cashback_amount,cashback_percent,reward_type,reward_terms,coupon_code,bank_offer,customer_rating,rating_count,stock_status,cashback_confirmation_days,variant_label,status,updated_at,merchants(id,name,slug,logo_url),affiliate_providers(name))",
        )
        .eq("id", productId)
        .single(),
      s
        .from("categories")
        .select("id,name,parent_id,display_order")
        .eq("is_active", true)
        .is("archived_at", null),
      s
        .from("product_price_history")
        .select("id,price,recorded_at,source,offers(merchants(name))")
        .eq("product_id", productId)
        .order("recorded_at", { ascending: false })
        .limit(100),
    ]);
  if (!product) notFound();
  const productCategory = (
    Array.isArray(product.categories)
      ? product.categories[0]
      : product.categories
  ) as { id: string; name: string; slug: string } | null;
  const gallery = values(product.gallery_images) as string[],
    variants = values(product.variants) as {
      label: string;
      values: string[];
    }[],
    specs = values(product.specifications) as {
      label: string;
      value: string;
    }[],
    info = object(product.product_information),
    offers = (product.offers ?? []) as any[],
    categoryTree = orderCategoryTree(categories ?? []);
  const checks = [
      ["Primary image", Boolean(product.image_url)],
      ["Gallery images", gallery.length > 0],
      ["Variants", variants.length > 0],
      ["Specifications", specs.length >= 10],
      ["Complete information", Object.keys(info).length > 0],
      ["Connected store offer", offers.length > 0],
      ["Offer rating", offers.some((o) => o.customer_rating !== null)],
      ["Price history", (history ?? []).length > 1],
    ] as const,
    complete = Math.round(
      (checks.filter(([, ok]) => ok).length / checks.length) * 100,
    );
  return (
    <main className="admin-v2">
      <AdminSidebar />
      <section className="admin-main">
        <main className="admin-content admin-product-detail">
          <Link className="product-back" href="/admin/products">
            <ArrowLeft />
            Back to products
          </Link>
          <header className="product-detail-heading">
            <div className="product-detail-image">
              {product.image_url ? (
                <img src={product.image_url} alt="" />
              ) : (
                <ImageIcon />
              )}
            </div>
            <div>
              <p>
                PRODUCT RECORD · PRD-
                {product.id.replaceAll("-", "").slice(0, 8).toUpperCase()}
              </p>
              <h1>{product.title}</h1>
              <span>
                {product.brand || "Brand missing"} ·{" "}
                {productCategory?.name || "Uncategorised"}
              </span>
            </div>
            <div className="product-completeness">
              <span>
                <b>{complete}%</b> complete
              </span>
              <i>
                <span style={{ width: `${complete}%` }} />
              </i>
              <small>
                {product.is_active
                  ? "Published to customer catalogue"
                  : "Draft—not visible to customers"}
              </small>
            </div>
          </header>
          {query.success && (
            <p className="product-save-success">
              <CheckCircle2 />
              {query.success}
            </p>
          )}
          <nav className="product-detail-tabs">
            {sections.map(([key, label, Icon]) => (
              <Link
                key={key}
                className={active === key ? "current" : ""}
                href={`?section=${key}`}
              >
                <Icon />
                {label}
              </Link>
            ))}
          </nav>
          {active === "overview" && (
            <section className="product-admin-grid">
              <form
                action={updateProductIdentity}
                className="product-editor-card"
              >
                <input type="hidden" name="productId" value={product.id} />
                <header>
                  <div>
                    <h2>Product identity</h2>
                    <p>
                      The canonical information shared by every connected store
                      offer.
                    </p>
                  </div>
                  <Pencil />
                </header>
                <div className="editor-fields">
                  <label>
                    Product title
                    <input name="title" required defaultValue={product.title} />
                  </label>
                  <label>
                    Brand
                    <input name="brand" defaultValue={product.brand ?? ""} />
                  </label>
                  <label>
                    Category
                    <select
                      name="categoryId"
                      defaultValue={product.category_id ?? ""}
                    >
                      <option value="">Uncategorised</option>
                      {categoryTree.map((category) => (
                        <option value={category.id} key={category.id}>
                          {categoryOptionLabel(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="wide">
                    <ProductMediaUploader
                      fieldName="imageUrl"
                      label="Primary product image"
                      productKey={product.id}
                      initialUrls={product.image_url ? [product.image_url] : []}
                    />
                  </div>
                  <label className="wide">
                    Description
                    <textarea
                      name="description"
                      rows={5}
                      defaultValue={product.description ?? ""}
                    />
                  </label>
                  <label className="publish-toggle">
                    <input
                      name="isActive"
                      type="checkbox"
                      defaultChecked={product.is_active}
                    />
                    <span>
                      <b>Published</b>
                      <small>
                        Make this product available to customer pages when its
                        offers are active.
                      </small>
                    </span>
                  </label>
                </div>
                <footer>
                  <button>
                    <Save />
                    Save identity
                  </button>
                </footer>
              </form>
              <aside className="product-readiness">
                <h2>Customer-page readiness</h2>
                {checks.map(([label, ok]) => (
                  <p key={label} className={ok ? "ready" : "missing"}>
                    {ok ? <CheckCircle2 /> : <AlertTriangle />}
                    <span>
                      {label}
                      <small>
                        {ok
                          ? "Information assigned"
                          : "Add or complete this section"}
                      </small>
                    </span>
                  </p>
                ))}
              </aside>
            </section>
          )}
          {active === "content" && (
            <form
              action={updateProductContent}
              className="product-editor-card product-content-editor"
            >
              <input type="hidden" name="productId" value={product.id} />
              <header>
                <div>
                  <h2>Customer-facing content</h2>
                  <p>
                    These exact values feed the image gallery, variation
                    selectors, top specifications and information accordions.
                  </p>
                </div>
                <Settings2 />
              </header>
              <div className="content-editor-sections">
                <ProductMediaUploader
                  fieldName="galleryImages"
                  label="Product gallery"
                  productKey={product.id}
                  initialUrls={gallery}
                  multiple
                />
                <label>
                  <span>
                    <b>Variants</b>
                    <small>One group per line: Name: option 1, option 2</small>
                  </span>
                  <textarea
                    name="variants"
                    rows={7}
                    defaultValue={variants
                      .map((v) => `${v.label}: ${v.values.join(", ")}`)
                      .join("\n")}
                    placeholder="Colour: Black, Blue, White&#10;Storage: 128 GB, 256 GB"
                  />
                </label>
                <label>
                  <span>
                    <b>Specifications</b>
                    <small>
                      One specification per line: Label: value. The first 10
                      appear prominently.
                    </small>
                  </span>
                  <textarea
                    name="specifications"
                    rows={10}
                    defaultValue={specs
                      .map((v) => `${v.label}: ${v.value}`)
                      .join("\n")}
                    placeholder="Display: 6.1-inch OLED&#10;Processor: A18"
                  />
                </label>
                <label>
                  <span>
                    <b>Complete product information</b>
                    <small>
                      One section per line: Section title: approved information
                    </small>
                  </span>
                  <textarea
                    name="productInformation"
                    rows={10}
                    defaultValue={Object.entries(info)
                      .map(([k, v]) => `${k.replaceAll("_", " ")}: ${v}`)
                      .join("\n")}
                    placeholder="Material / ingredients: …&#10;Warranty: …&#10;Delivery and returns: …"
                  />
                </label>
              </div>
              <footer>
                <Link href={`?section=preview`}>Preview first</Link>
                <button>
                  <Save />
                  Save customer-page content
                </button>
              </footer>
            </form>
          )}
          {active === "offers" && (
            <section className="offer-edit-list">
              <header>
                <div>
                  <h2>Connected store offers</h2>
                  <p>
                    Merchant-specific price, cashback, rating, stock and terms
                    shown in the comparison table.
                  </p>
                </div>
                <Link href="/admin/offers#create-offer">
                  Connect another store <ArrowRight />
                </Link>
              </header>
              {offers.length ? (
                offers.map((offer) => (
                  <form
                    action={updateProductOffer}
                    key={offer.id}
                    className="offer-editor"
                  >
                    <input type="hidden" name="productId" value={product.id} />
                    <input type="hidden" name="offerId" value={offer.id} />
                    <header>
                      {offer.merchants?.logo_url ? (
                        <img src={offer.merchants.logo_url} alt="" />
                      ) : (
                        <Store />
                      )}
                      <span>
                        <b>{offer.merchants?.name || "Store"}</b>
                        <small>
                          {offer.affiliate_providers?.name || "Direct / manual"}{" "}
                          · {offer.id.slice(0, 8)}
                        </small>
                      </span>
                      <em>{offer.status}</em>
                    </header>
                    <div>
                      <label>
                        Current price
                        <input
                          name="currentPrice"
                          type="number"
                          min="0"
                          step=".01"
                          defaultValue={offer.current_price ?? ""}
                        />
                      </label>
                      <label>
                        List price
                        <input
                          name="listPrice"
                          type="number"
                          min="0"
                          step=".01"
                          defaultValue={offer.list_price ?? ""}
                        />
                      </label>
                      <label>
                        Variant shown
                        <input
                          name="variantLabel"
                          defaultValue={offer.variant_label ?? ""}
                          placeholder="128 GB · Black"
                        />
                      </label>
                      <label>
                        Customer rating
                        <input
                          name="customerRating"
                          type="number"
                          min="0"
                          max="5"
                          step=".1"
                          defaultValue={offer.customer_rating ?? ""}
                        />
                      </label>
                      <label>
                        Rating count
                        <input
                          name="ratingCount"
                          type="number"
                          min="0"
                          defaultValue={offer.rating_count ?? ""}
                        />
                      </label>
                      <label>
                        Stock
                        <select
                          name="stockStatus"
                          defaultValue={offer.stock_status ?? "unknown"}
                        >
                          <option value="unknown">Unknown</option>
                          <option value="in_stock">In stock</option>
                          <option value="low_stock">Low stock</option>
                          <option value="out_of_stock">Out of stock</option>
                          <option value="preorder">Pre-order</option>
                        </select>
                      </label>
                      <label>
                        Cashback confirmation days
                        <input
                          name="cashbackDays"
                          type="number"
                          min="0"
                          max="365"
                          defaultValue={offer.cashback_confirmation_days ?? ""}
                        />
                      </label>
                      <label>
                        Status
                        <select name="status" defaultValue={offer.status}>
                          <option value="draft">Draft</option>
                          <option value="active">Active</option>
                          <option value="inactive">Inactive</option>
                          <option value="expired">Expired</option>
                        </select>
                      </label>
                      <label className="wide">
                        Bank offer
                        <input
                          name="bankOffer"
                          defaultValue={offer.bank_offer ?? ""}
                          placeholder="10% instant discount with eligible cards"
                        />
                      </label>
                      <label className="wide">
                        Terms and conditions
                        <textarea
                          name="rewardTerms"
                          rows={4}
                          defaultValue={offer.reward_terms ?? ""}
                        />
                      </label>
                    </div>
                    <footer>
                      <button>
                        <Save />
                        Save {offer.merchants?.name || "store"} offer
                      </button>
                    </footer>
                  </form>
                ))
              ) : (
                <div className="product-empty">
                  <Store />
                  <h3>No stores connected</h3>
                  <p>Create an offer and connect it to this product.</p>
                  <Link href="/admin/offers#create-offer">
                    Connect store offer
                  </Link>
                </div>
              )}
            </section>
          )}
          {active === "history" && (
            <section className="product-history-admin">
              <header>
                <div>
                  <h2>Stored price history</h2>
                  <p>
                    Every saved offer price becomes a real point in the customer
                    price-history view.
                  </p>
                </div>
                <BadgeIndianRupee />
              </header>
              {(history ?? []).length ? (
                <table>
                  <thead>
                    <tr>
                      <th>RECORDED</th>
                      <th>STORE</th>
                      <th>PRICE</th>
                      <th>SOURCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(history ?? []).map((item: any) => (
                      <tr key={item.id}>
                        <td>
                          {new Date(item.recorded_at).toLocaleString("en-IN")}
                        </td>
                        <td>
                          {item.offers?.merchants?.name || "Product record"}
                        </td>
                        <td>
                          <b>{money(item.price)}</b>
                        </td>
                        <td>{item.source}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="product-empty">
                  <History />
                  <h3>No stored price history</h3>
                  <p>
                    Saving a store price creates the first verified history
                    point.
                  </p>
                </div>
              )}
            </section>
          )}
          {active === "preview" && (
            <section className="admin-customer-preview">
              <header>
                <div>
                  <p>ADMIN-ONLY PREVIEW</p>
                  <h2>What the customer product page receives</h2>
                  <span>
                    This preview stays inside Admin. It reads the same product
                    and offer fields as the customer page.
                  </span>
                </div>
                <Link href="?section=content">
                  <Pencil />
                  Edit missing information
                </Link>
              </header>
              <article className="preview-product-hero">
                <div>
                  {product.image_url ? (
                    <img src={product.image_url} alt="" />
                  ) : (
                    <ImageIcon />
                  )}
                </div>
                <div>
                  <p>
                    {product.brand || "Brand missing"} ·{" "}
                    {productCategory?.name || "Uncategorised"}
                  </p>
                  <h1>{product.title}</h1>
                  <span>
                    {product.description || "Product description is missing."}
                  </span>
                  <div className="preview-variants">
                    {variants.length ? (
                      variants.map((v) => (
                        <section key={v.label}>
                          <b>{v.label}</b>
                          <div>
                            {v.values.map((value, index) => (
                              <i
                                className={index === 0 ? "selected" : ""}
                                key={value}
                              >
                                {value}
                              </i>
                            ))}
                          </div>
                        </section>
                      ))
                    ) : (
                      <em>Variants are missing</em>
                    )}
                  </div>
                </div>
              </article>
              <article className="preview-section">
                <h2>Store comparison</h2>
                {offers.map((offer) => (
                  <div className="preview-offer" key={offer.id}>
                    <b>{offer.merchants?.name}</b>
                    <span>{money(offer.current_price)}</span>
                    <span>{offer.bank_offer || "No bank offer"}</span>
                    <span>
                      {offer.cashback_amount
                        ? `${money(offer.cashback_amount)} cashback`
                        : "No cashback"}
                    </span>
                    <span>
                      <Star /> {offer.customer_rating ?? "—"}
                    </span>
                    <span>
                      {(offer.stock_status || "unknown").replaceAll("_", " ")}
                    </span>
                  </div>
                ))}
              </article>
              <article className="preview-section">
                <h2>Top specifications</h2>
                <div className="preview-specs">
                  {specs.slice(0, 10).map((spec) => (
                    <span key={spec.label}>
                      <Settings2 />
                      <b>{spec.label}</b>
                      <small>{spec.value}</small>
                    </span>
                  ))}
                  {!specs.length && <em>Specifications are missing.</em>}
                </div>
              </article>
              <footer>
                <FileText />
                <span>
                  <b>Public URL after publishing</b>
                  <small>/product/{product.slug}</small>
                </span>
              </footer>
            </section>
          )}
        </main>
      </section>
    </main>
  );
}
