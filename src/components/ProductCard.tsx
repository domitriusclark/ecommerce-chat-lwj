import type { UIProduct } from '../types/product';

interface ProductCardProps {
  product: UIProduct;
  onTryOn: (product: UIProduct) => void;
  onAddToCart?: (product: UIProduct) => void; // Optional, will be handled by Shopify MCP
  isAddingToCart?: boolean;
}

export default function ProductCard({ product, onTryOn, onAddToCart, isAddingToCart }: ProductCardProps) {
  const formatPrice = (price?: { amount: number; currencyCode: string }) => {
    if (!price) return 'Price not available';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: price.currencyCode,
    }).format(price.amount);
  };

  return (
    <div className="relative border border-gray-200 rounded-lg p-3 bg-white hover:shadow-lg transition-shadow">
      {/* Try-On Eye Icon - Top Right */}
      {product.overlayAssetUrl && (
        <button
          onClick={() => onTryOn(product)}
          className="absolute top-2 right-2 z-10 bg-white/90 backdrop-blur-sm rounded-full p-2 hover:bg-white hover:scale-110 transition-all shadow-md"
          title="Try on this item (coming soon)"
          aria-label="Try on this item"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5 text-gray-700"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
            />
          </svg>
        </button>
      )}

      {/* Product Image */}
      <div className="w-full h-48 mb-3 overflow-hidden rounded-md bg-gray-100 flex items-center justify-center">
        {product.imageUrl ? (
          <img
            src={product.imageUrl}
            alt={product.title}
            className="w-full h-full object-cover"
            onError={(e) => {
              // Fallback if image fails to load
              e.currentTarget.style.display = 'none';
              e.currentTarget.parentElement!.innerHTML = '<div class="text-gray-400 text-xs">No image</div>';
            }}
          />
        ) : (
          <div className="text-gray-400 text-xs">No image available</div>
        )}
      </div>

      {/* Product Info */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem]">
          {product.title}
        </h3>

        {product.description && product.description.length > 0 && (
          <p className="text-xs text-gray-600 line-clamp-3 min-h-[3rem]">
            {product.description}
          </p>
        )}

        <div className="text-lg font-bold text-blue-600 pt-2">
          {formatPrice(product.price)}
        </div>

        {/* Available Sizes */}
        {product.variants && product.variants.length > 1 && (
          <div className="text-xs text-gray-500 pt-1">
            {product.variants.length} size{product.variants.length !== 1 ? 's' : ''} available
          </div>
        )}

        <div className="flex gap-2 pt-3">
          <button
            onClick={() => onTryOn(product)}
            className="flex-1 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Try On
          </button>
          {onAddToCart && (
            <button
              onClick={() => onAddToCart(product)}
              className="flex-1 px-3 py-2 text-sm font-medium rounded-lg bg-black text-white hover:bg-gray-800 transition-colors disabled:bg-gray-500 disabled:cursor-not-allowed"
              disabled={isAddingToCart}
            >
              {isAddingToCart ? 'Adding...' : 'Add to Cart'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
