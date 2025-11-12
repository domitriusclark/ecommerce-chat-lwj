import type { ShopifyProduct, UIProduct } from '../types/product';

/**
 * Mock product data - inline to avoid import issues
 * This will be replaced with real Shopify MCP calls later
 */
const MOCK_PRODUCTS: ShopifyProduct[] = [
  {
    id: "gid://shopify/Product/1",
    title: "Classic White Oxford Shirt",
    description: "A timeless white oxford shirt perfect for any occasion. Made from premium cotton with a tailored fit.",
    images: [{ src: "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=800&h=1000&fit=crop", alt: "White Oxford Shirt" }],
    variants: [
      { id: "gid://shopify/ProductVariant/1-1", title: "Small", price: "49.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/1-2", title: "Medium", price: "49.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/1-3", title: "Large", price: "49.99", availableForSale: true }
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://images.unsplash.com/photo-1620012253295-c15cc3e65df4?w=800&h=1000&fit=crop"
      }
    }
  },
  {
    id: "gid://shopify/Product/2",
    title: "Navy Blue Linen Shirt",
    description: "Lightweight navy blue linen shirt, perfect for warm weather. Breathable and comfortable.",
    images: [{ src: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=1000&fit=crop", alt: "Navy Blue Linen Shirt" }],
    variants: [
      { id: "gid://shopify/ProductVariant/2-1", title: "Small", price: "59.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/2-2", title: "Medium", price: "59.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/2-3", title: "Large", price: "59.99", availableForSale: true }
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800&h=1000&fit=crop"
      }
    }
  },
  {
    id: "gid://shopify/Product/3",
    title: "Black Cotton T-Shirt",
    description: "Classic black cotton t-shirt with a comfortable regular fit. Versatile and easy to style.",
    images: [{ src: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=1000&fit=crop", alt: "Black Cotton T-Shirt" }],
    variants: [
      { id: "gid://shopify/ProductVariant/3-1", title: "Small", price: "29.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/3-2", title: "Medium", price: "29.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/3-3", title: "Large", price: "29.99", availableForSale: true }
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://images.unsplash.com/photo-1583743814966-8936f5b7be1a?w=800&h=1000&fit=crop"
      }
    }
  },
  {
    id: "gid://shopify/Product/4",
    title: "Striped Short Sleeve Shirt",
    description: "Casual striped short sleeve shirt with a relaxed fit. Perfect for summer days.",
    images: [{ src: "https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?w=800&h=1000&fit=crop", alt: "Striped Short Sleeve Shirt" }],
    variants: [
      { id: "gid://shopify/ProductVariant/4-1", title: "Small", price: "44.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/4-2", title: "Medium", price: "44.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/4-3", title: "Large", price: "44.99", availableForSale: true }
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?w=800&h=1000&fit=crop"
      }
    }
  },
  {
    id: "gid://shopify/Product/5",
    title: "Denim Button-Up Shirt",
    description: "Classic denim button-up shirt with a modern slim fit. Durable and stylish.",
    images: [{ src: "https://images.unsplash.com/photo-1626497764746-6dc36546b388?w=800&h=1000&fit=crop", alt: "Denim Button-Up Shirt" }],
    variants: [
      { id: "gid://shopify/ProductVariant/5-1", title: "Small", price: "69.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/5-2", title: "Medium", price: "69.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/5-3", title: "Large", price: "69.99", availableForSale: true }
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://images.unsplash.com/photo-1626497764746-6dc36546b388?w=800&h=1000&fit=crop"
      }
    }
  },
  {
    id: "gid://shopify/Product/6",
    title: "Olive Green Henley",
    description: "Comfortable olive green henley with button placket. Great for casual wear.",
    images: [{ src: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&h=1000&fit=crop", alt: "Olive Green Henley" }],
    variants: [
      { id: "gid://shopify/ProductVariant/6-1", title: "Small", price: "39.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/6-2", title: "Medium", price: "39.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/6-3", title: "Large", price: "39.99", availableForSale: true }
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&h=1000&fit=crop"
      }
    }
  },
  {
    id: "gid://shopify/Product/7",
    title: "Gray Polo Shirt",
    description: "Smart gray polo shirt with classic collar. Versatile for work or casual occasions.",
    images: [{ src: "https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=800&h=1000&fit=crop", alt: "Gray Polo Shirt" }],
    variants: [
      { id: "gid://shopify/ProductVariant/7-1", title: "Small", price: "54.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/7-2", title: "Medium", price: "54.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/7-3", title: "Large", price: "54.99", availableForSale: true }
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://images.unsplash.com/photo-1586363104862-3a5e2ab60d99?w=800&h=1000&fit=crop"
      }
    }
  },
  {
    id: "gid://shopify/Product/8",
    title: "Red Plaid Flannel Shirt",
    description: "Warm red plaid flannel shirt, perfect for cooler weather. Soft and cozy.",
    images: [{ src: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&h=1000&fit=crop", alt: "Red Plaid Flannel Shirt" }],
    variants: [
      { id: "gid://shopify/ProductVariant/8-1", title: "Small", price: "64.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/8-2", title: "Medium", price: "64.99", availableForSale: true },
      { id: "gid://shopify/ProductVariant/8-3", title: "Large", price: "64.99", availableForSale: true }
    ],
    availableForSale: true,
    metafields: {
      custom: {
        overlay_asset_shirt: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?w=800&h=1000&fit=crop"
      }
    }
  }
];

/**
 * Load mock products
 */
export function loadMockProducts(): ShopifyProduct[] {
  return MOCK_PRODUCTS;
}

/**
 * Transform a Shopify product to UIProduct format
 */
export function mapToUIProduct(product: ShopifyProduct): UIProduct {
  const firstVariant = product.variants?.[0];
  const firstImage = product.images?.[0];

  return {
    id: product.id,
    title: product.title,
    description: product.description,
    imageUrl: firstImage?.src,
    price: firstVariant
      ? {
          amount: parseFloat(firstVariant.price),
          currencyCode: 'USD', // Default to USD for mock data
        }
      : undefined,
    variants: product.variants,
    overlayAssetUrl: product.metafields?.custom?.overlay_asset_shirt,
    handle: product.title.toLowerCase().replace(/\s+/g, '-'),
    url: `/products/${product.title.toLowerCase().replace(/\s+/g, '-')}`,
  };
}

/**
 * Search products by query string
 * Filters by title and description
 */
export function searchProducts(query: string): UIProduct[] {
  const products = loadMockProducts();
  const lowerQuery = query.toLowerCase().trim();

  if (!lowerQuery) {
    // Return all products if no query
    return products.map(mapToUIProduct);
  }

  const filtered = products.filter((product) => {
    const titleMatch = product.title.toLowerCase().includes(lowerQuery);
    const descMatch = product.description.toLowerCase().includes(lowerQuery);
    return titleMatch || descMatch;
  });

  return filtered.map(mapToUIProduct);
}

/**
 * Get a single product by ID
 */
export function getProductById(id: string): UIProduct | null {
  const products = loadMockProducts();
  const product = products.find((p) => p.id === id);
  return product ? mapToUIProduct(product) : null;
}

/**
 * Get all products as UIProduct array
 */
export function getAllProducts(): UIProduct[] {
  return loadMockProducts().map(mapToUIProduct);
}

/**
 * Shopify MCP Product format (from search_shop_catalog response)
 */
export interface ShopifyMCPProduct {
  product_id: string;
  title: string;
  description?: string;
  image_url?: string;
  price_range?: {
    min: string;
    max: string;
    currency: string;
  };
  product_type?: string;
  tags?: string[];
  variants?: Array<{
    variant_id: string;
    title: string;
    price: string;
    currency: string;
    image_url?: string;
    available: boolean;
  }>;
}

/**
 * Transform Shopify MCP product to UIProduct format
 */
export function mapShopifyMCPToUIProduct(mcpProduct: ShopifyMCPProduct): UIProduct {
  // Convert MCP variants to ProductVariant format
  const variants = mcpProduct.variants?.map(v => ({
    id: v.variant_id,
    title: v.title,
    price: v.price,
    availableForSale: v.available,
  }));

  // Get price from price_range
  const price = mcpProduct.price_range ? {
    amount: parseFloat(mcpProduct.price_range.min),
    currencyCode: mcpProduct.price_range.currency,
  } : undefined;

  // Clean up description - remove empty strings and HTML tags
  let cleanDescription = mcpProduct.description?.trim() || undefined;
  if (cleanDescription) {
    // Strip HTML tags
    cleanDescription = cleanDescription.replace(/<[^>]*>/g, '');
    // If empty after cleanup, set to undefined
    if (!cleanDescription) cleanDescription = undefined;
  }

  // Clean up title - capitalize properly
  const cleanTitle = mcpProduct.title.trim();

  // Create handle from title
  const handle = cleanTitle.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

  // Ensure image URL is valid
  const imageUrl = mcpProduct.image_url?.trim() || undefined;

  return {
    id: mcpProduct.product_id,
    title: cleanTitle,
    description: cleanDescription,
    imageUrl: imageUrl,
    price,
    variants,
    overlayAssetUrl: imageUrl, // Use product image as overlay for now
    handle,
    url: `/products/${handle}`,
  };
}

