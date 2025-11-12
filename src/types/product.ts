export interface ProductVariant {
  id: string;
  title: string;
  price: string;
  availableForSale: boolean;
}

export interface ProductImage {
  id?: string;
  src: string;
  alt?: string;
}

export interface ProductMetafields {
  custom?: {
    overlay_asset_shirt?: string;
    overlay_mask_shirt?: string;
  };
}

export interface ShopifyProduct {
  id: string;
  title: string;
  description: string;
  images: ProductImage[];
  variants: ProductVariant[];
  availableForSale: boolean;
  metafields?: ProductMetafields;
}

export interface UIProduct {
  id: string;
  title: string;
  description?: string;
  imageUrl?: string;
  price?: {
    amount: number;
    currencyCode: string;
  };
  variants?: ProductVariant[];
  overlayAssetUrl?: string;
  handle?: string;
  url?: string;
}

export interface TryOnResult {
  originalImage: string;
  productImage: string;
  compositeImage: string;
}

export interface CartItem {
  id: string;
  product: UIProduct;
  variant: ProductVariant;
  quantity: number;
}

export interface Cart {
  items: CartItem[];
  totalItems: number;
  subtotal: number;
}

