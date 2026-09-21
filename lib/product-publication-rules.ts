export type PublicationOffer = {
  current_price: number | null;
  destination_url: string | null;
  status?: string | null;
};

export type PublicationProduct = {
  title?: string | null;
  category_id?: string | null;
  image_url?: string | null;
  offers?: PublicationOffer[] | null;
};

export function hasCompleteStoreOffer(offers: PublicationOffer[] | null | undefined, requireActive = false) {
  return (offers ?? []).some((offer) =>
    (!requireActive || offer.status === "active") &&
    Number(offer.current_price) > 0 &&
    Boolean(offer.destination_url?.trim()),
  );
}

export function missingPublicationRequirements(product: PublicationProduct, requireActiveOffer = false) {
  return [
    !product.title?.trim() && "product name",
    !product.category_id && "category",
    !product.image_url?.trim() && "primary image",
    !hasCompleteStoreOffer(product.offers, requireActiveOffer) &&
      (requireActiveOffer ? "active store offer with a price and destination URL" : "complete store offer"),
  ].filter((item): item is string => Boolean(item));
}

// Used by catalogue, offer handoff and outbound click guards. Embedded
// products and merchants must be selected with !inner for these filters to
// remove the parent offer when its product or store is inactive.
type FilterableOfferQuery = {
  eq(column: string, value: string | boolean): FilterableOfferQuery;
  gt(column: string, value: number): FilterableOfferQuery;
  not(column: string, operator: string, value: null): FilterableOfferQuery;
  neq(column: string, value: string): FilterableOfferQuery;
};

export function applyPublicOfferFilters<Q>(query: Q): Q {
  return (query as unknown as FilterableOfferQuery)
    .eq("status", "active")
    .eq("products.is_active", true)
    .eq("merchants.is_active", true)
    .gt("current_price", 0)
    .not("destination_url", "is", null)
    .neq("destination_url", "") as unknown as Q;
}
