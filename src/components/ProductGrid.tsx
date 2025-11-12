import type { UIProduct } from '../types/product';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: UIProduct[];
  onTryOn: (product: UIProduct) => void;
  onAddToCart?: (product: UIProduct) => void; // Optional, Shopify MCP handles cart
  addingProductId?: string | null;
}

export default function ProductGrid({ products, onTryOn, onAddToCart, addingProductId }: ProductGridProps) {
  if (!products || products.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No products found. Try a different search.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
        {products.map((product) => (
          <ProductCard
            key={product.id}
            product={product}
            onTryOn={onTryOn}
            onAddToCart={onAddToCart}
            isAddingToCart={addingProductId === product.id}
          />
        ))}
      </div>
      <div className="text-xs text-gray-500 text-center">
        Showing {products.length} product{products.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
