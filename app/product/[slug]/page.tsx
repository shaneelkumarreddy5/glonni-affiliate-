import { Header } from "@/components/header";
import { BrowseNav } from "@/components/browse-nav";
import { PriceAlertButton } from "@/components/price-alert-button";
import { SaveOfferButton } from "@/components/save-offer-button";
import { ProductGallery } from "@/components/product-gallery";
import {
  getCatalogOffers,
  getProductOffers,
  type CatalogOffer,
} from "@/lib/catalog";
import { rewardLabel } from "@/lib/rewards";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ContextualFaqs } from "@/components/contextual-faqs";
import { CmsManagedSections } from "@/components/cms-managed-sections";
import { safeReturnPath } from "@/lib/navigation";
import {
  Battery,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleGauge,
  Droplets,
  Eye,
  MonitorSmartphone,
  PackageCheck,
  Palette,
  Ruler,
  ScanFace,
  ShieldCheck,
  Shirt,
  Sparkles,
  Star,
  Tag,
  Wifi,
} from "lucide-react";
import type { ReactNode } from "react";

export const dynamic = "force-dynamic";
const money = (value: number | null | undefined) =>
  `₹${Math.round(value ?? 0).toLocaleString("en-IN")}`;
const updatedLabel = (value: string | null) => value ? new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Update time unavailable';
type Presentation = {
  kind: "electronics" | "fashion" | "beauty" | "general";
  variants: { label: string; values: string[] }[];
  specs: { icon: ReactNode; label: string; value: string }[];
  guideTitle: string;
  guideText: string;
};
const icon = (node: ReactNode) => <span className="pdp-spec-icon">{node}</span>;
const specificationIcon = (key?: string) => {
  const value=(key??'').toLowerCase();
  if(/display|screen/.test(value))return icon(<MonitorSmartphone/>); if(/processor|performance|speed/.test(value))return icon(<CircleGauge/>); if(/camera|photo/.test(value))return icon(<Camera/>); if(/battery|power/.test(value))return icon(<Battery/>); if(/colour|color|shade|pattern/.test(value))return icon(<Palette/>); if(/size|dimension|weight|measurement/.test(value))return icon(<Ruler/>); if(/fit|fabric|material|sleeve/.test(value))return icon(<Shirt/>); if(/skin|coverage/.test(value))return icon(<Droplets/>); if(/security|face/.test(value))return icon(<ScanFace/>); if(/connect|wifi|network/.test(value))return icon(<Wifi/>); if(/warranty|safety|protection/.test(value))return icon(<ShieldCheck/>); return icon(<PackageCheck/>);
};

function presentationFor(category: string, title: string): Presentation {
  const text = `${category} ${title}`.toLowerCase();
  if (/beauty|makeup|skin|foundation|lipstick|serum|cosmetic/.test(text))
    return {
      kind: "beauty",
      variants: [
        {
          label: "Shade",
          values: ["Ivory", "Warm Nude", "Natural Beige", "Natural Buff"],
        },
        { label: "Size", values: ["18 ml", "30 ml"] },
      ],
      specs: [
        {
          icon: icon(<Droplets />),
          label: "Product type",
          value: "Beauty and personal care",
        },
        {
          icon: icon(<Palette />),
          label: "Shade / variant",
          value: "Selected shade",
        },
        {
          icon: icon(<Sparkles />),
          label: "Finish",
          value: "See provider details",
        },
        {
          icon: icon(<Eye />),
          label: "Coverage",
          value: "See product information",
        },
        {
          icon: icon(<CircleGauge />),
          label: "Skin type",
          value: "Check suitability",
        },
        {
          icon: icon(<PackageCheck />),
          label: "Pack size",
          value: "Selected pack",
        },
        {
          icon: icon(<ShieldCheck />),
          label: "Safety",
          value: "Read label before use",
        },
        {
          icon: icon(<Droplets />),
          label: "Key benefit",
          value: "Provider-described benefit",
        },
        {
          icon: icon(<Sparkles />),
          label: "Wear",
          value: "See merchant details",
        },
        {
          icon: icon(<Tag />),
          label: "Authenticity",
          value: "Buy from verified store",
        },
      ],
      guideTitle: "Shade, ingredients & safety",
      guideText:
        "Check the exact shade, full ingredient list, manufacturing date, expiry and patch-test guidance before purchase.",
    };
  if (/fashion|shirt|jean|dress|shoe|footwear|apparel|clothing/.test(text))
    return {
      kind: "fashion",
      variants: [
        { label: "Colour", values: ["Navy", "Black", "White", "Olive"] },
        { label: "Size", values: ["S", "M", "L", "XL", "XXL"] },
      ],
      specs: [
        {
          icon: icon(<Shirt />),
          label: "Fit",
          value: "Regular / selected fit",
        },
        {
          icon: icon(<Sparkles />),
          label: "Fabric",
          value: "See material details",
        },
        { icon: icon(<Palette />), label: "Pattern", value: "As shown" },
        { icon: icon(<Ruler />), label: "Size", value: "Selected size" },
        {
          icon: icon(<Shirt />),
          label: "Sleeve",
          value: "See product details",
        },
        { icon: icon(<Tag />), label: "Colour", value: "Selected colour" },
        {
          icon: icon(<Sparkles />),
          label: "Occasion",
          value: "Lifestyle wear",
        },
        {
          icon: icon(<PackageCheck />),
          label: "Closure",
          value: "See product details",
        },
        {
          icon: icon(<Ruler />),
          label: "Measurements",
          value: "Open size guide",
        },
        {
          icon: icon(<Droplets />),
          label: "Care",
          value: "Follow garment label",
        },
      ],
      guideTitle: "Size, fit & material care",
      guideText:
        "Use the merchant size chart for the exact variant. Review fabric, measurements, wash care and return eligibility before checkout.",
    };
  if (/mobile|electronic|laptop|appliance|camera|phone|tablet|audio/.test(text))
    return {
      kind: "electronics",
      variants: [
        { label: "Colour", values: ["Black", "Blue", "White"] },
        { label: "Configuration", values: ["Standard", "128 GB", "256 GB"] },
      ],
      specs: [
        {
          icon: icon(<MonitorSmartphone />),
          label: "Display",
          value: "See technical details",
        },
        {
          icon: icon(<CircleGauge />),
          label: "Processor",
          value: "Model-specific",
        },
        {
          icon: icon(<Camera />),
          label: "Rear camera",
          value: "See specifications",
        },
        {
          icon: icon(<Camera />),
          label: "Front camera",
          value: "See specifications",
        },
        {
          icon: icon(<PackageCheck />),
          label: "Storage",
          value: "Selected configuration",
        },
        { icon: icon(<Battery />), label: "Battery", value: "Usage varies" },
        {
          icon: icon(<MonitorSmartphone />),
          label: "Operating system",
          value: "Model-specific",
        },
        {
          icon: icon(<Wifi />),
          label: "Connectivity",
          value: "Wi-Fi and mobile network",
        },
        {
          icon: icon(<ScanFace />),
          label: "Security",
          value: "Model-specific",
        },
        {
          icon: icon(<ShieldCheck />),
          label: "Build & warranty",
          value: "See manufacturer terms",
        },
      ],
      guideTitle: "Complete technical information",
      guideText:
        "Confirm the exact model, configuration, connectivity, included accessories and manufacturer warranty before checkout.",
    };
  return {
    kind: "general",
    variants: [
      { label: "Variant", values: ["Standard", "Option 2", "Option 3"] },
      { label: "Pack", values: ["Single", "Value pack"] },
    ],
    specs: [
      {
        icon: icon(<PackageCheck />),
        label: "Product type",
        value: category || "General",
      },
      { icon: icon(<Tag />), label: "Brand", value: "See product title" },
      { icon: icon(<Palette />), label: "Variant", value: "Selected option" },
      { icon: icon(<Ruler />), label: "Size", value: "See merchant details" },
      {
        icon: icon(<Sparkles />),
        label: "Features",
        value: "Provider information",
      },
      {
        icon: icon(<ShieldCheck />),
        label: "Warranty",
        value: "Merchant terms apply",
      },
      { icon: icon(<Droplets />), label: "Care", value: "See product label" },
      {
        icon: icon(<PackageCheck />),
        label: "In the box",
        value: "Provider information",
      },
      {
        icon: icon(<CheckCircle2 />),
        label: "Availability",
        value: "Offer-specific",
      },
      {
        icon: icon(<Tag />),
        label: "Returns",
        value: "Merchant policy applies",
      },
    ],
    guideTitle: "Product information",
    guideText:
      "Review the selected variant, complete description, what is included and merchant return conditions.",
  };
}
function cashbackValue(offer: CatalogOffer) {
  if (offer.reward_type === "fixed_cashback") return offer.cashback_amount ?? 0;
  if (offer.reward_type === "percentage_cashback") {
    const raw =
      ((offer.current_price ?? 0) * (offer.cashback_percent ?? 0)) / 100;
    return offer.cashback_cap ? Math.min(raw, offer.cashback_cap) : raw;
  }
  return 0;
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const offers = await getProductOffers((await params).slug),
    product = offers[0]?.products;
  if (!product) notFound();
  const category = product.categories?.name ?? "Product",
    fallbackView = presentationFor(category, product.title),
    storedVariants = product.variants?.filter((v) => v.label && v.values?.length) ?? [],
    storedSpecs = product.specifications?.filter((s) => s.label && s.value) ?? [],
    view = { ...fallbackView, variants: storedVariants, specs: storedSpecs.slice(0,10).map((spec)=>({...spec,icon:specificationIcon(spec.icon_key||spec.label)})) },
    parent = safeReturnPath(
      (await searchParams).from,
      product.categories?.slug
        ? `/category/${product.categories.slug}`
        : "/deals",
    );
  const parentLabel = parent.startsWith("/category/")
    ? category
    : parent.startsWith("/store/")
      ? "Store"
      : parent === "/stores"
        ? "Stores"
        : "Deals";
  const lowest = offers.reduce((best, offer) =>
      (offer.current_price ?? Infinity) < (best.current_price ?? Infinity)
        ? offer
        : best,
    ),
    low = lowest.current_price ?? 0;
  const sortedOffers=[...offers].sort((a,b)=>((a.current_price??Infinity)-cashbackValue(a))-((b.current_price??Infinity)-cashbackValue(b))),
    bestEffectiveOffer=sortedOffers[0],
    bestCashback = cashbackValue(bestEffectiveOffer),
    effective = Math.max(0, (bestEffectiveOffer.current_price??0) - cashbackValue(bestEffectiveOffer));
  const ratedOffers=offers.filter(offer=>offer.customer_rating),
    totalRatings=ratedOffers.reduce((sum,offer)=>sum+(offer.rating_count??1),0),
    averageRating=totalRatings?ratedOffers.reduce((sum,offer)=>sum+(offer.customer_rating??0)*(offer.rating_count??1),0)/totalRatings:null;
  const supabase = await createClient(),
    offerIds = offers.map((offer) => offer.id);
  const [{ data: offerFaqs },{data:storedHistory}] = await Promise.all([offerIds.length
    ? supabase
        .from("support_faqs")
        .select("id,question,answer,scope")
        .in("offer_id", offerIds)
        .eq("is_active", true)
        .order("display_order")
    : Promise.resolve({ data: [] }),supabase.from('product_price_history').select('price,recorded_at').eq('product_id',product.id).order('recorded_at',{ascending:true}).limit(120)]);
  const allOffers = await getCatalogOffers({
      category: product.categories?.slug,
    }),
    related = allOffers
      .filter((o) => o.products?.slug !== product.slug)
      .filter(
        (o, i, list) =>
          list.findIndex((x) => x.products?.slug === o.products?.slug) === i,
      )
      .slice(0, 5);
  const historyRows=(storedHistory??[]).map(row=>({price:Number(row.price),recordedAt:String(row.recorded_at)})).filter(row=>Number.isFinite(row.price)),
    storedPrices=historyRows.map(row=>row.price),
    historyLow=storedPrices.length?Math.min(...storedPrices):null,
    high = storedPrices.length?Math.max(...storedPrices):null,
    avg = storedPrices.length?Math.round(storedPrices.reduce((a, b) => a + b, 0) / storedPrices.length):null,
    chartMin=historyLow??0,
    chartRange=Math.max(1,(high??0)-chartMin),
    chartPoints=historyRows.map((row,index)=>`${historyRows.length===1?350:(index/(historyRows.length-1))*700},${155-((row.price-chartMin)/chartRange)*120}`).join(' '),
    firstHistoryDate=historyRows[0]?.recordedAt?new Date(historyRows[0].recordedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'',
    lastHistoryDate=historyRows.at(-1)?.recordedAt?new Date(historyRows.at(-1)!.recordedAt).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'}):'';
  const gallery=[product.image_url,...(product.gallery_images??[])].filter((url,index,list):url is string=>Boolean(url)&&list.indexOf(url)===index).slice(0,5);
  const informationEntries: [string,string][] = Object.entries(product.product_information??{}).filter((entry):entry is [string,string]=>typeof entry[1]==='string'&&Boolean(entry[1].trim()));
  return (
    <>
      <Header />
      <main className={`pdp pdp-${view.kind}`}>
        <BrowseNav
          items={[
            { label: parentLabel, href: parent },
            { label: product.title },
          ]}
          fallback={parent}
        />
        <section className="pdp-hero">
          <ProductGallery images={gallery} title={product.title}/>
          <div className="pdp-summary">
            <p className="pdp-brand">
              {product.brand ?? "GLONNI"} · {category}
            </p>
            <h1>{product.title}</h1>
            {averageRating ? <div className="pdp-rating"><span><Star/></span><b>{averageRating.toFixed(1)} / 5</b><small>{totalRatings.toLocaleString('en-IN')} ratings across reporting stores</small></div> : <div className="pdp-rating pdp-rating-missing"><small>Customer ratings are not available from connected stores yet.</small></div>}
            <p>
              {product.description ||
                "Compare the exact same product variant across verified stores before choosing where to buy."}
            </p>
            <div className="pdp-save-row">
              <SaveOfferButton
                offer={{
                  offerId: lowest.id,
                  productTitle: product.title,
                  productSlug: product.slug,
                  imageUrl: product.image_url,
                  merchantName: lowest.merchants?.name ?? "Store",
                  price: lowest.current_price,
                  benefit: rewardLabel(lowest),
                }}
              />
              <PriceAlertButton
                offerId={lowest.id}
                productTitle={product.title}
                price={low}
              />
            </div>
            {view.variants.length ? view.variants.map((variant, group) => (
              <div className="pdp-variants" key={variant.label}>
                <div>
                  <b>{variant.label}</b>
                  {group === 1 && view.kind === "fashion" ? (
                    <a href="#category-guide">Size guide</a>
                  ) : null}
                </div>
                <div>
                  {variant.values.map((value, i) => (
                    <span className={i === 0 ? "selected" : ""} key={value}>
                      {value}
                    </span>
                  ))}
                </div>
              </div>
            )) : <div className="pdp-missing-inline"><b>Variants not provided</b><span>Open a store offer below to confirm available sizes, colours or configurations.</span></div>}
            {view.variants.length > 0 && <div className="pdp-selected">
              Selected variant{" "}
              <b>{view.variants.map((v) => v.values[0]).join(" · ")}</b>
            </div>}
            <div className="pdp-best">
              <span>
                <small>Lowest price</small>
                <b>{money(low)}</b>
                <em>on {lowest.merchants?.name}</em>
              </span>
              <span>
                <small>Glonni cashback</small>
                <b>{bestCashback ? money(bestCashback) : "Check offers"}</b>
              </span>
              <span>
                <small>Effective price</small>
                <b>{money(effective)}</b>
                <em>on {bestEffectiveOffer.merchants?.name}</em>
              </span>
            </div>
            <a className="pdp-compare-link" href="#offers">
              Compare prices across stores
            </a>
          </div>
        </section>
        <CmsManagedSections pageKey="product" slot="after_summary"/>
        <CmsManagedSections pageKey="product" slot="before_comparison"/>
        <section id="offers" className="pdp-card pdp-comparison">
          <header>
            <div>
              <h2>Compare prices across stores</h2>
              <p>
                Same product and selected variant. Different merchant offers.
              </p>
            </div>
            <span>
              <ShieldCheck /> Verified redirects
            </span>
          </header>
          <div className="pdp-table">
            <div className="pdp-table-head">
              <b>Store</b>
              <b>Price</b>
              <b>Bank offer</b>
              <b>Glonni cashback</b>
              <b>Effective price</b>
              <b>Customer rating</b>
              <b>Stock & updated</b>
              <b>Action</b>
            </div>
            {sortedOffers.map((offer, index) => {
              const cb = cashbackValue(offer),
                rating = offer.customer_rating?.toFixed(1)??'—',
                reviews = offer.rating_count?.toLocaleString("en-IN")??'No';
              return (
                <article className="pdp-offer" key={offer.id}>
                  <div className="pdp-store">
                    <strong>{offer.merchants?.logo_url ? <img src={offer.merchants.logo_url} alt=""/> : null}{offer.merchants?.name}</strong>
                    <small>
                      {offer.variant_label||view.variants.map((v) => v.values[0]).join(" · ")}
                    </small>
                    {index === 0 && <em>Best effective price</em>}
                  </div>
                  <strong>{offer.current_price == null ? '—' : money(offer.current_price)}</strong>
                  <span className="pdp-promotions">{offer.bank_offer ? <b>{offer.bank_offer}</b> : null}{offer.coupon_code ? <small>Coupon: {offer.coupon_code}</small> : null}{!offer.bank_offer && !offer.coupon_code ? 'No promotion reported' : null}</span>
                  <span className="pdp-cashback">
                    {cb ? money(cb) : "Not available"}
                    <small>
                      {cb ? `Cashback within ${offer.cashback_confirmation_days??45} days` : "No Glonni Cashback"}
                    </small>
                  </span>
                  <strong className="pdp-effective">
                    {offer.current_price == null ? '—' : money(Math.max(0, offer.current_price - cb))}
                  </strong>
                  <span className="pdp-merchant-rating">
                    <b>
                      <Star /> {rating}
                    </b>
                    <small>
                      {reviews} ratings
                      <br />
                      on {offer.merchants?.name}
                    </small>
                  </span>
                  <span className={`pdp-stock ${(offer.stock_status??'').toLowerCase().includes('out')?'unavailable':''}`}>
                    <b>● {(offer.stock_status||'unknown').replaceAll('_',' ')}</b>
                    <small>Updated {updatedLabel(offer.updated_at)}</small>
                  </span>
                  <div>
                    <a className="pdp-view" href={`/out/${offer.id}?source=product&medium=store-comparison&placement=product-comparison`}>
                      View deal
                    </a>
                  </div>
                  <details>
                    <summary>
                      Terms & conditions <ChevronDown />
                    </summary>
                    <p>
                      {offer.reward_terms ||
                        "Merchant pricing, eligibility, delivery, cancellation and return conditions apply. Cashback requires successful tracking and merchant confirmation."}
                    </p>
                  </details>
                </article>
              );
            })}
          </div>
        </section>
        <section className="pdp-card pdp-history">
          <header>
            <div>
              <h2>Price history</h2>
              <p>Verified recorded prices for this product</p>
            </div>
          </header>
          {historyRows.length ? <><div className="pdp-chart">
            <svg
              viewBox="0 0 700 180"
              role="img"
              aria-label="Recorded product price history"
            >
              <defs>
                <linearGradient id="pdpFill" x1="0" x2="0" y1="0" y2="1">
                  <stop stopColor="#1760db" stopOpacity=".22" />
                  <stop offset="1" stopColor="#1760db" stopOpacity="0" />
                </linearGradient>
              </defs>
              <polyline
                points={chartPoints}
                fill="none"
                stroke="#1760db"
                strokeWidth="5"
                strokeLinecap="round"
              />
            </svg>
            <div>
              <span>{firstHistoryDate}</span>
              <span>{lastHistoryDate}</span>
            </div>
          </div>
          <dl>
            <div>
              <dt>Current price</dt>
              <dd>{money(storedPrices.at(-1))}</dd>
            </div>
            <div>
              <dt>Lowest recorded price</dt>
              <dd>{money(historyLow)}</dd>
            </div>
            <div>
              <dt>Highest price</dt>
              <dd>{money(high)}</dd>
            </div>
            <div>
              <dt>Average price</dt>
              <dd>{money(avg)}</dd>
            </div>
          </dl>
          <small>
            Based only on recorded catalogue prices. Store checkout prices can change.
          </small>
          </> : <div className="pdp-history-empty"><b>Price history is not available yet</b><span>Glonni will show a chart after verified price records have been collected.</span></div>}
        </section>
        <section className="pdp-card pdp-specifications">
          <header>
            <div>
              <h2>Top 10 specifications</h2>
              <p>Category-relevant details for faster comparison</p>
            </div>
            <a href="#full-information">View all specifications</a>
          </header>
          {view.specs.length ? <div>
            {view.specs.map((spec) => (
              <article key={spec.label}>
                {spec.icon}
                <span>
                  <b>{spec.label}</b>
                  <small>{spec.value}</small>
                </span>
              </article>
            ))}
          </div> : <div className="pdp-section-empty"><b>Specifications have not been added</b><span>Confirm technical details on the selected store before purchasing.</span></div>}
        </section>
        <section id="category-guide" className="pdp-information-grid">
          <article className="pdp-card">
            <h2>{view.guideTitle}</h2>
            <p>{view.guideText}</p>
            <div className="pdp-guide">
              <ShieldCheck />
              <span>
                <b>Check the exact selected variant</b>
                <small>
                  Details can differ by size, shade, configuration, pack and
                  merchant.
                </small>
              </span>
            </div>
            <div className="pdp-guide">
              <PackageCheck />
              <span>
                <b>Review delivery and returns</b>
                <small>
                  Final fulfilment and return policy belong to the selected
                  merchant.
                </small>
              </span>
            </div>
          </article>
          <article id="full-information" className="pdp-card">
            <h2>Complete product information</h2>
            {informationEntries.length ? informationEntries.map(([key,value]) => (
              <details key={key}>
                <summary>
                  {key.replaceAll('_',' ')}
                  <ChevronDown />
                </summary>
                <p>
                  {value}
                </p>
              </details>
            )) : <div className="pdp-section-empty"><b>Complete information is not available</b><span>{product.description || 'Verified product details will appear here after they are added.'}</span></div>}
          </article>
        </section>
        <ContextualFaqs
          faqs={
            (offerFaqs ?? []) as {
              id: string;
              question: string;
              answer: string;
              scope: string;
            }[]
          }
        />
        {related.length > 0 && (
          <section className="pdp-related">
            <header>
              <div>
                <h2>Similar products</h2>
                <p>More options in {category}</p>
              </div>
              <a
                href={
                  product.categories?.slug
                    ? `/category/${product.categories.slug}`
                    : "/deals"
                }
              >
                View all
              </a>
            </header>
            <div>
              {related.map((offer) => (
                <a
                  key={offer.id}
                  href={`/product/${offer.products?.slug}?from=${encodeURIComponent(parent)}`}
                >
                  <img src={offer.products?.image_url || ""} alt="" />
                  <small>{offer.products?.brand ?? "GLONNI"}</small>
                  <b>{offer.products?.title}</b>
                  <strong>{money(offer.current_price)}</strong>
                </a>
              ))}
            </div>
          </section>
        )}
        <p className="pdp-disclosure">
          Prices, ratings, history, availability and delivery notes may be
          preview data until live provider feeds are connected. Final price,
          payment, delivery and returns are handled by the selected merchant.
          Glonni Cashback applies only to marked offers after successful
          tracking and merchant confirmation.
        </p>
        <CmsManagedSections pageKey="product" slot="page_end"/>
      </main>
    </>
  );
}
