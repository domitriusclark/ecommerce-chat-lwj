/**
 * Data Mapping Utilities
 * Maps MCP responses to normalized UI types
 */

export type UIProduct = {
  id: string;
  title: string;
  handle?: string;
  url?: string;
  imageUrl?: string;
  price?: { amount: number; currencyCode: string };
  overlayAssetUrl?: string;
};

/**
 * Maps search_shop_catalog MCP response to normalized UIProduct array
 * Extracts top 5 products and normalizes field names
 * @param payload - Raw MCP response from search_shop_catalog
 * @returns Array of normalized UIProduct objects
 */
export function mapSearchCatalogToUIProducts(payload: any): UIProduct[] {
  // Handle different possible response structures
  const products = payload?.products ?? payload?.items ?? payload?.data?.products ?? [];

  return products.slice(0, 5).map((p: any) => {
    // Extract price from various possible locations
    let price = p.price ?? p.variants?.[0]?.price ?? p.priceRange?.minVariantPrice;

    // Normalize price format if needed
    if (price && typeof price === "object" && !price.currencyCode) {
      price = {
        amount: parseFloat(price.amount ?? price.value ?? "0"),
        currencyCode: price.currency ?? price.currencyCode ?? "USD",
      };
    }

    // Extract overlay asset URL from metafields
    const overlayAssetUrl =
      p.metafields?.custom?.overlay_asset_shirt ??
      p.metafield?.overlay_asset_shirt ??
      p.overlayAssetUrl;

    return {
      id: p.id ?? p.gid ?? p.product?.id ?? "",
      title: p.title ?? p.product?.title ?? "Untitled Product",
      handle: p.handle ?? p.product?.handle,
      url: p.url ?? (p.handle ? `/products/${p.handle}` : undefined),
      imageUrl:
        p.imageUrl ??
        p.images?.[0]?.url ??
        p.featuredImage?.url ??
        p.image?.url,
      price: price
        ? {
            amount: typeof price === "number" ? price : parseFloat(price.amount ?? "0"),
            currencyCode: typeof price === "object" ? price.currencyCode : "USD",
          }
        : undefined,
      overlayAssetUrl,
    };
  });
}

/**
 * Formats a price object for display
 * @param price - UIProduct price object
 * @returns Formatted price string (e.g., "$29.99")
 */
export function formatPrice(price?: {
  amount: number;
  currencyCode: string;
}): string {
  if (!price) return "";

  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: price.currencyCode,
    }).format(price.amount);
  } catch {
    // Fallback if currency code is invalid
    return `${price.currencyCode} ${price.amount.toFixed(2)}`;
  }
}
